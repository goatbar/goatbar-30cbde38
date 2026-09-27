import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const body=await req.json().catch(()=>({}));
  const token=String(body.token||"");
  if(!token) return out({error:"Link de degustação inválido."},400);
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:t,error}=await db.from("event_tastings").select("id,event_id,status,scheduled_at,location,guest_observations,public_enabled,events(event_name,client_name,event_type,date)").eq("public_token",token).single();
  if(error||!t||!t.public_enabled||t.status==="cancelled") return out({error:"Esta degustação não está disponível."},404);
  if(body.action==="get"){
   const [{data:drinks},{data:participants},{data:ratings}]=await Promise.all([
    db.from("event_tasting_drinks").select("id,drink_id,drink_name,drink_description,drink_image,display_order,bride_drink,groom_drink").eq("tasting_id",t.id).order("display_order"),
    db.from("event_tasting_participants").select("id,slot,name").eq("tasting_id",t.id).order("slot"),
    db.from("event_tasting_ratings").select("tasting_drink_id,participant_id,score,comment").eq("tasting_id",t.id)
   ]);
   return out({tasting:t,drinks:drinks||[],participants:participants||[],ratings:ratings||[]});
  }
  if(body.action==="submit"){
   if(!["scheduled","completed"].includes(t.status)) return out({error:"As avaliações desta degustação estão encerradas."},409);
   const people=Array.isArray(body.participants)?body.participants.slice(0,4):[];
   const submitted=Array.isArray(body.ratings)?body.ratings:[];
   const selections=Array.isArray(body.selections)?body.selections:[];
   const observations=String(body.observations||"").trim().slice(0,3000)||null;
   const {data:allowed}=await db.from("event_tasting_drinks").select("id").eq("tasting_id",t.id);
   const allowedIds=new Set((allowed||[]).map((x:any)=>x.id));
   const participantIds=new Map<number,string>();
   for(let slot=1;slot<=4;slot++){
    const p=people.find((x:any)=>Number(x.slot)===slot);
    const name=String(p?.name||"").trim().slice(0,120)||null;
    const {data:row,error:pe}=await db.from("event_tasting_participants").upsert({tasting_id:t.id,slot,name},{onConflict:"tasting_id,slot"}).select("id").single();
    if(pe) throw pe; participantIds.set(slot,row.id);
   }
   for(const r of submitted){
    const drinkId=String(r.tasting_drink_id||""); const slot=Number(r.slot); const score=Number(r.score);
    if(!allowedIds.has(drinkId)||!participantIds.has(slot)||!Number.isFinite(score)||score<1||score>10) continue;
    const comment=String(r.comment||"").trim().slice(0,1000)||null;
    const {error:re}=await db.from("event_tasting_ratings").upsert({tasting_id:t.id,tasting_drink_id:drinkId,participant_id:participantIds.get(slot),score,comment},{onConflict:"tasting_drink_id,participant_id"});
    if(re) throw re;
   }
   for(const s of selections){const did=String(s.tasting_drink_id||"");if(allowedIds.has(did))await db.from("event_tasting_drinks").update({bride_drink:!!s.bride_drink,groom_drink:!!s.groom_drink}).eq("id",did).eq("tasting_id",t.id);}
   await db.from("event_tastings").update({status:"completed",guest_observations:observations}).eq("id",t.id).eq("status","scheduled");
   return out({success:true});
  }
  return out({error:"Ação inválida."},400);
 }catch(e){console.error(e);return out({error:"Não foi possível processar a degustação."},500)}
});