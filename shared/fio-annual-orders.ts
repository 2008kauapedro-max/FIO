/**
 * FIO: contrato interno de pedido anual avulso.
 * Nenhuma funcao deste arquivo envia cobrancas ou concede acesso.
 * O contrato JSON da API /api/v1/orders ainda precisa ser comprovado em teste controlado.
 */
import { FIO_PLAN_CATALOG } from './fio-plans.js';

export type AnnualPaidPlan = 'SOLO'|'SOLO_PREMIUM'|'PRO'|'PREMIUM';
export type AnnualMode = 'SOLO'|'SHOP';

export type AnnualDraft = Readonly<{
 orderId:string;
 shopId:string;
 externalId:string;
 plan:AnnualPaidPlan;
 cycle:'annual';
 currency:'BRL';
 baseAmountCents:number;
 maxInstallments:12;
 installmentFeesPaidBy:'customer';
 paymentMethod:'credit_card';
 automaticRenewal:false;
 accessDays:365;
}>;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHOP_PLANS=new Set<AnnualPaidPlan>(['PRO','PREMIUM']);
const SOLO_PLANS=new Set<AnnualPaidPlan>(['SOLO','SOLO_PREMIUM']);

/** Use crypto.randomUUID() on the trusted SERVER to create orderId. */
export function buildAnnualDraft(input:{orderId:string;shopId:string;plan:AnnualPaidPlan;mode:AnnualMode}):AnnualDraft {
 if(!UUID.test(input.orderId)||!UUID.test(input.shopId))throw new Error('ANNUAL_INVALID_ID');
 const allowed=input.mode==='SOLO'?SOLO_PLANS:input.mode==='SHOP'?SHOP_PLANS:null;
 if(!allowed?.has(input.plan))throw new Error('ANNUAL_PLAN_MODE_MISMATCH');
 const plan=FIO_PLAN_CATALOG.find(item=>item.code===input.plan);
 const monthly=plan?.prices.monthly,annual=plan?.prices.annual;
 if(!monthly||!annual||annual!==monthly*12*4/5)throw new Error('ANNUAL_PRICE_MISMATCH');
 return Object.freeze({
  orderId:input.orderId.toLowerCase(),shopId:input.shopId.toLowerCase(),
  // Never use only the barbershop ID as an external payment identifier:
  // each attempted purchase must have a unique, immutable external ID.
  externalId:`fio-annual-${input.orderId.toLowerCase()}`,
  plan:input.plan,cycle:'annual',currency:'BRL',baseAmountCents:annual,
  maxInstallments:12,installmentFeesPaidBy:'customer',
  paymentMethod:'credit_card',automaticRenewal:false,accessDays:365
 });
}

/**
 * The hosted checkout hostname is NOT confirmed yet. Require an explicit
 * exact-host allowlist based on a genuine provider response. Fail closed.
 */
export function validateAnnualCheckoutUrl(raw:unknown,allowedHosts:readonly string[]):string|null {
 if(typeof raw!=='string'||!raw||allowedHosts.length===0)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null;
  if(!allowedHosts.some(host=>host===url.hostname && host===host.toLowerCase() && !host.endsWith('.')))return null;
  return url.toString();
 }catch{return null;}
}

/**
 * Only a separately authenticated lookup from SyncPay can be used as evidence.
 * NEVER feed a browser return_url or an unverified webhook into this function.
 * This validates a future normalized provider response, not an undocumented payload.
 * It does NOT grant paid access (that needs an idempotent DB transaction).
 */
export function checkAnnualPaymentEvidence(expected:{externalId:string;amountCents:number;providerOrderId:string}, proof:{
 source:'provider_lookup'|'browser_redirect'|'unverified_webhook';
 externalId:string;providerOrderId:string;
 status:string;currency:string;merchantNetCents:number;
 paidAt:string|null;
}):boolean {
 if(proof.source!=='provider_lookup'||!expected.providerOrderId||!proof.providerOrderId)return false;
 if(proof.externalId!==expected.externalId||proof.providerOrderId!==expected.providerOrderId)return false;
 if(!['paid','completed'].includes(proof.status)||proof.currency!=='BRL')return false;
 if(proof.merchantNetCents!==expected.amountCents)return false;
 if(!proof.paidAt||!Number.isFinite(Date.parse(proof.paidAt)))return false;
 return true;
}

export const ANNUAL_ORDER_FEATURE={
 checkoutCreationEnabled:false,
 accessGrantEnabled:false,
 requiresVerifiedProviderContract:true,
 requiresIdempotentSettlement:true,
 automaticRenewal:false,
} as const;
