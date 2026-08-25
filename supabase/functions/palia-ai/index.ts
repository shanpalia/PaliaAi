import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const TEXT_MODEL = Deno.env.get("TEXT_MODEL") || "gemini-3.6-flash";
const IMAGE_MODEL = Deno.env.get("IMAGE_MODEL") || "gemini-3.1-flash-image";
const DAILY_LIMIT = 7200;
const usageMap = new Map<string,{date:string,used:number}>();

function indiaDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function getUsage(id:string){const date=indiaDate();let r=usageMap.get(id);if(!r||r.date!==date){r={date,used:0};usageMap.set(id,r)}const remaining=Math.max(0,DAILY_LIMIT-r.used);return {user_id:id,usage_date:date,used_seconds:r.used,daily_limit_seconds:DAILY_LIMIT,remaining_seconds:remaining,is_limit_reached:remaining<=0,allowed:remaining>0,formatted_remaining:remaining>=3600?`${Math.floor(remaining/3600)}h ${Math.floor((remaining%3600)/60)}m remaining`:remaining>=60?`${Math.floor(remaining/60)}m remaining`:`${remaining}s remaining`}}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:CORS})}
async function generateContent(model:string,payload:any){if(!GEMINI_KEY)throw new Error("GEMINI_API_KEY is missing in Supabase secrets.");const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||`Gemini API error ${r.status}`);return d}
function textFrom(d:any){return d?.candidates?.[0]?.content?.parts?.filter((p:any)=>typeof p?.text==="string").map((p:any)=>p.text).join("\n")||""}
function imageFrom(d:any){for(const p of d?.candidates?.[0]?.content?.parts||[]){const x=p?.inlineData;if(x?.data&&String(x.mimeType||"").startsWith("image/"))return `data:${x.mimeType};base64,${x.data}`}return ""}
function sourcesFrom(d:any){const out:any[]=[];for(const c of d?.candidates?.[0]?.groundingMetadata?.groundingChunks||[])if(c?.web?.uri)out.push({title:c.web.title||c.web.uri,url:c.web.uri});return out}
function attachmentsToParts(a:any[]){const out:any[]=[];for(const item of Array.isArray(a)?a:[]){const raw=String(item?.data||"");const m=raw.match(/^data:([^;]+);base64,(.*)$/s);if(!m)continue;if(m[2].length>35_000_000)throw new Error(`${item?.name||"File"} is too large. Please use a smaller file.`);out.push({inlineData:{mimeType:m[1],data:m[2]}})}return out}

serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return json({success:false,error:"Method not allowed."},405);
  try{
    const b=await req.json();const userId=String(b.userId||"guest");const requestedAction=String(b.action||"chat");
    const prompt=String(b.message||b.query||"").trim();
    const imageRequest=/\b(image|icon|logo|photo|picture|background|png|svg|cartoon|3d|avatar|tasveer)\b/i.test(prompt) &&
      /\b(create|generate|make|draw|design|edit|transform|remove|replace|turn|convert|bana|banao|bana do|de do|karo|chahiye|dikhao|do)\b/i.test(prompt);
    const action=imageRequest?"image":requestedAction;
    const usage=getUsage(userId);
    if(action==="usage")return json({success:true,usage});
    if(!usage.allowed)return json({success:false,isLimitReached:true,error:"Daily AI limit reached. Your 2-hour allowance resets tomorrow.",usage},429);
    const fileParts=attachmentsToParts(b.attachments);
    if(!prompt&&!fileParts.length)return json({success:false,error:"Please enter a message or attach a file.",usage},400);

    const system=`You are Palia AI, a helpful, accurate, friendly multimodal AI assistant developed by ShanPalia. Never reveal the underlying model/provider name. If an image request is being processed, create the actual requested image and do not answer with a prompt, SVG, ASCII art, design instructions, or a claim that you are text-only. Be concise.`;
    const contents:any[]=[];
    for(const h of Array.isArray(b.history)?b.history.slice(-20):[]){const t=String(h?.text||h?.content||"").trim();if(t)contents.push({role:h.role==="assistant"||h.role==="model"?"model":"user",parts:[{text:t}]})}
    contents.push({role:"user",parts:[{text:prompt||"Analyze the attached file(s) and answer the user."},...fileParts]});
    const payload:any={contents,systemInstruction:{parts:[{text:system}]},generationConfig:{temperature:.7}};

    if(action==="search")payload.tools=[{google_search:{}}];
    if(action==="image"){
      // Gemini 3.1 Flash Image (Nano Banana 2) supports native image output.
      payload.generationConfig={
        responseModalities:["TEXT","IMAGE"],
        responseFormat:{image:{aspectRatio:"1:1",imageSize:"2K"}}
      };
    }

    const started=Date.now();
    let data:any;
    if(action==="image"){
      try{
        data=await generateContent(IMAGE_MODEL,payload);
      }catch(firstErr){
        const msg=firstErr instanceof Error?firstErr.message:String(firstErr);
        if(/not found|not supported|not available|unknown model|404/i.test(msg)){
          data=await generateContent("gemini-3.1-flash-lite-image",payload);
        }else{
          throw firstErr;
        }
      }
    }else{
      data=await generateContent(TEXT_MODEL,payload);
    }
    const elapsed=Math.max(1,Math.round((Date.now()-started)/1000));const row=usageMap.get(userId);if(row)row.used=Math.min(DAILY_LIMIT,row.used+elapsed);
    const text=textFrom(data);const imageUrl=imageFrom(data);
    if(action==="image"&&!imageUrl)return json({success:false,error:"Image generation returned no image. The Gemini API key may not have image generation access, or the image model is unavailable for this key.",details:text||"No image data returned.",usage:getUsage(userId)},502);
    return json({success:true,text:text||"",reply:text||"",imageUrl,sources:sourcesFrom(data),searchQueries:action==="search"?[prompt]:[],modelUsed:"Palia AI",usage:getUsage(userId)});
  }catch(e){return json({success:false,error:e instanceof Error?e.message:"Palia AI request failed."},500)}
});
