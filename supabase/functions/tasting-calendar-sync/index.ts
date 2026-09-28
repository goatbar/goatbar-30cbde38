import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-calendar-sync-secret","Content-Type":"application/json"};
const out=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors});
async function sha256Hex(v:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join("");}
async function internalOk(db:any,req:Request){
 const provided=req.headers.get("x-calendar-sync-secret"); if(!provided)return false;
 const {data,error}=await db.from("calendar_sync_internal_config").select("secret_hash").eq("id","main").single();
 if(error||!data?.secret_hash)return false;
 return (await sha256Hex(provided))===data.secret_hash;
}
async function googleFetch(url:string,init:RequestInit){
 for(let a=1;a<=5;a++){
  const r=await fetch(url,init);
  if(r.ok||r.status===404)return r;
  let retry=r.status===429||r.status>=500;
  if(r.status===403){try{const j=await r.clone().json();const reason=j?.error?.errors?.[0]?.reason||"";retry=reason==="rateLimitExceeded"||reason==="userRateLimitExceeded";}catch{retry=false;}}
  if(!retry||a===5)return r;
  const ra=Number(r.headers.get("retry-after")||0);
  await new Promise(res=>setTimeout(res,ra>0?ra*1000:Math.min(1000*2**(a-1),8000)));
 }
 return fetch(url,init);
}
async function token(db:any){
 const {data:i,error}=await db.from("google_calendar_integrations").select("*").eq("status","connected").order("created_at",{ascending:false}).limit(1).single();
 if(error||!i) throw new Error("Google Calendar não conectado.");
 if(new Date(i.token_expires_at).getTime()-Date.now()>300000) return {access:i.access_token,calendar:i.calendar_id||"primary"};
 if(!i.refresh_token) throw new Error("Google Calendar precisa ser reconectado.");
 const clientId=Deno.env.get("GOOGLE_CLIENT_ID")||Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")||"";
 const clientSecret=Deno.env.get("GOOGLE_CLIENT_SECRET")||Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")||"";
 if(!clientId||!clientSecret) throw new Error("Credenciais OAuth do Google Calendar não configuradas.");
 const p=new URLSearchParams({refresh_token:i.refresh_token,client_id:clientId,client_secret:clientSecret,grant_type:"refresh_token"});
 const rr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:p});
 if(!rr.ok) throw new Error("Falha ao renovar acesso ao Google Calendar.");
 const j=await rr.json(); await db.from("google_calendar_integrations").update({access_token:j.access_token,token_expires_at:new Date(Date.now()+(j.expires_in||3600)*1000).toISOString()}).eq("id",i.id);
 return {access:j.access_token,calendar:i.calendar_id||"primary"};
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db=createClient(url,service); const body=await req.json();
  const internal=await internalOk(db,req);
  if(!internal){
   const auth=req.headers.get("Authorization"); if(!auth)return out({error:"Não autorizado"},401);
   const authDb=createClient(url,anon,{global:{headers:{Authorization:auth}}}); const {data:{user}}=await authDb.auth.getUser(); if(!user)return out({error:"Não autorizado"},401);
  }
  const id=body.tastingId; if(!id)return out({error:"tastingId obrigatório"},400);
  const {data:t,error}=await db.from("event_tastings").select("*,events(event_name,client_name,phone,event_type)").eq("id",id).single(); if(error||!t)return out({error:"Degustação não encontrada"},404);
  if(!t.scheduled_at)return out({error:"Defina a data e horário da degustação."},400);
  const {data:ds}=await db.from("event_tasting_drinks").select("drink_name").eq("tasting_id",id).order("display_order");
  const g=await token(db); const start=new Date(t.scheduled_at),end=new Date(start.getTime()+t.duration_minutes*60000);
  const ev:any={summary:`Degustação — ${t.events?.event_name||t.events?.client_name||"Evento"}`,description:[`Cliente: ${t.events?.client_name||"—"}`,t.events?.phone?`Telefone: ${t.events.phone}`:null,ds?.length?`Drinks: ${ds.map((x:any)=>x.drink_name).join(", ")}`:null,`Abrir no Goat Bar: ${(Deno.env.get("APP_URL")||"https://goatbar.com.br").replace(/\/$/,"")}/eventos/${t.event_id}`].filter(Boolean).join("\n"),location:t.location||undefined,start:{dateTime:start.toISOString(),timeZone:"America/Sao_Paulo"},end:{dateTime:end.toISOString(),timeZone:"America/Sao_Paulo"},status:"confirmed"};
  const base=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(g.calendar)}/events`; let res;
  if(t.google_calendar_event_id){res=await googleFetch(`${base}/${encodeURIComponent(t.google_calendar_event_id)}`,{method:"PATCH",headers:{Authorization:`Bearer ${g.access}`,"Content-Type":"application/json"},body:JSON.stringify(ev)});if(res.status===404)res=await googleFetch(base,{method:"POST",headers:{Authorization:`Bearer ${g.access}`,"Content-Type":"application/json"},body:JSON.stringify(ev)});}
  else res=await googleFetch(base,{method:"POST",headers:{Authorization:`Bearer ${g.access}`,"Content-Type":"application/json"},body:JSON.stringify(ev)});
  if(!res.ok)throw new Error(`Google Calendar: ${await res.text()}`); const saved=await res.json();
  await db.from("event_tastings").update({google_calendar_event_id:saved.id,google_calendar_html_link:saved.htmlLink||null,google_calendar_sync_status:"synced",google_calendar_synced_at:new Date().toISOString(),google_calendar_sync_error:null,status:t.status==="planning"?"scheduled":t.status}).eq("id",id);
  return out({success:true,htmlLink:saved.htmlLink});
 }catch(e:any){console.error(e);return out({error:e.message||"Erro ao sincronizar degustação"},500)}
});