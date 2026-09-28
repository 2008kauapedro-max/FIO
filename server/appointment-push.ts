import webpush from 'web-push';
import type {SupabaseClient} from '@supabase/supabase-js';
import {validPushEndpoint,publicPushConfig} from './platform-push.js';
import {dbError} from './errors.js';

type Delivery={queueId:string;deviceId:string;endpoint:string;keys:{p256dh:string;auth:string};tag:string;url:string;kind:string};
export async function dispatchAppointmentPush(db:SupabaseClient,send:typeof webpush.sendNotification=webpush.sendNotification){
 if(!publicPushConfig().configured)return {configured:false,sent:0,failed:0};
 const claim=await db.rpc('claim_appointment_push');dbError(claim.error);
 let sent=0,failed=0;
 for(const d of (claim.data??[]) as Delivery[]){
  let status='sent';
  try{
   if(!validPushEndpoint(d.endpoint)){status='expired';throw Error('INVALID_ENDPOINT');}
   const body=d.kind==='reminder'?'Você tem um horário nas próximas 24 horas. Abra a agenda.':'Há uma atualização na sua agenda. Abra para conferir.';
   await send({endpoint:d.endpoint,keys:d.keys},JSON.stringify({title:'Sua agenda',body,tag:d.tag,url:d.url}),{vapidDetails:{publicKey:process.env.VAPID_PUBLIC_KEY!,privateKey:process.env.VAPID_PRIVATE_KEY!,subject:process.env.VAPID_SUBJECT!},TTL:300,timeout:5000,urgency:'normal'});sent++;
  }catch(e){failed++;status=status==='expired'||[404,410].includes((e as {statusCode?:number}).statusCode??0)?'expired':'failed';}
  const result=await db.rpc('finish_appointment_push',{p_queue:d.queueId,p_device:d.deviceId,p_status:status});dbError(result.error);
 }
 return {configured:true,sent,failed};
}
