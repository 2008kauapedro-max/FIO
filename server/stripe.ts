import Stripe from 'stripe';
import { createHash,randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Request,Response as ExpressResponse } from 'express';
import { z } from 'zod';
import type { TenantContext } from './context.js';
import { ApiError,dbError } from './errors.js';
import { FIO_PLAN_CATALOG,fioPlanPublicName } from '../shared/fio-plans.js';

const PAID_PLANS=['SOLO','SOLO_PREMIUM','PRO','PREMIUM'] as const;
const SALE_CYCLES=['monthly','annual'] as const;
const STRIPE_RELEVANT_EVENTS=new Set([
 'checkout.session.completed',
 'customer.subscription.created',
 'customer.subscription.updated',
 'customer.subscription.deleted',
 'invoice.paid',
 'invoice.payment_failed'
]);

type PaidPlan=typeof PAID_PLANS[number];
type SaleCycle=typeof SALE_CYCLES[number];
type ProviderStatus='pending_first_payment'|'active'|'overdue'|'suspended'|'cancelled';

const checkoutInput=z.object({
 plan:z.enum(PAID_PLANS),
 cycle:z.enum(SALE_CYCLES),
 acceptedTerms:z.literal(true)
}).strict();

const fioMetadataSchema=z.object({
 fio_shop_id:z.uuid(),
 fio_user_id:z.uuid(),
 fio_plan:z.enum(PAID_PLANS),
 fio_cycle:z.enum(SALE_CYCLES),
 fio_amount_cents:z.string().regex(/^\d{1,12}$/),
 fio_terms_version:z.string().min(3).max(80)
}).passthrough();

function adminDb(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new ApiError(503,'SETUP_REQUIRED','A configuracao segura do servidor ainda nao foi concluida.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function stripeKey(){
 const key=process.env.STRIPE_SECRET_KEY?.trim();
 if(!key||!(/^(?:sk|rk)_(?:test|live)_/.test(key)))
  throw new ApiError(503,'STRIPE_NOT_CONFIGURED','O pagamento por cartao ainda nao esta disponivel.');

 if(process.env.NODE_ENV!=='production'&&/^(?:sk|rk)_live_/.test(key))
  throw new ApiError(503,'STRIPE_LIVE_KEY_BLOCKED','A chave Stripe de producao nao pode ser usada no ambiente de desenvolvimento.');

 return key;
}

function stripeClient(){
 return new Stripe(stripeKey());
}

export function stripeCheckoutConfigured(){
 const key=process.env.STRIPE_SECRET_KEY?.trim()??'';
 if(!/^(?:sk|rk)_(?:test|live)_/.test(key))return false;
 if(process.env.NODE_ENV!=='production'&&/^(?:sk|rk)_live_/.test(key))return false;
 return true;
}

function webhookSecret(){
 const secret=process.env.STRIPE_WEBHOOK_SECRET?.trim();
 if(!secret||!secret.startsWith('whsec_'))
  throw new ApiError(503,'STRIPE_WEBHOOK_NOT_CONFIGURED','O webhook seguro da Stripe ainda nao foi configurado.');
 return secret;
}

function planConfig(plan:PaidPlan,cycle:SaleCycle){
 const definition=FIO_PLAN_CATALOG.find(item=>item.code===plan);
 const amount=definition?.prices[cycle];

 if(!definition||definition.proposal||amount==null||amount<=0)
  throw new ApiError(400,'INVALID_PLAN','Escolha um plano pago valido.');

 return {
  plan,
  cycle,
  amountCents:amount,
  interval:(cycle==='monthly'?'month':'year') as 'month'|'year',
  publicName:fioPlanPublicName(plan)
 };
}

function publicOrigin(){
 const configured=process.env.FIO_PUBLIC_URL?.trim();

 if(configured){
  let url:URL;
  try{url=new URL(configured);}
  catch{throw new ApiError(503,'STRIPE_RETURN_URL_INVALID','A URL publica do FIO esta configurada incorretamente.');}

  const local=['localhost','127.0.0.1'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&local))
   throw new ApiError(503,'STRIPE_RETURN_URL_INVALID','A URL publica do FIO precisa usar HTTPS.');

  return url.origin;
 }

 if(process.env.NODE_ENV!=='production')
  return 'http://127.0.0.1:5173';

 throw new ApiError(503,'STRIPE_RETURN_URL_REQUIRED','A URL publica do FIO ainda nao foi configurada.');
}

export function normalizeStripeStatus(status:string):ProviderStatus{
 if(status==='active'||status==='trialing')return 'active';
 if(status==='past_due')return 'overdue';
 if(status==='unpaid'||status==='paused')return 'suspended';
 if(status==='canceled'||status==='incomplete_expired')return 'cancelled';
 if(status==='incomplete')return 'pending_first_payment';
 throw new ApiError(503,'STRIPE_STATUS_UNKNOWN','A Stripe retornou um estado de assinatura ainda nao reconhecido.');
}

function asRecord(value:unknown):Record<string,unknown>|null{
 return value&&typeof value==='object'?value as Record<string,unknown>:null;
}

function objectId(value:unknown,prefix:string){
 if(typeof value==='string'&&value.startsWith(prefix))return value;
 const record=asRecord(value),id=record?.id;
 return typeof id==='string'&&id.startsWith(prefix)?id:null;
}

export function subscriptionIdFromEvent(event:Stripe.Event){
 if(event.type==='checkout.session.completed'){
  const session=event.data.object as Stripe.Checkout.Session;
  return objectId(session.subscription,'sub_');
 }

 if(
  event.type==='customer.subscription.created'||
  event.type==='customer.subscription.updated'||
  event.type==='customer.subscription.deleted'
 ){
  return objectId(event.data.object,'sub_');
 }

 if(event.type==='invoice.paid'||event.type==='invoice.payment_failed'){
  const invoice=asRecord(event.data.object);
  const direct=objectId(invoice?.subscription,'sub_');
  if(direct)return direct;

  const parent=asRecord(invoice?.parent);
  const details=asRecord(parent?.subscription_details);
  return objectId(details?.subscription,'sub_');
 }

 return null;
}

function epoch(value:number|null|undefined){
 if(typeof value!=='number'||!Number.isFinite(value)||value<=0)return null;
 return new Date(value*1000).toISOString();
}

export function buildStripeCheckoutParams(
 plan:PaidPlan,
 cycle:SaleCycle,
 shopId:string,
 userId:string,
 email:string,
 origin:string
):Stripe.Checkout.SessionCreateParams{
 const config=planConfig(plan,cycle);
 const metadata={
  fio_shop_id:shopId,
  fio_user_id:userId,
  fio_plan:plan,
  fio_cycle:cycle,
  fio_amount_cents:String(config.amountCents),
  fio_terms_version:'fio-subscription-v2'
 };

 return {
  mode:'subscription',
  locale:'auto',
  client_reference_id:shopId,
  customer_email:email,
  adaptive_pricing:{enabled:true},
  payment_method_types:['card'],
  line_items:[{
   quantity:1,
   price_data:{
    currency:'brl',
    unit_amount:config.amountCents,
    recurring:{interval:config.interval},
    product_data:{
     name:config.publicName,
     description:`Assinatura ${config.publicName} - ${cycle==='monthly'?'mensal':'anual'}`
    }
   }
  }],
  metadata,
  subscription_data:{metadata},
  success_url:`${origin}/owner/plano-fio?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:`${origin}/owner/plano-fio?stripe=cancelled`
 };
}

export async function createStripeCheckoutSession(ctx:TenantContext,raw:unknown){
 if(ctx.member.role!=='OWNER')
  throw new ApiError(403,'FORBIDDEN','Esta acao e exclusiva do responsavel pela barbearia.');

 const input=checkoutInput.parse(raw);

 const modeResult=await ctx.db
  .from('barbershops')
  .select('operation_mode')
  .eq('id',ctx.shopId)
  .single();

 dbError(modeResult.error);

 if(!modeResult.data)
  throw new ApiError(404,'INVALID_SHOP','Barbearia nao encontrada.');

 const operationMode=modeResult.data.operation_mode as 'SHOP'|'SOLO';

 if(operationMode==='SOLO'&&input.plan!=='SOLO'&&input.plan!=='SOLO_PREMIUM')
  throw new ApiError(400,'INVALID_PLAN','No modo solo, escolha FIO PRO ou FIO PREMIUM.');

 if(operationMode!=='SOLO'&&(input.plan==='SOLO'||input.plan==='SOLO_PREMIUM'))
  throw new ApiError(400,'INVALID_PLAN','Os planos solo sao exclusivos para quem trabalha sozinho.');

 const db=adminDb();

 const existing=await db
  .from('saas_provider_subscriptions')
  .select('provider,provider_status,plan_code,billing_cycle')
  .eq('barbershop_id',ctx.shopId)
  .eq('is_current',true)
  .maybeSingle();

 dbError(existing.error);

 if(existing.data&&['pending_first_payment','active','overdue','suspended'].includes(String(existing.data.provider_status)))
  throw new ApiError(409,'BILLING_SUBSCRIPTION_EXISTS','Ja existe uma assinatura ou cobranca em andamento. Consulte a cobranca atual antes de criar outra.');

 const user=await db.auth.admin.getUserById(ctx.userId);
 const email=user.data.user?.email?.trim().toLowerCase();

 if(user.error||!email)
  throw new ApiError(400,'BILLING_EMAIL_REQUIRED','Sua conta precisa de um e-mail valido para assinar o FIO.');

 const origin=publicOrigin();
 const stripe=stripeClient();
 const params=buildStripeCheckoutParams(input.plan,input.cycle,ctx.shopId,ctx.userId,email,origin);

 let session:Stripe.Checkout.Session;
 try{
  session=await stripe.checkout.sessions.create(
   params,
   {idempotencyKey:`fio-checkout-v2:${ctx.shopId}:${ctx.userId}:${randomUUID()}`}
  );
 }catch{
  throw new ApiError(503,'STRIPE_UNAVAILABLE','Nao foi possivel abrir o pagamento por cartao agora. Tente novamente em instantes.');
 }

 if(!session.url)
  throw new ApiError(503,'STRIPE_INVALID_RESPONSE','A Stripe nao retornou o endereco seguro de pagamento.');

 return {
  configured:true,
  provider:'stripe' as const,
  sessionId:session.id,
  url:session.url
 };
}

// Somente o vinculo registrado pelo webhook assinado confirma o pagamento.
export async function getStripeBilling(ctx:TenantContext){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Acesso restrito ao responsavel.');
 const result=await adminDb().from('saas_provider_subscriptions')
  .select('provider_status,plan_code,billing_cycle,amount_cents')
  .eq('barbershop_id',ctx.shopId).eq('provider','stripe').eq('is_current',true)
  .maybeSingle();
 dbError(result.error);
 if(!result.data)return null;
 const row=result.data;
 return {
  provider:'stripe' as const,
  providerStatus:String(row.provider_status),
  plan:row.plan_code as PaidPlan,
  cycle:row.billing_cycle as SaleCycle,
  amountCents:Number(row.amount_cents),
  nextChargeAt:null,
  payment:null,
  refund:null
 };
}

// O portal usa a identidade Stripe da propria barbearia, nunca um ID do request.
export async function createStripeBillingPortal(ctx:TenantContext,raw:unknown){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Acesso restrito ao responsavel.');
 z.object({confirmed:z.literal(true)}).strict().parse(raw);
 const result=await adminDb().from('saas_provider_subscriptions')
  .select('provider_customer_token')
  .eq('barbershop_id',ctx.shopId).eq('provider','stripe').eq('is_current',true)
  .maybeSingle();
 dbError(result.error);
 const customer=result.data?.provider_customer_token;
 if(!customer||!/^cus_[A-Za-z0-9]+$/.test(customer))
  throw new ApiError(404,'STRIPE_SUBSCRIPTION_NOT_FOUND','Assinatura Stripe nao localizada.');
 let session:Stripe.BillingPortal.Session;
 try{
  session=await stripeClient().billingPortal.sessions.create({
   customer,
   return_url:publicOrigin()+'/owner/plano-fio'
  });
 }catch{
  throw new ApiError(503,'STRIPE_PORTAL_UNAVAILABLE','Portal Stripe indisponivel. Verifique sua configuracao ou procure o suporte.');
 }
 const url=new URL(session.url);
 if(url.protocol!=='https:'||url.hostname!=='billing.stripe.com')
  throw new ApiError(503,'STRIPE_PORTAL_INVALID','A Stripe retornou um endereco inesperado.');
 return {url:url.toString()};
}

async function applyStripeSubscriptionTruth(db:ReturnType<typeof adminDb>,subscription:Stripe.Subscription,event:Stripe.Event,bodyHash:string){
 const rawMetadata=subscription.metadata??{};

 if(!rawMetadata.fio_shop_id)
  return {ignored:true};

 const parsed=fioMetadataSchema.safeParse(rawMetadata);
 if(!parsed.success)
  throw new ApiError(409,'STRIPE_METADATA_INVALID','A assinatura Stripe nao possui os dados de vinculo esperados pelo FIO.');

 const metadata=parsed.data;
 const config=planConfig(metadata.fio_plan,metadata.fio_cycle);

 if(Number(metadata.fio_amount_cents)!==config.amountCents)
  throw new ApiError(409,'STRIPE_AMOUNT_MISMATCH','O valor-base da assinatura nao corresponde ao catalogo atual do FIO.');

 const item=subscription.items.data[0];
 if(!item?.price?.id)
  throw new ApiError(503,'STRIPE_SUBSCRIPTION_INCOMPLETE','A Stripe nao informou o preco recorrente da assinatura.');

 const recurring=item.price.recurring;
 const expectedInterval=metadata.fio_cycle==='monthly'?'month':'year';

 if(!recurring||recurring.interval!==expectedInterval||recurring.interval_count!==1)
  throw new ApiError(409,'STRIPE_CYCLE_MISMATCH','O periodo recorrente da Stripe nao corresponde ao periodo escolhido no FIO.');

 const providerStatus=normalizeStripeStatus(subscription.status);
 const currentPeriodStart=epoch(item.current_period_start);
 const currentPeriodEnd=epoch(item.current_period_end);
 const customerId=objectId(subscription.customer,'cus_');

 if(!customerId)
  throw new ApiError(503,'STRIPE_CUSTOMER_MISSING','A Stripe nao informou o cliente da assinatura.');

 if((providerStatus==='active'||providerStatus==='overdue')&&!currentPeriodEnd)
  throw new ApiError(503,'STRIPE_PERIOD_MISSING','A Stripe nao informou a validade atual da assinatura.');

 const cancelledAt=providerStatus==='cancelled'
  ?epoch(subscription.canceled_at??subscription.ended_at)??new Date(event.created*1000).toISOString()
  :null;

 const result=await db.rpc('apply_stripe_subscription_state',{
  p_event_id:event.id,
  p_event_type:event.type,
  p_event_created_at:new Date(event.created*1000).toISOString(),
  p_body_sha256:bodyHash,
  p_shop:metadata.fio_shop_id,
  p_actor:metadata.fio_user_id,
  p_subscription_token:subscription.id,
  p_customer_token:customerId,
  p_price_token:item.price.id,
  p_plan_code:metadata.fio_plan,
  p_billing_cycle:metadata.fio_cycle,
  p_amount_cents:config.amountCents,
  p_provider_status:providerStatus,
  p_started_at:epoch(subscription.start_date)??currentPeriodStart,
  p_access_until:(providerStatus==='active'||providerStatus==='overdue')?currentPeriodEnd:null,
  p_cancelled_at:cancelledAt,
  p_terms_version:metadata.fio_terms_version
 });

 dbError(result.error);
 return result.data;
}

export async function handleStripeWebhook(req:Request,res:ExpressResponse){
 const signature=req.get('stripe-signature');
 if(!signature)
  throw new ApiError(400,'STRIPE_SIGNATURE_REQUIRED','Assinatura do webhook Stripe ausente.');

 const raw=Buffer.isBuffer(req.body)
  ?req.body
  :Buffer.from(typeof req.body==='string'?req.body:'');

 if(!raw.length)
  throw new ApiError(400,'STRIPE_WEBHOOK_EMPTY','Webhook Stripe sem corpo.');

 const stripe=stripeClient();
 let event:Stripe.Event;

 try{
  event=stripe.webhooks.constructEvent(raw,signature,webhookSecret());
 }catch{
  throw new ApiError(400,'STRIPE_WEBHOOK_INVALID','Nao foi possivel validar a assinatura do webhook Stripe.');
 }

 const liveKey=/^(?:sk|rk)_live_/.test(stripeKey());
 if(event.livemode!==liveKey)
  throw new ApiError(400,'STRIPE_MODE_MISMATCH','O modo do webhook Stripe nao corresponde ao ambiente configurado.');

 if(!STRIPE_RELEVANT_EVENTS.has(event.type)){
  res.status(200).json({received:true,ignored:true});
  return;
 }

 const subscriptionId=subscriptionIdFromEvent(event);
 if(!subscriptionId){
  res.status(200).json({received:true,ignored:true});
  return;
 }

 let subscription:Stripe.Subscription;
 try{
  subscription=await stripe.subscriptions.retrieve(subscriptionId);
 }catch{
  throw new ApiError(503,'STRIPE_UNAVAILABLE','Nao foi possivel confirmar a assinatura na Stripe agora.');
 }

 const result=await applyStripeSubscriptionTruth(
  adminDb(),
  subscription,
  event,
  createHash('sha256').update(raw).digest('hex')
 );

 res.status(200).json({received:true,...(asRecord(result)??{})});
}


// Uma compra inicial elegivel permite arrependimento em ate sete dias corridos.
// A decisao usa o relogio do servidor e o pagamento validado pela Stripe.
export const STRIPE_REFUND_WINDOW_MS=7*24*60*60*1000;

export function stripeRefundWithinWindow(firstPaidAtSeconds:number,nowMs=Date.now()){
 if(!Number.isFinite(firstPaidAtSeconds)||firstPaidAtSeconds<=0)return false;
 const firstPaidMs=firstPaidAtSeconds*1000;
 return nowMs>=firstPaidMs && nowMs<=firstPaidMs+STRIPE_REFUND_WINDOW_MS;
}

type FioStripeRefundStatus='eligible'|'expired'|'no_subscription'|'not_paid'|'already_requested'|'manual_review';
export type FioStripeRefundPolicy={
 status:FioStripeRefundStatus;
 eligible:boolean;
 amountCents:number|null;
 currency:string|null;
 paidAt:string|null;
 deadline:string|null;
};

type StripeRefundDetails={
 policy:FioStripeRefundPolicy;
 subscriptionId:string|null;
 paymentIntentId:string|null;
};

const blankRefund=(status:FioStripeRefundStatus):FioStripeRefundPolicy=>({
 status,eligible:false,amountCents:null,currency:null,paidAt:null,deadline:null
});

function stripeObjectId(value:unknown,prefix:string){
 if(typeof value==='string'&&value.startsWith(prefix))return value;
 const obj=asRecord(value);
 return typeof obj?.id==='string'&&obj.id.startsWith(prefix)?obj.id:null;
}

async function stripeRefundDetails(ctx:TenantContext):Promise<StripeRefundDetails>{
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Somente o responsavel pode solicitar reembolso do FIO.');

 const row=await adminDb().from('saas_provider_subscriptions')
  .select('provider_subscription_token,provider_customer_token')
  .eq('barbershop_id',ctx.shopId).eq('provider','stripe').eq('is_current',true)
  .maybeSingle();
 dbError(row.error);
 if(!row.data)return {policy:blankRefund('no_subscription'),subscriptionId:null,paymentIntentId:null};

 const subscriptionId=String(row.data.provider_subscription_token??'');
 const customerId=String(row.data.provider_customer_token??'');
 if(!/^sub_[a-zA-Z0-9]+$/.test(subscriptionId)||!/^cus_[a-zA-Z0-9]+$/.test(customerId))
  return {policy:blankRefund('manual_review'),subscriptionId:null,paymentIntentId:null};

 const stripe=stripeClient();
 const sub=await stripe.subscriptions.retrieve(subscriptionId);
 const metadata=sub.metadata??{};
 const subCustomer=stripeObjectId(sub.customer,'cus_');
 // Nao confiar em IDs vindos do navegador: o banco + metadata Stripe definem o tenant.
 if(metadata.fio_shop_id!==ctx.shopId||subCustomer!==customerId)
  throw new ApiError(403,'STRIPE_TENANT_MISMATCH','A assinatura nao pertence a esta barbearia.');

 const expectedLive=/^(?:sk|rk)_live_/.test(stripeKey());
 if(sub.livemode!==expectedLive)
  throw new ApiError(409,'STRIPE_MODE_MISMATCH','O modo da assinatura nao corresponde ao ambiente Stripe.');

 const invoices=await stripe.invoices.list({subscription:subscriptionId,limit:100});
 if(invoices.has_more)
  return {policy:blankRefund('manual_review'),subscriptionId,paymentIntentId:null};

 const paid=invoices.data
  .filter(invoice=>invoice.status==='paid'&&invoice.amount_paid>0)
  .sort((a,b)=>a.created-b.created);

 if(paid.length===0)
  return {policy:blankRefund('not_paid'),subscriptionId,paymentIntentId:null};

 // Se houve multiplas cobrancas, encaminhar ao suporte para nao estornar valor errado.
 if(paid.length!==1)
  return {policy:blankRefund('manual_review'),subscriptionId,paymentIntentId:null};

 const invoice=paid[0];
 const payments=await stripe.invoicePayments.list({invoice:invoice.id,limit:20});
 if(payments.has_more)
  return {policy:blankRefund('manual_review'),subscriptionId,paymentIntentId:null};

 const completed=payments.data.filter(p=>p.status==='paid'&&Number(p.amount_paid)>0);
 if(completed.length!==1)
  return {policy:blankRefund('manual_review'),subscriptionId,paymentIntentId:null};

 const item=completed[0];
 const intentId=stripeObjectId(asRecord(item.payment)?.payment_intent,'pi_');
 const paidSeconds=item.status_transitions.paid_at;
 const amountCents=item.amount_paid;
 const currency=item.currency;
 if(!intentId||typeof paidSeconds!=='number'||!Number.isFinite(paidSeconds)||
    typeof amountCents!=='number'||!Number.isInteger(amountCents)||amountCents<=0)
  return {policy:blankRefund('manual_review'),subscriptionId,paymentIntentId:null};

 const paidAt=new Date(paidSeconds*1000).toISOString();
 const deadline=new Date(paidSeconds*1000+STRIPE_REFUND_WINDOW_MS).toISOString();
 const base={amountCents,currency,paidAt,deadline};

 const refunds=await stripe.refunds.list({payment_intent:intentId,limit:100});
 if(refunds.has_more||refunds.data.some(r=>r.status==='failed'||r.status==='canceled'))
  return {policy:{...base,status:'manual_review',eligible:false},subscriptionId,paymentIntentId:null};

 if(refunds.data.some(r=>r.status==='succeeded'||r.status==='pending'||r.status==='requires_action'))
  return {policy:{...base,status:'already_requested',eligible:false},subscriptionId,paymentIntentId:intentId};

 const eligible=stripeRefundWithinWindow(paidSeconds);
 return {
  policy:{...base,status:eligible?'eligible':'expired',eligible},
  subscriptionId,paymentIntentId:eligible?intentId:null
 };
}

export async function getStripeRefundPolicy(ctx:TenantContext){
 try{return (await stripeRefundDetails(ctx)).policy;}
 catch(error){
  if(error instanceof ApiError)throw error;
  throw new ApiError(503,'STRIPE_REFUND_UNAVAILABLE','Nao foi possivel consultar o reembolso agora. Tente novamente em instantes.');
 }
}

export async function requestStripeRefund(ctx:TenantContext,raw:unknown){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Somente o responsavel pode solicitar reembolso do FIO.');
 z.object({confirmed:z.literal(true)}).strict().parse(raw);

 let details:StripeRefundDetails;
 try{details=await stripeRefundDetails(ctx);}
 catch(error){
  if(error instanceof ApiError)throw error;
  throw new ApiError(503,'STRIPE_REFUND_UNAVAILABLE','Nao foi possivel consultar o pagamento. Tente novamente.');
 }

 const {policy,subscriptionId,paymentIntentId}=details;
 if(!subscriptionId)return {status:'not_available' as const,policy};
 if(!paymentIntentId||!['eligible','already_requested'].includes(policy.status))
  return {status:'not_available' as const,policy};

 const stripe=stripeClient();
 let refundId:string|null=null;
 let refundStatus:string='pending';

 if(policy.status==='eligible'){
  try{
   const intent=await stripe.paymentIntents.retrieve(paymentIntentId);
   const customerId=await adminDb().from('saas_provider_subscriptions')
    .select('provider_customer_token').eq('barbershop_id',ctx.shopId).eq('provider','stripe')
    .eq('provider_subscription_token',subscriptionId).eq('is_current',true).single();
   dbError(customerId.error);
   if(!customerId.data||stripeObjectId(intent.customer,'cus_')!==customerId.data.provider_customer_token||
      intent.status!=='succeeded'||intent.amount_received!==policy.amountCents)
    return {status:'not_available' as const,policy:{...policy,status:'manual_review' as const,eligible:false}};

   const refund=await stripe.refunds.create({
    payment_intent:paymentIntentId,
    reason:'requested_by_customer',
    metadata:{fio_shop_id:ctx.shopId,fio_subscription_id:subscriptionId,origin:'fio_seven_day_right'}
   },{
    idempotencyKey:`fio-7day-refund-v1:${paymentIntentId}`
   });
   if(refund.status==='failed'||refund.status==='canceled')
    throw new Error('O pagamento nao pode ser reembolsado automaticamente.');
   refundId=refund.id;
   refundStatus=refund.status??'pending';
  }catch{
   // Status incerto: o usuario nao deve ficar clicando e criando outra operacao.
   throw new ApiError(503,'STRIPE_REFUND_CHECK_REQUIRED',
    'Nao foi possivel confirmar o reembolso. Aguarde e consulte o status antes de tentar novamente.');
  }
 }

 // No fluxo de retorno, verifica novamente a assinatura, e cancela cobrancas futuras.
 let canceled=false;
 try{
  const subscription=await stripe.subscriptions.retrieve(subscriptionId);
  if(subscription.status==='canceled'||subscription.status==='incomplete_expired')canceled=true;
  else{
   await stripe.subscriptions.cancel(subscriptionId,{invoice_now:false,prorate:false});
   canceled=true;
  }
 }catch{
  canceled=false;
 }

 const message=`[STRIPE_REEMBOLSO_7D] Pedido iniciado; status=${refundStatus}; assinatura=${subscriptionId}; `+
  `reembolso=${refundId??'ja solicitado'}; cancelamento=${canceled?'confirmado':'verificacao pendente'}.`;
 try{
  const log=await adminDb().from('support_feedback').insert({
   barbershop_id:ctx.shopId,user_id:ctx.userId,role:'OWNER',category:'question',message
  });
  dbError(log.error);
 }catch{
  // Registro administrativo secundario: nao mascarar a operacao feita na Stripe.
 }

 return {
  status:canceled?'refund_requested':'cancel_requires_attention' as const,
  refundStatus,subscriptionCanceled:canceled,
  message:canceled
   ?'Pedido registrado na Stripe e renovacao cancelada. O estorno segue o prazo da operadora do cartao.'
   :'Pedido registrado na Stripe. A renovacao ainda precisa de verificacao pelo suporte.',
  policy:{...policy,status:'already_requested' as const,eligible:false}
 };
}

export const stripeInternals={
 planConfig,
 publicOrigin,
 normalizeStripeStatus,
 subscriptionIdFromEvent
};
