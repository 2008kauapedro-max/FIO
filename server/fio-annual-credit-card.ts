import { createClient } from '@supabase/supabase-js';
import { createHmac,timingSafeEqual } from 'node:crypto';
import type { Request,Response as ExpressResponse } from 'express';
import { z } from 'zod';
import type { TenantContext } from './context.js';
import { ApiError, dbError } from './errors.js';

// FIO annual purchase: ONE non-renewing charge, never a subscription enrollment.
// The environmental live gate is intentionally OFF until validated in production.
const API_ORIGIN='https://api.syncpayments.com.br';
const BASE=`${API_ORIGIN}/api/partner/v1`;
const transactionId=z.string().min(8).max(200).regex(/^[a-zA-Z0-9._-]+$/);
const cardToken=z.string().regex(/^card_token\.[a-zA-Z0-9._-]{8,260}$/);
const requestSchema=z.object({
 orderId:z.uuid(), installments:z.number().int().min(1).max(12),
 cardToken, cardLast4:z.string().regex(/^\d{4}$/).optional(),
 cardBin:z.string().regex(/^\d{6}$/).optional(),
 cardBrand:z.string().max(30).optional(),
 document:z.string().regex(/^\d{11}$|^\d{14}$/),
 phone:z.string().regex(/^\d{10,13}$/),
 acceptedTerms:z.literal(true)
}).strict();
// The V2 transaction view includes payment_method and paid_at explicitly.
// Never treat transaction_date (creation time) as evidence of payment.
const lookupSchema=z.object({data:z.object({transaction:z.object({
 reference_id:transactionId,
 amount:z.union([z.number(),z.string()]),
 status:z.enum(['pending','completed','failed','refunded','med']),
 currency:z.literal('BRL'),
 payment_method:z.literal('credit_card'),
 paid_at:z.string().optional().nullable(),
}).passthrough()}).passthrough()}).passthrough();
const submissionSchema=z.object({data:z.object({transaction_id:transactionId}).passthrough()}).passthrough();
type AnnualRow={id:string;barbershop_id:string;actor_user_id:string;external_id:string;plan_code:string;base_amount_cents:number;state:string;provider_transaction_id:string|null;installments_selected:number|null};
let cached:{token:string;until:number}|null=null;

export function annualCreditCardLiveEnabled(){
 return process.env.FIO_ENABLE_ANNUAL_API_CHARGES==='true' &&
  process.env.FIO_ENABLE_ANNUAL_ORDER_DRAFTS==='true' &&
  Boolean(process.env.SYNCPAY_CLIENT_ID&&process.env.SYNCPAY_CLIENT_SECRET) &&
  /^pk_live_[A-Za-z0-9._-]{8,}$/.test(process.env.VITE_SYNCPAY_PUBLIC_KEY??'');
}
function db(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new ApiError(503,'SETUP_REQUIRED','Banco de pagamentos indisponível.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function auth(fetcher:typeof fetch){
 if(cached&&cached.until>Date.now()+60_000)return cached.token;
 const id=process.env.SYNCPAY_CLIENT_ID,secret=process.env.SYNCPAY_CLIENT_SECRET;
 if(!id||!secret)throw new ApiError(503,'SYNCPAY_NOT_CONFIGURED','SyncPay indisponível.');
 let res:Response;
 try{res=await fetcher(`${BASE}/auth-token`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:id,client_secret:secret}),signal:AbortSignal.timeout(12000)});}catch{
  throw new ApiError(503,'SYNCPAY_UNAVAILABLE','Não foi possível conectar à SyncPay.');
 }
 if(!res.ok)throw new ApiError(503,'SYNCPAY_AUTH_ERROR','Não foi possível autenticar o pagamento.');
 const body=z.object({access_token:z.string().min(10),expires_in:z.number().positive().optional()}).parse(await res.json());
 cached={token:body.access_token,until:Date.now()+Math.min(body.expires_in??3600,3600)*1000};
 return cached.token;
}
async function provider(fetcher:typeof fetch,path:string,init?:RequestInit){
 const token=await auth(fetcher);
 let r:Response;
 const url=path.startsWith('/api/partner/v2/')?`${API_ORIGIN}${path}`:`${BASE}${path}`;
 try{r=await fetcher(url,{...init,headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(init?.body?{'Content-Type':'application/json'}:{})},signal:AbortSignal.timeout(15000),redirect:'error'});}catch{
  // A POST response may have been lost AFTER being processed. Never retry.
  throw new ApiError(503,'ANNUAL_UNCERTAIN','A SyncPay pode ter recebido a operação. Não tente pagar de novo; consulte o status ou o suporte.');
 }
 if(!r.ok){
  if(r.status===403)throw new ApiError(503,'ANNUAL_CARD_NOT_APPROVED','Cartão via API ainda não autorizado na conta SyncPay.');
  throw new ApiError(503,'ANNUAL_PROVIDER_ERROR','Não foi possível concluir na SyncPay. Não repita o pagamento sem conferir o pedido.');
 }
 try{return await r.json() as unknown;}catch{throw new ApiError(503,'ANNUAL_INVALID_PROVIDER_REPLY','Não foi possível confirmar a resposta da SyncPay. Não repita o pagamento.');}
}

export function normalizeAnnualCardProof(raw:unknown,expect:{id:string;amountCents:number}){
 const data=lookupSchema.parse(raw).data.transaction;
 if(data.reference_id!==expect.id)throw new Error('ANNUAL_TRANSACTION_ID_MISMATCH');
 // Require explicit credit_card + BRL on the authenticated provider V2 lookup.
 const price=Number(data.amount);
 if(!Number.isFinite(price)||Math.round(price*100)!==expect.amountCents)throw new Error('ANNUAL_AMOUNT_MISMATCH');
 if(data.status!=='completed')return {state:data.status as 'pending'|'failed'|'refunded'|'med',paidAt:null};
 // The creation timestamp MUST NEVER become a payment timestamp.
 if(!data.paid_at||!Number.isFinite(Date.parse(data.paid_at)))throw new Error('ANNUAL_PAID_DATE_MISSING');
 return {state:'completed' as const,paidAt:new Date(data.paid_at).toISOString()};
}

function publicState(row:AnnualRow){return {orderId:row.id,state:row.state,canRetry:false,automaticRenewal:false};}
async function rowForShop(shopId:string,actorId:string,orderId:string){
 const found=await db().from('fio_annual_orders')
  .select('id,barbershop_id,actor_user_id,external_id,plan_code,base_amount_cents,state,provider_transaction_id,installments_selected')
  .eq('id',orderId).eq('barbershop_id',shopId).eq('actor_user_id',actorId).maybeSingle();
 dbError(found.error);
 if(!found.data)throw new ApiError(404,'ANNUAL_ORDER_NOT_FOUND','Pedido anual não encontrado.');
 return found.data as AnnualRow;
}

function realIp(req:Request){
 const str=req.get('x-vercel-forwarded-for')??req.ip??'';
 const ip=str.split(',')[0]?.trim()??'';
 if(!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)&&!(/^[a-fA-F0-9:]+$/.test(ip)&&ip.includes(':')))
  throw new ApiError(503,'ANNUAL_CLIENT_IP_REQUIRED','Não foi possível verificar o IP do comprador.');
 return ip;
}

export function annualBuyerPhone(raw:string){
 const phone=raw.replace(/\D/g,'');
 if(!/^\d{10,13}$/.test(phone))throw new ApiError(400,'ANNUAL_PHONE_REQUIRED','Informe um telefone válido com DDD.');
 return phone;
}

/** No retry after the V10 RPC moves the order from preparing to submitting. */
export async function submitAnnualCreditCard(ctx:TenantContext,req:Request,raw:unknown,fetcher:typeof fetch=fetch){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Apenas o responsável pode contratar.');
 if(!annualCreditCardLiveEnabled())throw new ApiError(503,'ANNUAL_CHECKOUT_DISABLED','Compra anual ainda não liberada.');
 const input=requestSchema.parse(raw);
 // No verified provider quote endpoint has been established for 2-12x.
 // Never charge with an unknown final customer total.
 if(input.installments!==1)throw new ApiError(422,'ANNUAL_INSTALLMENT_QUOTE_REQUIRED','Parcelamento aguarda cotação oficial do valor total.');
 const order=await rowForShop(ctx.shopId,ctx.userId,input.orderId);
 if(order.state!=='preparing')throw new ApiError(409,'ANNUAL_ORDER_ALREADY_SENT','Já existe uma tentativa de pagamento. Confira o status antes de outra cobrança.');
 // Use the buyer's phone from this purchase, not a stale profile field.
 // Validate before the irreversible order submission and before contacting SyncPay.
 const phone=annualBuyerPhone(input.phone);
 const user=await db().auth.admin.getUserById(ctx.userId);
 if(user.error||!user.data.user?.email)throw new ApiError(400,'ANNUAL_EMAIL_REQUIRED','Sua conta precisa de email válido.');
 if(phone.length<10)throw new ApiError(400,'ANNUAL_PHONE_REQUIRED','Informe um telefone com DDD antes de pagar.');
 // Validate IP BEFORE irrevocably locking this order as 'submitting'.
 const buyerIp=realIp(req);
 const submitted=await db().rpc('fio_begin_annual_submission_v1',{p_shop:ctx.shopId,p_order:order.id,p_actor:ctx.userId,p_installments:input.installments});
 dbError(submitted.error);
 if(submitted.data!==true)throw new ApiError(409,'ANNUAL_ORDER_ALREADY_SENT','Pedido já enviado ou existe assinatura ativa. Confira antes de repetir.');
 const payload={
  amount:order.base_amount_cents/100,
  description:`FIO anual ${order.plan_code} - ${order.id}`,
  installments:1,
  card:{token:input.cardToken},
  client:{name:ctx.member.display_name,email:user.data.user.email,phone,document:{type:input.document.length===11?'cpf':'cnpj',number:input.document}},
  device:{ip:buyerIp,user_agent:(req.get('user-agent')??'').slice(0,500),page_url:'https://usefio.vercel.app',metadata:{order_id:order.id}}
 };
 const response=submissionSchema.parse(await provider(fetcher,'/credit-card',{method:'POST',body:JSON.stringify(payload)}));
 const saved=await db().rpc('fio_bind_annual_transaction_v1',{p_shop:ctx.shopId,p_order:order.id,p_transaction:response.data.transaction_id});
 dbError(saved.error);
 if(saved.data!==true)throw new ApiError(503,'ANNUAL_BIND_UNCERTAIN','A cobrança existe, mas não pôde ser vinculada. Não tente pagar novamente.');
 try{
  const immediate=await checkAnnualCreditCard(ctx,order.id,fetcher);
  if('paid' in immediate && immediate.paid===true)return {orderId:order.id,state:'paid',paid:true,automaticRenewal:false};
 }catch{ /* Consulta falhou: cobranca enviada, nunca enviar novamente. */ }
 return {orderId:order.id,state:'review',automaticRenewal:false,message:'Cobrança enviada. Aguardando aprovação da SyncPay.'};
}

/** Polling performs an authenticated GET of the real transaction before settlement. */
export async function checkAnnualCreditCard(ctx:TenantContext,orderId:unknown,fetcher:typeof fetch=fetch){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Apenas o responsável pode consultar.');
 const id=z.uuid().parse(orderId),row=await rowForShop(ctx.shopId,ctx.userId,id);
 if(row.state==='paid')return {...publicState(row),paid:true};
 if(row.state!=='review'||!row.provider_transaction_id)return publicState(row);
 const external=await provider(fetcher,`/api/partner/v2/transactions/${encodeURIComponent(row.provider_transaction_id)}`);
 let proof:ReturnType<typeof normalizeAnnualCardProof>;
 try{proof=normalizeAnnualCardProof(external,{id:row.provider_transaction_id,amountCents:row.base_amount_cents});}
 catch{throw new ApiError(503,'ANNUAL_PROOF_UNVERIFIED','A cobrança precisa de revisão. O acesso não foi liberado.');}
 if(proof.state!=='completed')return {...publicState(row),providerStatus:proof.state};
 const settled=await db().rpc('fio_settle_annual_order_v10',{
  p_order_id:row.id,p_external_id:row.external_id,p_transaction_id:row.provider_transaction_id,
  p_merchant_base_cents:row.base_amount_cents,p_paid_at:proof.paidAt
 });
 dbError(settled.error);
 return {orderId:row.id,state:'paid',paid:true,automaticRenewal:false,settlement:settled.data};
}

/** Webhook "transaction" da SyncPay usa HMAC-SHA256 em X-SyncPay-Signature.
 * Nunca libere plano com base no POST recebido: confirme pela API V2 autenticada. */
export function annualWebhookAuthenticated(
 header:string|undefined,secret:string|undefined,rawBody:Buffer|string,
 nowSeconds=Math.floor(Date.now()/1000)
):boolean{
 if(!secret||secret.length<16||!header||header.length>240)return false;
 const match=/^t=(\d{10,13}),\s*v1=([a-fA-F0-9]{64})$/.exec(header.trim());
 if(!match)return false;
 const timestamp=Number(match[1]);
 if(!Number.isSafeInteger(timestamp)||Math.abs(nowSeconds-timestamp)>300)return false;
 const mac=createHmac('sha256',secret).update(String(timestamp)).update('.').update(rawBody).digest();
 const signature=Buffer.from(match[2],'hex');
 return signature.length===mac.length&&timingSafeEqual(signature,mac);
}
const webhookEnvelope=z.object({
 event:z.string().min(1).max(100).optional(),
 transaction:z.object({reference_id:transactionId}).passthrough().optional(),
 id:transactionId.optional(),
}).passthrough();

/** Recognize ONLY the unsigned SyncPay dashboard connectivity test (no event data).
 * This function makes no DB calls and does not authenticate financial events. */
export function annualDashboardWebhookTest(rawBody:Buffer):boolean{
 if(rawBody.length===0||rawBody.length>2048)return false;
 let value:unknown;
 try{value=JSON.parse(rawBody.toString('utf8'));}catch{return false;}
 return z.object({
  test:z.literal(true),
  message:z.literal('This is a test webhook payload.'),
  timestamp:z.iso.datetime({offset:true})
 }).strict().safeParse(value).success;
}
export async function handleAnnualCreditCardWebhook(req:Request,res:ExpressResponse,fetcher:typeof fetch=fetch){
 const raw=Buffer.isBuffer(req.body)?req.body:null;
 if(!raw||raw.length===0||raw.length>65536){res.status(400).end();return;}
 // SyncPay dashboard sends this unsigned synthetic test. It must NEVER touch orders.
 if(annualDashboardWebhookTest(raw)){res.status(200).json({received:true,test:true});return;}
 if(!annualWebhookAuthenticated(req.get('x-syncpay-signature'),process.env.SYNCPAY_ANNUAL_WEBHOOK_SECRET,raw)){
  res.status(401).end();return;
 }
 let parsed:z.infer<typeof webhookEnvelope>;
 try{
  parsed=webhookEnvelope.parse(JSON.parse(raw.toString('utf8')));
 }catch{res.status(400).end();return;}
 const id=parsed.transaction?.reference_id??parsed.id;
 // Eventos sem identificador de transacao nao comprovam pagamento algum.
 if(!id){res.status(204).end();return;}
 const database=db();
 const result=await database.from('fio_annual_orders')
  .select('id,barbershop_id,actor_user_id,external_id,base_amount_cents,state,provider_transaction_id')
  .eq('provider_transaction_id',id).limit(1).maybeSingle();
 dbError(result.error);
 const row=result.data;
 if(!row){res.status(204).end();return;}
 // Tanto o webhook 'created' quanto o 'updated' apenas disparam um GET autenticado.
 // 'completed' no POST do webhook nao concede acesso diretamente.
 if(row.state==='review'){
  await checkAnnualCreditCard({shopId:row.barbershop_id,userId:row.actor_user_id,
   member:{role:'OWNER'}} as TenantContext,row.id,fetcher);
 }else if(row.state==='paid'){
  // Estorno/chargeback confirmado no provedor remove apenas o acesso anual
  // que ainda corresponde a este pedido, preservando dados da barbearia.
  const detail=await provider(fetcher,`/api/partner/v2/transactions/${encodeURIComponent(id)}`);
  const proof=normalizeAnnualCardProof(detail,{id,amountCents:row.base_amount_cents});
  if(proof.state==='refunded'){
   const revoked=await database.rpc('fio_reverse_annual_order_v13',{
    p_order_id:row.id,p_transaction_id:id
   });
   dbError(revoked.error);
  }
 }
 res.status(204).end();
}
