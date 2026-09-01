import { numberToWordsBRL } from "./number-to-words-brl";

export interface BudgetVersionData {
  id?: string; final_budget_value?: number | null; guest_count?: number | null; guests?: number | null;
  average_value_per_person?: number | null; value_per_person?: number | null; selected_drinks?: any;
  beverages?: any; paid_value?: number | null; payment_method?: string | null;
  pending_payment_date?: string | null; event_snapshot?: any; [key: string]: any;
}
export interface DrinkComparisonResult { changed:boolean; previousDrinks:string[]; currentDrinks:string[]; added:string[]; removed:string[]; maintained:string[]; finalListText:string }
export interface ContractualChange { key:string; label:string; previous:unknown; current:unknown; category:string }
export interface ContractAddendumComparison {
  requiresAddendum:boolean; drinks:DrinkComparisonResult;
  totalValue:{changed:boolean;previous:number;current:number;difference:number;currentFormatted:string;currentWords:string};
  extraGuestValue:{changed:boolean;previous:number;current:number;currentFormatted:string;currentWords:string};
  guestCount:{changed:boolean;previous:number|null;current:number|null};
  changes:ContractualChange[]; resumo_alteracoes:string;
  valor_total_anterior:number; valor_total_novo:number; valor_diferenca:number; valor_ja_pago:number|null;
  saldo_anterior:number|null; novo_saldo_restante:number|null; credito_cliente:number|null;
  forma_pagamento_saldo:string|null; meio_pagamento_saldo:string|null; datas_vencimento:string[];
  financial:{currentTotal:number;paidAmount:number|null;remainingBalance:number|null;previousBalance:number|null;hasExcessPaymentCredit:boolean;creditAmount:number;paymentCondition:string|null;paymentMethod:string|null;dueDates:string[];dueDate:string};
}

export function formatPortugueseList(items:string[]):string { if(!items?.length)return ""; if(items.length===1)return items[0]; return `${items.slice(0,-1).join(", ")} e ${items.at(-1)}`; }
export function extractDrinksList(budget:BudgetVersionData):string[] {
  const out:string[]=[]; const add=(x:any)=>{ const n=typeof x==="string"?x:x?.name||x?.nome||x?.drink_name||x?.beverage_name||x?.titulo; if(typeof n==="string"&&n.trim())out.push(n.trim()) };
  const read=(v:any)=> Array.isArray(v)?v.forEach(add):Array.isArray(v?.items)?v.items.forEach(add):undefined;
  read(budget.selected_drinks); read(budget.beverages);
  return out.filter((v,i,a)=>a.findIndex(x=>x.toLocaleLowerCase("pt-BR")===v.toLocaleLowerCase("pt-BR"))===i);
}
export function calculateExtraGuestValue(b:BudgetVersionData):number { const direct=Number(b.average_value_per_person||b.value_per_person||0); if(direct>0)return direct; const t=Number(b.final_budget_value||0),g=Number(b.guest_count||b.guests||0); return t>0&&g>0?Math.round(t/g*100)/100:0; }
const fmt=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const stable=(v:any):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.keys(x).sort().reduce((a,k)=>(a[k]=x[k],a),{} as any):x);
const same=(a:any,b:any)=>typeof a==="number"||typeof b==="number"?Math.abs(Number(a||0)-Number(b||0))<=.01:stable(a??null)===stable(b??null);
const field=(b:BudgetVersionData,...keys:string[])=>{ for(const k of keys){ if(k.includes(".")){const [p,c]=k.split("."); if(b[p]?.[c]!==undefined)return b[p][c]} else if(b[k]!==undefined)return b[k] } return null };

const RELEVANT=[
  ["guest_count","Convidados","evento",["guest_count","guests","event_snapshot.guest_count","event_snapshot.guests"]],
  ["duration","Duração","evento",["duration_hours","event_snapshot.duration_hours","event_snapshot.duration"]],
  ["event_date","Data do evento","evento",["event_date","date","event_snapshot.date","event_snapshot.event_date"]],
  ["location","Local do evento","evento",["location","event_snapshot.location","event_snapshot.venue"]],
  ["city","Cidade","evento",["city","event_snapshot.city"]],
  ["miscellaneous_items","Adicionais","comercial",["miscellaneous_items"]],
  ["team","Equipe/mão de obra","comercial",["bartender_quantity","keeper_quantity","copeira_quantity","team_total_value"]],
  ["welcome_drinks","Welcome drinks","comercial",["has_welcome_drinks","welcome_drinks_selected","welcome_drinks_final_value"]],
  ["shots","Shots","comercial",["has_shots","shots_items","shots_total_value"]],
  ["ice","Gelo","comercial",["ice_packages_quantity","ice_total_value"]],
  ["travel","Deslocamento","comercial",["has_travel","fuel_value"]],
  ["discount","Desconto","financeiro",["discount_value","discount_description"]],
] as const;

export function compareContractVersions(base:BudgetVersionData,current:BudgetVersionData):ContractAddendumComparison {
  const prevDrinks=extractDrinksList(base),curDrinks=extractDrinksList(current),ps=new Set(prevDrinks.map(x=>x.toLowerCase())),cs=new Set(curDrinks.map(x=>x.toLowerCase()));
  const added=curDrinks.filter(x=>!ps.has(x.toLowerCase())),removed=prevDrinks.filter(x=>!cs.has(x.toLowerCase())),drinksChanged=!!(added.length||removed.length);
  const previous=Number(base.final_budget_value||0),next=Number(current.final_budget_value||0),difference=next-previous,totalChanged=!same(previous,next);
  const pe=calculateExtraGuestValue(base),ce=calculateExtraGuestValue(current),extraChanged=!same(pe,ce);
  const changes:ContractualChange[]=[];
  if(drinksChanged)changes.push({key:"drinks",label:"Drinks/bebidas",previous:prevDrinks,current:curDrinks,category:"comercial"});
  if(totalChanged)changes.push({key:"total_value",label:"Valor total",previous,current:next,category:"financeiro"});
  if(extraChanged)changes.push({key:"extra_guest_value",label:"Valor por convidado excedente",previous:pe,current:ce,category:"financeiro"});
  for(const [key,label,category,keys] of RELEVANT){ const a=keys.map(k=>field(base,k)),b=keys.map(k=>field(current,k)); if(!same(a,b))changes.push({key,label,previous:a.length===1?a[0]:a,current:b.length===1?b[0]:b,category}); }
  const paidRaw=current.paid_value ?? base.paid_value; const paid=paidRaw===null||paidRaw===undefined?null:Number(paidRaw);
  const remaining=paid===null?null:Math.max(next-paid,0),previousBalance=paid===null?null:Math.max(previous-paid,0),credit=paid===null?0:Math.max(paid-next,0);
  const rawPayment=String(current.payment_method||base.payment_method||"").trim(); const condition=/parcel|\d+x/i.test(rawPayment)?"Parcelado":/vista/i.test(rawPayment)?"À vista":null;
  const method=(rawPayment.match(/pix|transfer[eê]ncia|cart[aã]o|boleto/i)?.[0]||"").replace(/^pix$/i,"PIX")||null;
  const due=String(current.pending_payment_date||base.pending_payment_date||"").trim(); const dueDates=due?due.split(/\s*(?:,|;|\se\s)\s*/).filter(Boolean):[];
  const guest=changes.find(x=>x.key==="guest_count"); const summary=changes.map(x=>x.key==="drinks"?`Drinks: adicionados ${formatPortugueseList(added)||"nenhum"}; removidos ${formatPortugueseList(removed)||"nenhum"}`:`${x.label}: alterado`).join("; ");
  return { requiresAddendum:changes.length>0,drinks:{changed:drinksChanged,previousDrinks:prevDrinks,currentDrinks:curDrinks,added,removed,maintained:curDrinks.filter(x=>ps.has(x.toLowerCase())),finalListText:formatPortugueseList(curDrinks)},
    totalValue:{changed:totalChanged,previous,current:next,difference,currentFormatted:fmt(next),currentWords:numberToWordsBRL(next)},extraGuestValue:{changed:extraChanged,previous:pe,current:ce,currentFormatted:fmt(ce),currentWords:numberToWordsBRL(ce)},
    guestCount:{changed:!!guest,previous:Number(field(base,"guest_count","guests")??0)||null,current:Number(field(current,"guest_count","guests")??0)||null},changes,resumo_alteracoes:summary,
    valor_total_anterior:previous,valor_total_novo:next,valor_diferenca:difference,valor_ja_pago:paid,saldo_anterior:previousBalance,novo_saldo_restante:remaining,credito_cliente:paid===null?null:credit,forma_pagamento_saldo:condition,meio_pagamento_saldo:method,datas_vencimento:dueDates,
    financial:{currentTotal:next,paidAmount:paid,remainingBalance:remaining,previousBalance,hasExcessPaymentCredit:credit>0,creditAmount:credit,paymentCondition:condition,paymentMethod:method,dueDates,dueDate:dueDates.join(" e ")} };
}
