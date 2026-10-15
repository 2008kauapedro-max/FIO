import { randomUUID } from 'node:crypto';
import { createClient,type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { TenantContext } from './context.js';
import { ApiError,dbError } from './errors.js';
import { buildAnnualDraft,type AnnualMode } from '../shared/fio-annual-orders.js';

const inputSchema=z.object({plan:z.enum(['SOLO','SOLO_PREMIUM','PRO','PREMIUM'])}).strict();
const openStates=['preparing','checkout_ready','review'] as const;
type AnnualRow={
 id:string;barbershop_id:string;actor_user_id:string;plan_code:string;
 base_amount_cents:number;state:string;created_at:string;
};

/** This flag only allows persisting an unpaid draft. It cannot initiate a charge. */
export function annualDraftStorageEnabled(){
 return process.env.FIO_ENABLE_ANNUAL_ORDER_DRAFTS==='true';
}
function adminDb(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new ApiError(503,'SETUP_REQUIRED','Conexao segura indisponivel.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function publicView(row:AnnualRow){
 return {
  id:row.id,plan:row.plan_code,cycle:'annual' as const,
  baseAmountCents:row.base_amount_cents,state:row.state,
  checkoutEnabled:false,automaticRenewal:false,
  message:'Pedido em preparacao. Nenhuma cobranca foi gerada.'
 };
}
function sameDraft(row:AnnualRow,ctx:TenantContext,plan:string,price:number){
 return row.barbershop_id===ctx.shopId&&row.actor_user_id===ctx.userId&&
  row.plan_code===plan&&row.base_amount_cents===price;
}

/**
 * Creates ONE local, unpaid annual draft per shop. No HTTP calls to SyncPay.
 * Disabled by default and requires the annual-orders migration beforehand.
 * Unique partial DB index protects simultaneous requests from double drafts.
 */
export async function prepareAnnualOrder(
 ctx:TenantContext,raw:unknown,providedDb?:SupabaseClient
){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Somente o responsavel pode contratar.');
 if(!annualDraftStorageEnabled())throw new ApiError(503,'ANNUAL_DRAFTS_DISABLED',
  'O pedido anual ainda nao esta habilitado. Nenhuma cobranca foi criada.');
 const {plan}=inputSchema.parse(raw);
 const shop=await ctx.db.from('barbershops').select('operation_mode').eq('id',ctx.shopId).single();
 dbError(shop.error);
 const mode=shop.data?.operation_mode;
 if(mode!=='SHOP'&&mode!=='SOLO')throw new ApiError(409,'ANNUAL_INVALID_MODE','Modo de barbearia invalido.');
 let draft;
 try{draft=buildAnnualDraft({orderId:randomUUID(),shopId:ctx.shopId,plan,mode:mode as AnnualMode});}
 catch(e){if(e instanceof Error&&e.message==='ANNUAL_PLAN_MODE_MISMATCH')
   throw new ApiError(400,'INVALID_PLAN','Escolha um plano compativel com a barbearia.');
  throw e;
 }
 // Recheck active monthly/other contracts; a FREE snapshot by itself is insufficient.
 const db=providedDb??adminDb();
 const [base,provider,hosted]=await Promise.all([
  db.from('saas_subscriptions').select('status,expires_at').eq('barbershop_id',ctx.shopId).maybeSingle(),
  db.from('saas_provider_subscriptions').select('id').eq('barbershop_id',ctx.shopId)
   .eq('is_current',true).in('provider_status',['active','pending_first_payment','overdue','suspended'])
   .limit(1).maybeSingle(),
  db.from('fio_hosted_checkout_intents').select('id').eq('barbershop_id',ctx.shopId)
   .in('state',['creating','ready']).limit(1).maybeSingle()
 ]);
 dbError(base.error);dbError(provider.error);dbError(hosted.error);
 const baseActive=base.data&&['active','trialing'].includes(base.data.status)&&
  (!base.data.expires_at||Date.parse(base.data.expires_at)>Date.now());
 if(baseActive||provider.data||hosted.data)throw new ApiError(409,'ANNUAL_CONTRACT_CONFLICT',
  'Existe assinatura ou checkout em andamento. Confira antes de criar um pedido anual.');

 const findOpen=async()=>{
  const found=await db.from('fio_annual_orders').select('id,barbershop_id,actor_user_id,plan_code,base_amount_cents,state,created_at')
   .eq('barbershop_id',ctx.shopId).in('state',[...openStates])
   .order('created_at',{ascending:false}).limit(1).maybeSingle();
  dbError(found.error);
  return found.data as AnnualRow|null;
 };
 const open=await findOpen();
 if(open){
  if(!sameDraft(open,ctx,plan,draft.baseAmountCents))throw new ApiError(409,'ANNUAL_ORDER_PENDING',
   'Ja existe um pedido anual em andamento. Consulte o suporte antes de escolher outro plano.');
  return publicView(open);
 }
 // Do not send to SyncPay. This insert is local and explicitly marked preparing.
 const row={id:draft.orderId,barbershop_id:ctx.shopId,actor_user_id:ctx.userId,
  external_id:draft.externalId,plan_code:draft.plan,billing_cycle:'annual',
  base_amount_cents:draft.baseAmountCents,currency:'BRL',
  installments_max:12,installment_fees_payer:'customer',state:'preparing'};
 const inserted=await db.from('fio_annual_orders').insert(row)
  .select('id,barbershop_id,actor_user_id,plan_code,base_amount_cents,state,created_at').single();
 if(inserted.error?.code==='23505'){
  // Concurrent request won. Never create a second order as a workaround.
  const winner=await findOpen();
  if(winner&&sameDraft(winner,ctx,plan,draft.baseAmountCents))return publicView(winner);
  throw new ApiError(409,'ANNUAL_ORDER_PENDING','Ja existe um pedido anual em andamento.');
 }
 dbError(inserted.error);
 if(!inserted.data)throw new ApiError(503,'DATABASE_UNAVAILABLE','Nao foi possivel preparar o pedido.');
 return publicView(inserted.data as AnnualRow);
}
