import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Max-Age":"86400",
  "Content-Type":"application/json",
};

const KEY=Deno.env.get("GEMINI_API_KEY")||"";
const MODEL=Deno.env.get("IMAGE_MODEL")||"gemini-3.1-flash-image";

function json(x:any,status=200){return new Response(JSON.stringify(x),{status,headers:CORS})}

async function callGemini(payload:any){
  if(!KEY)throw new Error("GEMINI_API_KEY is missing in Supabase secrets.");
  const url=`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(MODEL)}:generateContent`;
  const r=await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/json","x-goog-api-key":KEY},
    body:JSON.stringify(payload)
  });
  const d=await r.json();
  if(!r.ok)throw new Error(d?.error?.message||`Gemini image API error ${r.status}`);
  return d;
}

function imageFrom(d:any){
  for(const p of d?.candidates?.[0]?.content?.parts||[]){
    const x=p?.inlineData;
    if(x?.data&&String(x.mimeType||"").startsWith("image/"))
      return `data:${x.mimeType};base64,${x.data}`;
  }
  return "";
}
function textFrom(d:any){
  return d?.candidates?.[0]?.content?.parts?.filter((p:any)=>p?.text).map((p:any)=>p.text).join("\n")||"";
}
function attachmentsToParts(a:any[]){
  const out:any[]=[];
  for(const item of Array.isArray(a)?a:[]){
    const raw=String(item?.data||"");
    const m=raw.match(/^data:([^;]+);base64,(.*)$/s);
    if(!m)continue;
    out.push({inlineData:{mimeType:m[1],data:m[2]}});
  }
  return out;
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return json({success:false,error:"Method not allowed."},405);
  try{
    const b=await req.json();
    const prompt=String(b.message||"").trim();
    const attachments=attachmentsToParts(b.attachments);
    if(!prompt&&!attachments.length)return json({success:false,error:"Please enter an image request."},400);

    const contents=[{
      role:"user",
      parts:[
        {text:prompt||"Create an image from the attached reference."},
        ...attachments
      ]
    }];

    const payload={
      contents,
      systemInstruction:{
        parts:[{
          text:"You are Palia AI's image generator. Generate the actual requested image. Never answer that you are a text-only assistant. Never return an image prompt, SVG, ASCII art, or design instructions instead of the image."
        }]
      },
      generationConfig:{
        responseModalities:["TEXT","IMAGE"],
        responseFormat:{
          image:{aspectRatio:"1:1",imageSize:"2K"}
        }
      }
    };

    const data=await callGemini(payload);
    const imageUrl=imageFrom(data);
    const text=textFrom(data);

    if(!imageUrl){
      return json({
        success:false,
        error:"Gemini returned no image.",
        details:text||"No image data was returned. Check that this API key can use gemini-3.1-flash-image.",
        model:MODEL
      },502);
    }

    return json({
      success:true,
      text:text||"Here is your generated image.",
      reply:text||"Here is your generated image.",
      imageUrl,
      model:MODEL,
      generated:true
    });
  }catch(e){
    return json({
      success:false,
      error:e instanceof Error?e.message:"Image generation failed."
    },500);
  }
});
