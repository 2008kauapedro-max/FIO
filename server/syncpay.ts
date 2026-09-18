import { createHash,createHmac,timingSafeEqual } from 'node:crypto';
import { createClient,type SupabaseClient } from '@supabase/supabase-js';
import type { Request,Response as ExpressResponse } from 'express';
import { z } from 'zod';
import type { TenantContext } from './context.js';
import { ApiError,dbError } from './errors.js';
import { FIO_PLAN_CATALOG,type BillingCycle } from '../shared/fio-plans.js';

const BASE='https://api.syncpayments.com.br/api/partner/v1';
const PAID_PLANS=['PRO','PREMIUM'] as const;
const CYCLES=['weekly','monthly','annual'] as const;
const CYCLE_DAYS:Record<BillingCycle,number>={weekly:7,monthly:30,annual:365};
const BILLING_ADVANCE:Record<BillingCycle,number>={weekly:1,monthly:3,annual:7};
const GRACE_DAYS:Record<BillingCycle,number>={weekly:2,monthly:5,annual:7};
const MAX_RETRIES=3;
const SUBSCRIPTION_EVENTS=new Set([
 'assinatura_criada','assinatura_ativada','assinatura_em_atraso','assinatura_suspensa',
 'assinatura_cancelada','assinatura_reativada','assinatura_renovada','assinatura_plano_alterado',
 'cobranca_gerada','cobranca_paga','cobranca_falhou','cobranca_retentativa','mandato_ativado','mandato_cancelado'
]);

const subscribeInput=z.object({
 plan:z.enum(PAID_PLANS),cycle:z.enum(CYCLES),document:z.string().trim().min(11).max(24),acceptedTerms:z.literal(true)
}).strict();

const planResource=z.object({
 token:z.string().min(8).max(200),name:z.string(),description:z.string().optional().nullable(),amount:z.union([z.string(),z.number()]),
 periodicity_days:z.number().int().positive(),billing_advance_days:z.number().int().nonnegative().optional(),grace_period_days:z.number().int().nonnegative().optional(),
 max_retry_attempts:z.number().int().nonnegative().optional(),billing_method:z.string(),status:z.string(),checkout_url:z.string().url().optional().nullable()
}).passthrough();
const listPlansResponse=z.object({data:z.array(planResource)}).passthrough();
const createPlanResponse=z.object({data:planResource}).passthrough();

const chargeSchema=z.object({
 cycle_number:z.number().int().optional(),amount:z.union([z.string(),z.number()]).optional(),status:z.string(),due_date:z.string().optional().nullable(),
 expires_at:z.string().optional().nullable(),paid_at:z.string().optional().nullable(),payment:z.object({pix_code:z.string().optional().nullable(),qr_code:z.string().optional().nullable()}).passthrough().optional().nullable()
}).passthrough();
const subscriptionDetailResponse=z.object({data:z.object({
 token:z.string().min(8).max(200),status:z.enum(['pending_first_payment','active','overdue','suspended','cancelled']),
 subscriber_name:z.string().optional(),subscriber_email:z.string().email().optional(),started_at:z.string().optional().nullable(),next_charge_at:z.string().optional().nullable(),
 cancelled_at:z.string().optional().nullable(),plan:planResource,charges:z.array(chargeSchema).default([])
}).passthrough()}).passthrough();
const enrollResponse=z.object({
 subscription_token:z.string().min(8).max(200),status:z.string(),billing_method:z.string(),payment:z.object({
  pix_code:z.string().min(1).optional().nullable(),qr_code:z.string().optional().nullable(),identifier:z.string().optional().nullable(),expires_at:z.string().optional().nullable()
 }).passthrough().optional().nullable()
}).passthrough();
const webhookEnvelope=z.object({
 event:z.string().min(1).max(80),occurred_at:z.iso.datetime({offset:true}),subscription_token:z.string().min(8).max(200),
 plan_token:z.string().min(8).max(200).optional(),status:z.string().max(80).optional(),next_charge_at:z.iso.datetime({offset:true}).nullable().optional()
}).passthrough();

type Fetcher=typeof fetch;
type PaidPlan=typeof PAID_PLANS[number];
type ProviderStatus='pending_first_payment'|'active'|'overdue'|'suspended'|'cancelled';
type PlanMapping={plan_code:PaidPlan;billing_cycle:BillingCycle;amount_cents:number;periodicity_days:number;billing_method:string;provider_plan_token:string;checkout_url:string|null};
type ProviderLink={id:string;barbershop_id:string;provider_subscription_token:string;provider_plan_token:string;plan_code:PaidPlan;billing_cycle:BillingCycle;amount_cents:number;provider_status:ProviderStatus;is_current:boolean;last_event_at:string|null};
type EnrollmentIntent={id:string;state:'creating'|'uncertain';provider_subscription_token:string|null;same_offer:boolean;created:boolean};
const enrollmentIntentSchema=z.object({id:z.uuid(),state:z.enum(['creating','uncertain']),provider_subscription_token:z.string().min(8).max(200).nullable(),same_offer:z.boolean(),created:z.boolean()});

let tokenCache:{value:string;expiresAt:number}|null=null;

class SyncpayHttpError extends Error{
 constructor(readonly status:number,readonly payload:unknown){super(`syncpay_http_${status}`);this.name='SyncpayHttpError';}
}

function adminDb(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new ApiError(503,'SETUP_REQUIRED','A configuração segura do servidor ainda não foi concluída.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function configured(){return Boolean(process.env.SYNCPAY_CLIENT_ID&&process.env.SYNCPAY_CLIENT_SECRET);}
function webhookSecrets(){return [process.env.SYNCPAY_WEBHOOK_SECRET,process.env.SYNCPAY_WEBHOOK_SECRET_PREVIOUS].filter((x):x is string=>Boolean(x&&x.length>=8));}
function digits(value:string){return value.replace(/\D/g,'');}
function safeEqual(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
function cents(value:string|number){const n=typeof value==='number'?value:Number(value);return Number.isFinite(n)?Math.round(n*100):-1;}
function brl(centsValue:number){return (centsValue/100).toFixed(2);}
function iso(value:string|null|undefined){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString();}

function validCpf(value:string){
 if(value.length!==11||/^(\d)\1+$/.test(value))return false;
 const calc=(len:number)=>{let sum=0;for(let i=0;i<len;i++)sum+=Number(value[i])*(len+1-i);const r=(sum*10)%11;return r===10?0:r;};
 return calc(9)===Number(value[9])&&calc(10)===Number(value[10]);
}
function validCnpj(value:string){
 if(value.length!==14||/^(\d)\1+$/.test(value))return false;
 const calc=(base:string,weights:number[])=>{const sum=base.split('').reduce((acc,n,i)=>acc+Number(n)*weights[i],0);const r=sum%11;return r<2?0:11-r;};
 const d1=calc(value.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);
 const d2=calc(value.slice(0,12)+d1,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
 return d1===Number(value[12])&&d2===Number(value[13]);
}
function validDocument(value:string){return validCpf(value)||validCnpj(value);}

function planConfig(plan:PaidPlan,cycle:BillingCycle){
 const definition=FIO_PLAN_CATALOG.find(item=>item.code===plan);
 const amount=definition?.prices[cycle];
 if(!definition||amount==null||amount<=0)throw new ApiError(400,'INVALID_PLAN','Escolha um plano pago válido.');
 return {plan,cycle,amountCents:amount,periodicityDays:CYCLE_DAYS[cycle],name:`${definition.name} · ${cycle==='weekly'?'Semanal':cycle==='monthly'?'Mensal':'Anual'} · v1 · ${amount}`};
}

async function parseJson(response:globalThis.Response){
 const text=await response.text();
 if(!text)return {};
 try{return JSON.parse(text) as unknown;}catch{return {message:'invalid_json'};}
}

function providerParse<T>(schema:z.ZodType<T>,value:unknown):T{
 const parsed=schema.safeParse(value);
 if(!parsed.success)throw new ApiError(503,'SYNCPAY_INVALID_RESPONSE','A SyncPay respondeu em um formato inesperado. Tente novamente.');
 return parsed.data;
}

async function getAccessToken(fetcher:Fetcher,force=false){
 if(!force&&tokenCache&&tokenCache.expiresAt-Date.now()>60_000)return tokenCache.value;
 const clientId=process.env.SYNCPAY_CLIENT_ID,clientSecret=process.env.SYNCPAY_CLIENT_SECRET;
 if(!clientId||!clientSecret)throw new ApiError(503,'SYNCPAY_NOT_CONFIGURED','A SyncPay ainda não foi configurada no servidor.');
 let response:globalThis.Response;
 try{response=await fetcher(`${BASE}/auth-token`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({client_id:clientId,client_secret:clientSecret}),signal:AbortSignal.timeout(15000)});}catch{throw new ApiError(503,'SYNCPAY_UNAVAILABLE','A SyncPay está temporariamente indisponível. Tente novamente.');}
 const payload=await parseJson(response);
 if(!response.ok)throw new SyncpayHttpError(response.status,payload);
 const parsed=providerParse(z.object({access_token:z.string().min(10),expires_in:z.number().positive().default(3600),expires_at:z.string().optional()}),payload);
 const byField=parsed.expires_at?Date.parse(parsed.expires_at):NaN;
 tokenCache={value:parsed.access_token,expiresAt:Number.isFinite(byField)?byField:Date.now()+parsed.expires_in*1000};
 return tokenCache.value;
}

async function providerRequest(fetcher:Fetcher,path:string,init:RequestInit={},retry401=true):Promise<unknown>{
 let token:string;
 try{token=await getAccessToken(fetcher);}catch(e){throw providerApiError(e);}
 let response:globalThis.Response;
 try{response=await fetcher(`${BASE}${path}`,{...init,headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(init.body?{'Content-Type':'application/json'}:{}),...(init.headers??{})},signal:init.signal??AbortSignal.timeout(15000)});}catch{throw new ApiError(503,'SYNCPAY_UNAVAILABLE','A SyncPay está temporariamente indisponível. Tente novamente.');}
 if(response.status===401&&retry401){tokenCache=null;try{await getAccessToken(fetcher,true);}catch(e){throw providerApiError(e);}return providerRequest(fetcher,path,init,false);}
 const payload=await parseJson(response);
 if(!response.ok)throw providerApiError(new SyncpayHttpError(response.status,payload));
 return payload;
}

function providerApiError(error:unknown):ApiError{
 if(error instanceof ApiError)return error;
 if(error instanceof SyncpayHttpError){
  const p=error.payload&&typeof error.payload==='object'?error.payload as Record<string,unknown>:{};
  if(error.status===422&&p.action==='wait_for_approval')return new ApiError(503,'SYNCPAY_ACCOUNT_PENDING','A conta SyncPay ainda está aguardando aprovação.');
  if(error.status===401||error.status===403)return new ApiError(503,'SYNCPAY_AUTH_ERROR','As credenciais da SyncPay precisam ser revisadas no servidor.');
  if(error.status===429)return new ApiError(429,'SYNCPAY_RATE_LIMIT','A SyncPay recebeu muitas solicitações. Aguarde um pouco e tente novamente.');
  if(error.status===404)return new ApiError(409,'SYNCPAY_RESOURCE_NOT_FOUND','A assinatura ou o plano de cobrança não foi encontrado na SyncPay.');
  if(error.status===422)return new ApiError(422,'SYNCPAY_INVALID_REQUEST','A SyncPay recusou os dados da assinatura. Confira os dados e tente novamente.');
 }
 return new ApiError(503,'SYNCPAY_UNAVAILABLE','A SyncPay está temporariamente indisponível. Tente novamente.');
}

async function ensureProviderPlan(db:SupabaseClient,plan:PaidPlan,cycle:BillingCycle,fetcher:Fetcher):Promise<PlanMapping>{
 const config=planConfig(plan,cycle);
 const local=await db.from('syncpay_plan_mappings').select('plan_code,billing_cycle,amount_cents,periodicity_days,billing_method,provider_plan_token,checkout_url').eq('plan_code',plan).eq('billing_cycle',cycle).eq('billing_method','qr_code').eq('amount_cents',config.amountCents).eq('active',true).maybeSingle();
 dbError(local.error);
 if(local.data)return local.data as PlanMapping;

 const query=new URLSearchParams({page:'1',per_page:'100',status:'active',search:config.name});
 const listed=providerParse(listPlansResponse,await providerRequest(fetcher,`/subscription-plans?${query.toString()}`));
 let remote=listed.data.find(item=>item.name===config.name&&cents(item.amount)===config.amountCents&&item.periodicity_days===config.periodicityDays&&item.billing_method==='qr_code');
 if(!remote){
  const created=providerParse(createPlanResponse,await providerRequest(fetcher,'/subscription-plans',{method:'POST',body:JSON.stringify({
   name:config.name,description:`Assinatura ${plan} do FIO no ciclo ${cycle}.`,amount:brl(config.amountCents),periodicity_days:config.periodicityDays,
   billing_method:'qr_code',billing_advance_days:BILLING_ADVANCE[cycle],grace_period_days:GRACE_DAYS[cycle],max_retry_attempts:MAX_RETRIES
  })}));
  remote=created.data;
 }
 const row={plan_code:plan,billing_cycle:cycle,amount_cents:config.amountCents,periodicity_days:config.periodicityDays,billing_method:'qr_code',provider_plan_token:remote.token,checkout_url:remote.checkout_url??null,active:true,updated_at:new Date().toISOString()};
 const saved=await db.from('syncpay_plan_mappings').upsert(row,{onConflict:'plan_code,billing_cycle,billing_method,amount_cents'}).select('plan_code,billing_cycle,amount_cents,periodicity_days,billing_method,provider_plan_token,checkout_url').single();
 dbError(saved.error);return saved.data as PlanMapping;
}

async function getProviderDetail(token:string,fetcher:Fetcher){return providerParse(subscriptionDetailResponse,await providerRequest(fetcher,`/subscriptions/${encodeURIComponent(token)}`)).data;}

function paymentFromDetail(detail:z.infer<typeof subscriptionDetailResponse>['data']){
 const charge=detail.charges.find(item=>item.status==='pending'&&item.payment?.pix_code);
 if(!charge)return null;
 return {pixCode:charge.payment?.pix_code??null,qrCode:charge.payment?.qr_code??null,identifier:null,expiresAt:iso(charge.expires_at)};
}

function accessUntil(detail:z.infer<typeof subscriptionDetailResponse>['data']){
 const next=iso(detail.next_charge_at);
 if(detail.status==='active'||detail.status==='overdue'){
  if(!next)return null;
  return new Date(new Date(next).getTime()+(detail.plan.grace_period_days??0)*86_400_000).toISOString();
 }
 return null;
}

function stateEventKey(prefix:string,detail:z.infer<typeof subscriptionDetailResponse>['data']){
 return createHash('sha256').update([prefix,detail.token,detail.status,detail.plan.token,detail.next_charge_at??'',detail.cancelled_at??''].join('|')).digest('hex');
}

async function applyProviderTruth(db:SupabaseClient,detail:z.infer<typeof subscriptionDetailResponse>['data'],event:{key:string;name:string;occurredAt:string;bodyHash:string}){
 const until=accessUntil(detail);
 if((detail.status==='active'||detail.status==='overdue')&&!until)throw new ApiError(503,'SYNCPAY_INCOMPLETE_STATE','A SyncPay não informou a validade da assinatura. Tente novamente.');
 const result=await db.rpc('apply_syncpay_subscription_state',{
  p_event_key:event.key,p_event_name:event.name,p_occurred_at:event.occurredAt,p_body_sha256:event.bodyHash,
  p_subscription_token:detail.token,p_provider_status:detail.status,p_plan_token:detail.plan.token,p_started_at:iso(detail.started_at),p_access_until:until
 });
 dbError(result.error);return result.data;
}

function billingResponse(link:ProviderLink,detail:z.infer<typeof subscriptionDetailResponse>['data'],paymentOverride?:{pixCode:string|null;qrCode:string|null;identifier:string|null;expiresAt:string|null}|null){
 return {provider:'syncpay' as const,providerStatus:detail.status,plan:link.plan_code,cycle:link.billing_cycle,amountCents:link.amount_cents,nextChargeAt:iso(detail.next_charge_at),payment:paymentOverride??paymentFromDetail(detail)};
}

async function currentLink(db:SupabaseClient,shopId:string){
 const r=await db.from('saas_provider_subscriptions').select('id,barbershop_id,provider_subscription_token,provider_plan_token,plan_code,billing_cycle,amount_cents,provider_status,is_current,last_event_at').eq('barbershop_id',shopId).eq('provider','syncpay').eq('is_current',true).maybeSingle();
 dbError(r.error);return r.data as ProviderLink|null;
}

async function setEnrollmentIntent(db:SupabaseClient,id:string,state:'creating'|'uncertain'|'linked'|'failed',subscriptionToken:string|null,errorCode:string|null){
 const r=await db.from('syncpay_enrollment_intents').update({state,provider_subscription_token:subscriptionToken,last_error_code:errorCode,updated_at:new Date().toISOString()}).eq('id',id);
 dbError(r.error);
}

function enrollmentFailureIsKnown(error:unknown){
 if(!(error instanceof ApiError))return false;
 return ['INVALID_DOCUMENT','BILLING_EMAIL_REQUIRED','SYNCPAY_ACCOUNT_PENDING','SYNCPAY_AUTH_ERROR','SYNCPAY_RATE_LIMIT','SYNCPAY_RESOURCE_NOT_FOUND','SYNCPAY_INVALID_REQUEST'].includes(error.code);
}

export async function createSyncpaySubscription(ctx:TenantContext,raw:unknown,fetcher:Fetcher=fetch){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Esta ação é exclusiva do responsável pela barbearia.');
 const input=subscribeInput.parse(raw),document=digits(input.document);
 if(!validDocument(document))throw new ApiError(400,'INVALID_DOCUMENT','Informe um CPF ou CNPJ válido.');
 if(!configured())throw new ApiError(503,'SYNCPAY_NOT_CONFIGURED','A SyncPay ainda não foi configurada no servidor.');
 const db=adminDb(),mapping=await ensureProviderPlan(db,input.plan,input.cycle,fetcher);
 const existing=await currentLink(db,ctx.shopId);
 if(existing){
  const detail=await getProviderDetail(existing.provider_subscription_token,fetcher);
  await applyProviderTruth(db,detail,{key:stateEventKey('pre-enroll-reconcile',detail),name:'reconcile',occurredAt:new Date().toISOString(),bodyHash:createHash('sha256').update(JSON.stringify({status:detail.status,token:detail.token,plan:detail.plan.token,next:detail.next_charge_at})).digest('hex')});
  if(['active','overdue','pending_first_payment'].includes(detail.status)){
   if(existing.plan_code===input.plan&&existing.billing_cycle===input.cycle)return billingResponse(existing,detail);
   throw new ApiError(409,'SYNCPAY_SUBSCRIPTION_EXISTS','Já existe uma assinatura ou cobrança recorrente em andamento. Conclua ou cancele a atual antes de escolher outro plano.');
  }
 }
 const user=await db.auth.admin.getUserById(ctx.userId);
 if(user.error||!user.data.user?.email)throw new ApiError(400,'BILLING_EMAIL_REQUIRED','Sua conta precisa de um e-mail válido para assinar o FIO.');
 const begun=await db.rpc('begin_syncpay_enrollment',{p_shop:ctx.shopId,p_provider_plan_token:mapping.provider_plan_token,p_actor:ctx.userId});dbError(begun.error);
 const intent=providerParse(enrollmentIntentSchema,begun.data) as EnrollmentIntent;
 if(!intent.same_offer)throw new ApiError(409,'SYNCPAY_ENROLLMENT_IN_PROGRESS','Já existe uma tentativa de assinatura em verificação. Para evitar cobrança duplicada, aguarde a confirmação antes de escolher outro plano.');
 if(!intent.created){
  if(!intent.provider_subscription_token)throw new ApiError(409,'SYNCPAY_ENROLLMENT_UNCERTAIN','Uma tentativa anterior ainda está sendo verificada. Para evitar uma cobrança duplicada, não gere outro Pix agora.');
  const detail=await getProviderDetail(intent.provider_subscription_token,fetcher);
  try{
   const bound=await db.rpc('bind_syncpay_subscription',{p_shop:ctx.shopId,p_subscription_token:detail.token,p_provider_plan_token:mapping.provider_plan_token,p_actor:ctx.userId,p_terms_version:'fio-subscription-v1'});dbError(bound.error);
   await setEnrollmentIntent(db,intent.id,'linked',detail.token,null);
   const link=await currentLink(db,ctx.shopId);
   if(!link)throw new ApiError(503,'BILLING_STATE_ERROR','A assinatura existe, mas o FIO não conseguiu recuperar o vínculo. Entre em contato com o suporte.');
   return billingResponse(link,detail);
  }catch(e){await setEnrollmentIntent(db,intent.id,'uncertain',detail.token,e instanceof ApiError?e.code:'BILLING_STATE_ERROR');throw e;}
 }
 const phone=digits(ctx.member.phone??'');
 const payload:{name:string;email:string;document:string;phone?:string}={name:ctx.member.display_name,email:user.data.user.email,document};
 if(phone.length>=8)payload.phone=phone;
 let subscriptionToken:string|null=null;
 try{
  const enrolled=providerParse(enrollResponse,await providerRequest(fetcher,`/subscription-plans/${encodeURIComponent(mapping.provider_plan_token)}/enroll`,{method:'POST',body:JSON.stringify(payload)}));
  subscriptionToken=enrolled.subscription_token;
  await setEnrollmentIntent(db,intent.id,'creating',subscriptionToken,null);
  const bound=await db.rpc('bind_syncpay_subscription',{p_shop:ctx.shopId,p_subscription_token:subscriptionToken,p_provider_plan_token:mapping.provider_plan_token,p_actor:ctx.userId,p_terms_version:'fio-subscription-v1'});dbError(bound.error);
  await setEnrollmentIntent(db,intent.id,'linked',subscriptionToken,null);
  const link=await currentLink(db,ctx.shopId);
  if(!link)throw new ApiError(503,'BILLING_STATE_ERROR','A cobrança foi criada, mas o FIO não conseguiu vincular a assinatura. Não gere outra cobrança e entre em contato com o suporte.');
  return {provider:'syncpay' as const,providerStatus:enrolled.status,plan:input.plan,cycle:input.cycle,amountCents:mapping.amount_cents,nextChargeAt:null,payment:enrolled.payment?{pixCode:enrolled.payment.pix_code??null,qrCode:enrolled.payment.qr_code??null,identifier:enrolled.payment.identifier??null,expiresAt:iso(enrolled.payment.expires_at)}:null};
 }catch(e){
  const known=!subscriptionToken&&enrollmentFailureIsKnown(e);
  await setEnrollmentIntent(db,intent.id,known?'failed':'uncertain',subscriptionToken,e instanceof ApiError?e.code:'SYNCPAY_UNKNOWN_RESULT');
  if(!known&&!subscriptionToken)throw new ApiError(503,'SYNCPAY_ENROLLMENT_UNCERTAIN','Não foi possível confirmar se a SyncPay criou a assinatura. Para evitar cobrança duplicada, não tente novamente agora.');
  throw e;
 }
}

export async function getSyncpayBilling(ctx:TenantContext,fetcher:Fetcher=fetch){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Esta ação é exclusiva do responsável pela barbearia.');
 if(!configured())return {configured:false,subscription:null};
 const db=adminDb(),link=await currentLink(db,ctx.shopId);
 if(!link)return {configured:true,subscription:null};
 const detail=await getProviderDetail(link.provider_subscription_token,fetcher);
 await applyProviderTruth(db,detail,{key:stateEventKey('owner-reconcile',detail),name:'reconcile',occurredAt:new Date().toISOString(),bodyHash:createHash('sha256').update(JSON.stringify({status:detail.status,token:detail.token,plan:detail.plan.token,next:detail.next_charge_at})).digest('hex')});
 return {configured:true,subscription:billingResponse(link,detail)};
}

export function verifySyncpayWebhook(rawBody:Buffer,headers:Request['headers'],nowSeconds=Math.floor(Date.now()/1000)){
 const secrets=webhookSecrets();
 if(!secrets.length)return false;
 const signature=String(headers['x-syncpay-signature']??'');
 if(signature){
  const parts=signature.split(',').map(x=>x.trim().split('=',2));
  const t=Number(parts.find(([k])=>k==='t')?.[1]??0),v1=parts.find(([k])=>k==='v1')?.[1]??'';
  if(Number.isFinite(t)&&t>0&&v1&&Math.abs(nowSeconds-t)<=300){
   const signed=`${t}.${rawBody.toString('utf8')}`;
   if(secrets.some(secret=>safeEqual(createHmac('sha256',secret).update(signed).digest('hex'),v1)))return true;
  }
 }
 const auth=String(headers.authorization??'').match(/^Bearer\s+(.+)$/i)?.[1]??'';
 return Boolean(auth&&secrets.some(secret=>safeEqual(secret,auth)));
}

export async function handleSyncpayWebhook(req:Request,res:ExpressResponse,fetcher:Fetcher=fetch){
 const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from('');
 if(!raw.length)throw new ApiError(400,'INVALID_WEBHOOK','Webhook vazio.');
 if(!verifySyncpayWebhook(raw,req.headers))throw new ApiError(401,'INVALID_WEBHOOK_SIGNATURE','Assinatura do webhook inválida.');
 let parsed:unknown;try{parsed=JSON.parse(raw.toString('utf8'));}catch{throw new ApiError(400,'INVALID_WEBHOOK','Webhook inválido.');}
 const base=z.object({event:z.string().min(1).max(80)}).passthrough().parse(parsed);
 if(!SUBSCRIPTION_EVENTS.has(base.event)){res.status(200).json({received:true,ignored:true});return;}
 const event=webhookEnvelope.parse(parsed);
 const db=adminDb();
 const known=await db.from('saas_provider_subscriptions').select('id').eq('provider','syncpay').eq('provider_subscription_token',event.subscription_token).maybeSingle();
 dbError(known.error);
 if(!known.data){res.status(200).json({received:true,ignored:true});return;}
 const detail=await getProviderDetail(event.subscription_token,fetcher);
 const bodyHash=createHash('sha256').update(raw).digest('hex');
 const key=createHash('sha256').update([event.event,event.subscription_token,event.occurred_at,event.plan_token??'',event.status??'',event.next_charge_at??''].join('|')).digest('hex');
 await applyProviderTruth(db,detail,{key,name:event.event,occurredAt:new Date(event.occurred_at).toISOString(),bodyHash});
 res.status(200).json({received:true});
}

export const syncpayInternals={planConfig,validDocument,accessUntil,stateEventKey};
