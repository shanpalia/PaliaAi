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
const IMAGE_MODEL = Deno.env.get("IMAGE_MODEL") || "";
const LIMIT = 7200;
const mem = new Map<string,{date:string,used:number}>();

function indiaDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function usage(userId:string){
  const date=indiaDate(); let r=mem.get(userId);
  if(!r||r.date!==date){r={date,used:0};mem.set(userId,r)}
  const remaining=Math.max(0,LIMIT-r.used);
  return {user_id:userId,usage_date:date,used_seconds:r.used,daily_limit_seconds:LIMIT,
    remaining_seconds:remaining,is_limit_reached:remaining<=0,allowed:remaining>0,
    formatted_remaining:remaining>=3600?`${Math.floor(remaining/3600)}h ${Math.floor((remaining%3600)/60)}m remaining`:
      remaining>=60?`${Math.floor(remaining/60)}m remaining`:`${remaining}s remaining`};
}
function json(x:any,status=200){return new Response(JSON.stringify(x),{status,headers:CORS})}
async function gemini(model:string,payload:any){
  if(!GEMINI_KEY)throw new Error("GEMINI_API_KEY is not configured.");
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const d=await r.json(); if(!r.ok)throw new Error(d?.error?.message||`AI API error ${r.status}`); return d;
}
function textOf(d:any){return d?.candidates?.[0]?.content?.parts?.filter((p:any)=>p.text).map((p:any)=>p.text).join("\n")||""}
function sourcesOf(d:any){
  const out:any[]=[]; for(const c of d?.candidates?.[0]?.groundingMetadata?.groundingChunks||[])
    if(c.web?.uri)out.push({title:c.web.title||c.web.uri,url:c.web.uri,uri:c.web.uri}); return out;
}
function attachmentParts(attachments:any[]){
  const out:any[]=[];
  for(const a of Array.isArray(attachments)?attachments:[]){
    if(!a?.data||!String(a.data).startsWith("data:"))continue;
    const m=String(a.data).match(/^data:([^;]+);base64,(.*)$/s); if(!m)continue;
    out.push({inlineData:{mimeType:m[1],data:m[2]}});
  } return out;
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return json({success:false,error:"Method not allowed"},405);
  try{
    const b=await req.json(), userId=String(b.userId||"guest"), action=String(b.action||"chat");
    const u=usage(userId);
    if(action==="usage")return json({success:true,usage:u});
    if(!u.allowed)return json({success:false,isLimitReached:true,error:"Daily AI limit reached. Your 2-hour allowance resets tomorrow.",usage:u},429);
    const prompt=String(b.message||b.query||"").trim();
    const parts=attachmentParts(b.attachments);
    if(!prompt&&!parts.length)return json({success:false,error:"Please enter a message or attach a file.",usage:u},400);

    const system="You are Palia AI, a helpful, accurate, friendly multimodal AI assistant developed by ShanPalia. Never mention the underlying model or provider name. Be honest about capabilities. If an image generation/editing operation is requested, return actual image output only when the configured image-capable model supports it; never pretend an image was generated.";
    const contents:any[]=[];
    for(const h of Array.isArray(b.history)?b.history.slice(-20):[]){
      const t=String(h.text||h.content||"").trim();
      if(t)contents.push({role:h.role==="assistant"||h.role==="model"?"model":"user",parts:[{text:t}]});
    }
    contents.push({role:"user",parts:[{text:prompt||"Analyze the attached content and help the user."},...parts]});
    const payload:any={contents,generationConfig:{temperature:.7},systemInstruction:{parts:[{text:system}]}};
    if(action==="search")payload.tools=[{google_search:{}}];
    if(action==="image"){
      if(!IMAGE_MODEL)throw new Error("Image generation is not configured yet. Set IMAGE_MODEL in Supabase secrets to an image-capable model available to your API key.");
      payload.generationConfig={temperature:.7,responseModalities:["TEXT","IMAGE"]};
    }
    const start=Date.now(), data=await gemini(action==="image"?IMAGE_MODEL:MODEL,payload);
    const elapsed=Math.max(1,Math.round((Date.now()-start)/1000)), row=mem.get(userId);
    if(row)row.used=Math.min(LIMIT,row.used+elapsed);
    let imageUrl="";
    for(const p of data?.candidates?.[0]?.content?.parts||[]){
      if(p?.inlineData?.data&&String(p.inlineData.mimeType||"").startsWith("image/")){
        imageUrl=`data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;break;
      }
    }
    const text=textOf(data);
    return json({success:true,text:text||"Done.",reply:text||"Done.",imageUrl,sources:sourcesOf(data),
      searchQueries:action==="search"?[prompt]:[],modelUsed:"Palia AI",usage:usage(userId)});
  }catch(e){return json({success:false,error:e instanceof Error?e.message:"Palia AI request failed"},500)}
});
