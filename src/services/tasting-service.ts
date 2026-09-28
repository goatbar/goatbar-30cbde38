import { supabase } from "@/integrations/supabase/client";
import type { Drink } from "@/lib/mock-data";
import { exportTastingPublicPagePdf } from "@/lib/tasting-pdf";
const db = supabase as any;

export const TASTING_LOCATION = "Base da Goat Bar";
export type TastingStatus = "planning" | "scheduled" | "completed" | "finalized" | "cancelled";
export interface Tasting { id:string; event_id:string; status:TastingStatus; scheduled_at:string|null; duration_minutes:number; location:string|null; notes:string|null; guest_observations:string|null; public_token:string; public_enabled:boolean; google_calendar_sync_status:string; google_calendar_html_link:string|null; }
export interface TastingDrink { id:string; tasting_id:string; drink_id:string; display_order:number; drink_name:string; drink_description:string|null; drink_image:string|null; selected_for_event:boolean; bride_drink:boolean; groom_drink:boolean; }
export interface TastingParticipant { id:string; tasting_id:string; slot:number; name:string|null; }
export interface TastingRating { id:string; tasting_id:string; tasting_drink_id:string; participant_id:string; score:number; comment:string|null; }
export interface TastingBundle { tasting:Tasting; drinks:TastingDrink[]; participants:TastingParticipant[]; ratings:TastingRating[]; }

export const tastingService={
 async list(eventId:string){const {data,error}=await db.from("event_tastings").select("*").eq("event_id",eventId).order("created_at",{ascending:false});if(error)throw error;return (data||[]) as Tasting[]},
 async get(id:string):Promise<TastingBundle>{const [{data:t,error},{data:d},{data:p},{data:r}]=await Promise.all([db.from("event_tastings").select("*").eq("id",id).single(),db.from("event_tasting_drinks").select("*").eq("tasting_id",id).order("display_order"),db.from("event_tasting_participants").select("*").eq("tasting_id",id).order("slot"),db.from("event_tasting_ratings").select("*").eq("tasting_id",id)]);if(error)throw error;return{tasting:t as Tasting,drinks:(d||[]) as TastingDrink[],participants:(p||[]) as TastingParticipant[],ratings:(r||[]) as TastingRating[]}},
 async create(eventId:string){const {data,error}=await db.from("event_tastings").insert({event_id:eventId,location:TASTING_LOCATION}).select("*").single();if(error)throw error;return data as Tasting},
 async update(id:string,payload:Partial<Tasting>){const next={...payload};if("scheduled_at" in next)(next as any).google_calendar_sync_status=next.scheduled_at?"pending":"not_synced";if(next.scheduled_at)(next as any).location=TASTING_LOCATION;const {data,error}=await db.from("event_tastings").update(next).eq("id",id).select("*").single();if(error)throw error;return data as Tasting},
 async setDrinks(tastingId:string,drinks:Drink[]){const {data:existing,error:readError}=await db.from("event_tasting_drinks").select("id,drink_id").eq("tasting_id",tastingId);if(readError)throw readError;const byDrink=new Map<string,any>((existing||[]).map((x:any)=>[x.drink_id,x]));const wanted=new Set(drinks.map(d=>d.id));const remove=(existing||[]).filter((x:any)=>!wanted.has(x.drink_id)).map((x:any)=>x.id);if(remove.length){const {error}=await db.from("event_tasting_drinks").delete().in("id",remove);if(error)throw error}for(let i=0;i<drinks.length;i++){const d=drinks[i],row=byDrink.get(d.id);const payload={display_order:i,drink_name:d.nome,drink_description:d.descricao||null,drink_image:d.imagem||null};if(row){const {error}=await db.from("event_tasting_drinks").update(payload).eq("id",row.id);if(error)throw error}else{const {error}=await db.from("event_tasting_drinks").insert({tasting_id:tastingId,drink_id:d.id,...payload});if(error)throw error}}},
 async syncCalendar(tastingId:string){const {data,error}=await supabase.functions.invoke("tasting-calendar-sync",{body:{tastingId}});if(error||!data?.success)throw new Error(data?.error||error?.message||"Falha ao sincronizar degustação.");return data},
 async finalize(id:string){return this.update(id,{status:"finalized"} as Partial<Tasting>)},
 ranking(bundle:TastingBundle){return bundle.drinks.map(d=>{const rs=bundle.ratings.filter(r=>r.tasting_drink_id===d.id);const average=rs.length?rs.reduce((s,r)=>s+Number(r.score),0)/rs.length:0;return{...d,average,count:rs.length,comments:rs.filter(r=>r.comment).map(r=>r.comment as string)}}).sort((a,b)=>b.average-a.average||a.display_order-b.display_order)},
 async applySelectedToEvent(eventId:string,bundle:TastingBundle){const selected=bundle.drinks.filter(d=>d.selected_for_event).map(d=>d.drink_id);const {error}=await db.from("events").update({drinks:selected,updated_at:new Date().toISOString()}).eq("id",eventId);if(error)throw error},
 async toggleSelected(drinkId:string,selected:boolean){const {error}=await db.from("event_tasting_drinks").update({selected_for_event:selected}).eq("id",drinkId);if(error)throw error},
 async downloadPdf(bundle:TastingBundle,eventName:string){await exportTastingPublicPagePdf(bundle.tasting.public_token,eventName)}
};
