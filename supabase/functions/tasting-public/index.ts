import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const MAX_PARTICIPANTS=30;

type CatalogDrink={id:string;nome:string;descricao:string|null;imagem:string|null};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const body=await req.json().catch(()=>({}));
  const token=String(body.token||"");
  if(!token) return out({error:"Link de degustação inválido."},400);
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:t,error}=await db.from("event_tastings").select("id,event_id,status,scheduled_at,location,guest_observations,public_enabled,events(event_name,client_name,event_type,date,guests,drinks)").eq("public_token",token).single();
  if(error||!t||!t.public_enabled||t.status==="cancelled") return out({error:"Esta degustação não está disponível."},404);

  if(body.action==="get"){
   const [{data:drinks},{data:participants},{data:ratings},{data:catalog}]=await Promise.all([
    db.from("event_tasting_drinks").select("id,drink_id,drink_name,drink_description,drink_image,display_order,bride_drink,groom_drink").eq("tasting_id",t.id).order("display_order"),
    db.from("event_tasting_participants").select("id,slot,name").eq("tasting_id",t.id).order("slot"),
    db.from("event_tasting_ratings").select("tasting_drink_id,participant_id,score,comment").eq("tasting_id",t.id),
    db.from("drinks").select("id,nome,descricao,imagem").order("nome")
   ]);
   const event=Array.isArray((t as any).events)?(t as any).events[0]:(t as any).events;
   const catalogRows=(catalog||[]) as CatalogDrink[];
   const budgetValues=Array.isArray(event?.drinks)?event.drinks:[];
   const budgetDrinks=budgetValues.map((value:any)=>{
    const raw=typeof value==="string"?value:String(value?.id||value?.nome||value?.name||"");
    const match=catalogRows.find(d=>d.id===raw||d.nome===raw);
    return match?.nome||raw;
   }).filter(Boolean);
   return out({tasting:t,drinks:drinks||[],participants:participants||[],ratings:ratings||[],catalog:catalogRows,budget_drinks:budgetDrinks});
  }

  if(body.action==="add_drink"){
   if(t.status!=="scheduled") return out({error:"Só é possível adicionar drinks durante uma degustação agendada."},409);
   const drinkId=String(body.drink_id||"");
   const {data:catalogDrink,error:catalogError}=await db.from("drinks").select("id,nome,descricao,imagem").eq("id",drinkId).single();
   if(catalogError||!catalogDrink) return out({error:"Drink não encontrado no catálogo."},404);
   const {data:existing}=await db.from("event_tasting_drinks").select("id,drink_id,drink_name,drink_description,drink_image,display_order,bride_drink,groom_drink").eq("tasting_id",t.id).eq("drink_id",drinkId).maybeSingle();
   if(existing) return out({success:true,drink:existing});
   const {data:last}=await db.from("event_tasting_drinks").select("display_order").eq("tasting_id",t.id).order("display_order",{ascending:false}).limit(1);
   const displayOrder=Number(last?.[0]?.display_order??-1)+1;
   const {data:created,error:createError}=await db.from("event_tasting_drinks").insert({tasting_id:t.id,drink_id:catalogDrink.id,display_order:displayOrder,drink_name:catalogDrink.nome,drink_description:catalogDrink.descricao||null,drink_image:catalogDrink.imagem||null}).select("id,drink_id,drink_name,drink_description,drink_image,display_order,bride_drink,groom_drink").single();
   if(createError) throw createError;
   return out({success:true,drink:created});
  }

  if(body.action==="submit"){
   if(!["scheduled","completed"].includes(t.status)) return out({error:"As avaliações desta degustação estão encerradas."},409);
   const flowV2=Number(body.flow_version)>=2;
   const rawPeople=(Array.isArray(body.participants)?body.participants:[]).slice(0,MAX_PARTICIPANTS).map((p:any,i:number)=>({slot:i+1,name:String(p?.name||"").trim().slice(0,120)}));
   const lastNamed=rawPeople.reduce((last:number,p:any,i:number)=>p.name?i:last,-1);
   const people=(flowV2?rawPeople:rawPeople.slice(0,lastNamed+1));
   if(!people.length) return out({error:"Informe pelo menos uma pessoa presente na degustação."},400);
   if(flowV2&&people.some((p:any)=>!p.name)) return out({error:"Preencha o nome de todas as pessoas presentes."},400);
   const submitted=Array.isArray(body.ratings)?body.ratings:[];
   const observations=String(body.observations||"").trim().slice(0,3000)||null;
   const {data:allowed}=await db.from("event_tasting_drinks").select("id").eq("tasting_id",t.id);
   const allowedIds=new Set((allowed||[]).map((x:any)=>x.id));
   if(!allowedIds.size) return out({error:"Esta degustação não possui drinks selecionados."},400);
   const validKeys=new Set<string>();
   for(const r of submitted){const did=String(r?.tasting_drink_id||"");const slot=Number(r?.slot);const score=Number(r?.score);if(allowedIds.has(did)&&slot>=1&&slot<=people.length&&Number.isFinite(score)&&score>=1&&score<=10)validKeys.add(`${did}:${slot}`)}
   const expected=allowedIds.size*people.length;
   if(flowV2&&validKeys.size<expected) return out({error:"Dê uma nota de 1 a 10 para cada pessoa em todos os drinks antes de finalizar."},400);
   if(!flowV2&&validKeys.size===0) return out({error:"Informe pelo menos uma avaliação válida."},400);

   const {data:existingParticipants}=await db.from("event_tasting_participants").select("id,slot").eq("tasting_id",t.id);
   const keepSlots=new Set(people.map((p:any)=>p.slot));
   const removeIds=(existingParticipants||[]).filter((p:any)=>!keepSlots.has(Number(p.slot))).map((p:any)=>p.id);
   if(removeIds.length){const {error:removeError}=await db.from("event_tasting_participants").delete().in("id",removeIds);if(removeError)throw removeError;}

   const participantIds=new Map<number,string>();
   for(const p of people){
    const {data:row,error:pe}=await db.from("event_tasting_participants").upsert({tasting_id:t.id,slot:p.slot,name:p.name},{onConflict:"tasting_id,slot"}).select("id").single();
    if(pe) throw pe; participantIds.set(p.slot,row.id);
   }
   for(const r of submitted){
    const drinkId=String(r?.tasting_drink_id||""); const slot=Number(r?.slot); const score=Number(r?.score);
    if(!allowedIds.has(drinkId)||!participantIds.has(slot)||!Number.isFinite(score)||score<1||score>10) continue;
    const comment=String(r?.comment||"").trim().slice(0,1000)||null;
    const {error:re}=await db.from("event_tasting_ratings").upsert({tasting_id:t.id,tasting_drink_id:drinkId,participant_id:participantIds.get(slot),score,comment},{onConflict:"tasting_drink_id,participant_id"});
    if(re) throw re;
   }
   const {error:finishError}=await db.from("event_tastings").update({status:"finalized",guest_observations:observations}).eq("id",t.id);
   if(finishError) throw finishError;
   return out({success:true,status:"finalized"});
  }
  return out({error:"Ação inválida."},400);
 }catch(e){console.error(e);return out({error:"Não foi possível processar a degustação."},500)}
});
