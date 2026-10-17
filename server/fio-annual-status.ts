import { createClient,type SupabaseClient } from '@supabase/supabase-js';
import type { TenantContext } from './context.js';
import { ApiError,dbError } from './errors.js';
import { annualDraftStorageEnabled } from './fio-annual-store.js';

const states=new Set(['preparing','submitting','checkout_ready','review','paid','failed','cancelled','refunded']);
const plans=new Set(['SOLO','SOLO_PREMIUM','PRO','PREMIUM']);

export type AnnualStatusRow={
 id:string;barbershop_id:string;plan_code:string;billing_cycle:string;currency:string;
 base_amount_cents:number;state:string;created_at:string;
 provider_order_id:string|null;verified_at:string|null;paid_at:string|null;
 access_starts_at:string|null;access_ends_at:string|null;
 checkout_url?:string|null;external_id?:string;
};

function serviceDb(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new ApiError(503,'SETUP_REQUIRED','Conexao segura indisponivel.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

const noOrder={
 state:'none' as const,checkoutEnabled:false,automaticRenewal:false,
 paymentVerificationRecorded:false,accessEndsAt:null,
 message:'Nenhum pedido anual registrado.'
};

function validIso(value:string|null){
 return Boolean(value&&Number.isFinite(Date.parse(value)));
}

/** Read-only public projection. A database record is not a payment-provider lookup. */
export function annualStatusView(row:AnnualStatusRow|null,shopId:string){
 if(!row)return noOrder;
 // Fail closed on broken tenant scoping rather than exposing another shop's order.
 if(row.barbershop_id!==shopId)throw new ApiError(503,'ANNUAL_ORDER_SCOPE_ERROR','Nao foi possivel consultar o pedido.');
 const valid=plans.has(row.plan_code)&&row.billing_cycle==='annual'&&row.currency==='BRL'&&
  Number.isSafeInteger(row.base_amount_cents)&&row.base_amount_cents>0&&validIso(row.created_at);
 const complete=row.state==='paid'&&Boolean(row.provider_order_id)&&
  validIso(row.verified_at)&&validIso(row.paid_at)&&
  validIso(row.access_starts_at)&&validIso(row.access_ends_at)&&
  Date.parse(row.access_ends_at??'')>Date.parse(row.access_starts_at??'');
 const state=valid&&states.has(row.state)&&!(row.state==='paid'&&!complete)?row.state:'review';
 const recorded=state==='paid'&&complete;
 return {
  orderId:row.id,plan:valid?row.plan_code:null,
  cycle:'annual' as const,baseAmountCents:valid?row.base_amount_cents:null,
  state,checkoutEnabled:false,automaticRenewal:false,
  // Informational ONLY. Do not use this response to grant entitlements.
  paymentVerificationRecorded:recorded,
  accessEndsAt:recorded?row.access_ends_at:null,
  message:state==='paid'
   ?'Pagamento registrado. O acesso deve ser conferido no estado da assinatura.'
   :state==='review'
    ?'Pedido necessita conferencia. Nao tente pagar novamente.'
    :'O pedido nao comprova pagamento. Nenhum acesso foi liberado por esta consulta.'
 };
}

/** OWNER-scoped, read-only status. The annual migration and drafts gate must be enabled first. */
export async function getAnnualOrderStatus(ctx:TenantContext,providedDb?:SupabaseClient){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Somente o responsavel pode consultar o pedido anual.');
 if(!annualDraftStorageEnabled())return {
  ...noOrder,state:'disabled' as const,
  message:'Pedidos anuais ainda nao estao habilitados. Nenhuma cobranca foi iniciada.'
 };
 const db=providedDb??serviceDb();
 const result=await db.from('fio_annual_orders')
  .select('id,barbershop_id,plan_code,billing_cycle,currency,base_amount_cents,state,created_at,provider_order_id,verified_at,paid_at,access_starts_at,access_ends_at')
  .eq('barbershop_id',ctx.shopId)
  .order('created_at',{ascending:false}).limit(1).maybeSingle();
 dbError(result.error);
 return annualStatusView(result.data as AnnualStatusRow|null,ctx.shopId);
}
