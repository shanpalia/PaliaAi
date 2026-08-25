import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODEL = Deno.env.get("TEXT_MODEL") || "gemini-3.6-flash";
const IMAGE_MODEL = Deno.env.get("IMAGE_MODEL") || MODEL;
const LIMIT = 7200;

const mem = new Map<string,{date:string,used:number}>();

function indiaDate(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

function usage(userId:string){
  const date=indiaDate();
  let r=mem.get(userId);
  if(!r||r.date!==date){r={date,used:0};mem.set(userId,r);}
  const remaining=Math.max(0,LIMIT-r.used);
  return {
    user_id:userId,usage_date:date,used_seconds:r.used,daily_limit_seconds:LIMIT,
    remaining_seconds:remaining,is_limit_reached:remaining<=0,allowed:remaining>0,
    formatted_remaining:remaining>=3600
      ? `${Math.floor(remaining/3600)}h ${Math.floor((remaining%3600)/60)}m remaining`
      : remaining>=60 ? `${Math.floor(remaining/60)}m remaining` : `${remaining}s remaining`
  };
}

function json(body:any,status=200){
  return new Response(JSON.stringify(body),{status,headers:CORS});
}

async function gemini(model:string,payload:any){
  if(!GEMINI_KEY)throw new Error("GEMINI_API_KEY is not configured.");
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const d=await r.json();
  if(!r.ok)throw new Error(d?.error?.message||`AI API error ${r.status}`);
  return d;
}

function textOf(d:any){
  return d?.candidates?.[0]?.content?.parts?.filter((p:any)=>p.text).map((p:any)=>p.text).join("\n")||"";
}

function sourcesOf(d:any){
  const out:any[]=[];
  for(const c of d?.candidates?.[0]?.groundingMetadata?.groundingChunks||[]){
    if(c.web?.uri)out.push({title:c.web.title||c.web.uri,url:c.web.uri,uri:c.web.uri});
  }
  return out;
}

function partsFromAttachments(attachments:any[]){
  const parts:any[]=[];
  for(const a of Array.isArray(attachments)?attachments:[]){
    if(!a?.data||!String(a.data).startsWith("data:"))continue;
    const match=String(a.data).match(/^data:([^;]+);base64,(.*)$/s);
    if(!match)continue;
    const mime=match[1];
    const base64=match[2];
    if(base64.length>140_000_000)continue;
    parts.push({inlineData:{mimeType:mime,data:base64}});
  }
  return parts;
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return json({success:false,error:"Method not allowed"},405);

  try{
    const b=await req.json();
    const userId=String(b.userId||"guest");
    const action=String(b.action||"chat");
    const u=usage(userId);

    if(action==="usage")return json({success:true,usage:u});
    if(!u.allowed)return json({success:false,isLimitReached:true,error:"Daily AI limit reached. Your 2-hour allowance resets tomorrow.",usage:u},429);

    const prompt=String(b.message||b.query||"").trim();
    const attachments=Array.isArray(b.attachments)?b.attachments:[];
    const attachmentParts=partsFromAttachments(attachments);

    if(!prompt && !attachmentParts.length)return json({success:false,error:"Please enter a message or attach a file.",usage:u},400);

    const system="You are Palia AI, a helpful, accurate, friendly multimodal AI assistant developed by ShanPalia. Never mention the underlying model or provider name. Be honest about what you can and cannot do.";

    const history:any[]=[];
    if(Array.isArray(b.history)){
      for(const h of b.history.slice(-20)){
        const t=String(h.text||h.content||"").trim();
        if(t)history.push({role:h.role==="assistant"||h.role==="model"?"model":"user",parts:[{text:t}]});
      }
    }

    const currentParts:any[]=[{text:prompt||"Analyze the attached content and help the user."},...attachmentParts];
    const payload:any={
      contents:[...history,{role:"user",parts:currentParts}],
      generationConfig:{temperature:0.7},
      systemInstruction:{parts:[{text:system}]}
    };

    if(action==="search")payload.tools=[{google_search:{}}];

    const start=Date.now();

    if(action==="image"){
      payload.generationConfig={temperature:0.7,responseModalities:["TEXT","IMAGE"]};
    }

    const data=await gemini(action==="image"?IMAGE_MODEL:MODEL,payload);
    const elapsed=Math.max(1,Math.round((Date.now()-start)/1000));
    const r=mem.get(userId);if(r)r.used=Math.min(LIMIT,r.used+elapsed);

    let text=textOf(data);
    let imageUrl="";

    for(const p of data?.candidates?.[0]?.content?.parts||[]){
      const id=p?.inlineData;
      if(id?.data&&String(id.mimeType||"").startsWith("image/")){
        imageUrl=`data:${id.mimeType};base64,${id.data}`;
        break;
      }
    }

    if(action==="image"&&!imageUrl&&!text){
      text="The configured image-generation model did not return an image. Set IMAGE_MODEL to an image-capable model in Supabase Function secrets.";
    }

    return json({
      success:true,
      text:text||"Done.",
      reply:text||"Done.",
      imageUrl,
      sources:sourcesOf(data),
      searchQueries:action==="search"?[prompt]:[],
      modelUsed:"Palia AI",
      usage:usage(userId)
    });
  }catch(e){
    return json({success:false,error:e instanceof Error?e.message:"Palia AI request failed"},500);
  }
});
