import {demoData} from '../../src/lib/demo';
import type {Role} from '../../shared/domain';
const role=(new URLSearchParams(location.search).get('role')||'OWNER') as Role;
const data=demoData(role);
const scenario=new URLSearchParams(location.search).get('scenario');
if(scenario==='empty'){data.appointments=[];data.customers=[];}
if(scenario==='long'){
 data.customers.forEach(c=>c.name+=' de Albuquerque e Vasconcelos — nome extenso para validação');
 data.services[0].name='Corte e acabamento com descrição extensa para testar a leitura';
 data.appointments=Array.from({length:30},(_,i)=>({...data.appointments[i%data.appointments.length],id:`many-${i}`}));
}
let attempts=0;
export class RequestError extends Error{constructor(public code:string,message:string){super(message);}}
const session={user:{id:data.membership.user_id,email:'teste@example.test'}};
export const supabase={storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'/FIOlogo/FIObranco.png'}})})},auth:{getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:session.user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})}};
export function setRememberSession(){}
export function getRememberSession(){return true;}
export async function api<T>(path:string,_shop?:string,body?:unknown):Promise<T>{
 if(path==='/memberships')return [data.membership] as T;
 if(path==='/bootstrap')return data as T;
 if(path==='/onboarding/progress')return {shop:{onboarding_completed:true}} as T;
 if(path==='/saas/billing')return {configured:true,subscription:null} as T;
 if(path==='/support/feedback'&&body)return {ok:true} as T;
 if(path==='/conversations')return [{id:'history',title:'Minha agenda — conversa de teste'}] as T;
 if(path==='/conversations/history')return Array.from({length:30},(_,i)=>({id:String(i),role:i%2?'assistant':'user',content:'Conversa fictícia para testar a rolagem. '+('Texto longo, horários e orientações. '.repeat(12))})) as T;
 if(path==='/assistant'){
  await new Promise(resolve=>setTimeout(resolve,500));
  if(scenario==='error'&&attempts++===0)throw new RequestError('AI_UNAVAILABLE','Não foi possível responder. Tente novamente.');
  return {conversationId:'history',message:'Resposta fictícia de teste.\n\n**Sua agenda**\n- Confira os horários na agenda.\n- Abra um atendimento para ver os detalhes.'} as T;
 }
 if(path.startsWith('/slots?')){const day=new URLSearchParams(path.split('?')[1]).get('day');return ['09:00','10:30','14:00'].map(t=>({starts_at:new Date(`${day}T${t}:00-03:00`).toISOString()})) as T;}
 if(path==='/appointments'&&body){const b=body as any;const service=data.services.find(s=>s.id===b.serviceId)!;data.appointments.push({id:crypto.randomUUID(),client_id:b.clientId,barber_id:b.barberId,service_id:b.serviceId,starts_at:b.startsAt,ends_at:new Date(+new Date(b.startsAt)+service.duration_minutes*60000).toISOString(),price_cents:service.price_cents,status:'scheduled'});return {ok:true} as T;}
 throw new Error('Fixture does not implement '+path);
}
