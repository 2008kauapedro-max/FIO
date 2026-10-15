import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { TenantContext } from './context.js';
import { ApiError,dbError } from './errors.js';
import { buildAnnualDraft,type AnnualPaidPlan,type AnnualMode,ANNUAL_ORDER_FEATURE } from '../shared/fio-annual-orders.js';

const annualPlan=z.enum(['SOLO','SOLO_PREMIUM','PRO','PREMIUM']);

/** Read-only, owner-only offer preview. Never contacts SyncPay or writes to DB. */
export async function getAnnualOffer(ctx:TenantContext,rawPlan:unknown){
 if(ctx.member.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','Somente o responsavel pode consultar a contratacao.');
 const plan=annualPlan.parse(rawPlan) as AnnualPaidPlan;
 const shop=await ctx.db.from('barbershops').select('operation_mode').eq('id',ctx.shopId).single();
 dbError(shop.error);
 if(shop.data?.operation_mode!=='SOLO'&&shop.data?.operation_mode!=='SHOP')
  throw new ApiError(409,'ANNUAL_MODE_UNAVAILABLE','Modo da barbearia indisponivel.');
 let draft;
 try{
  draft=buildAnnualDraft({orderId:randomUUID(),shopId:ctx.shopId,plan,mode:shop.data.operation_mode as AnnualMode});
 }catch(error){
  if(error instanceof Error&&error.message==='ANNUAL_PLAN_MODE_MISMATCH')
   throw new ApiError(400,'INVALID_PLAN','Escolha um plano compativel com sua barbearia.');
  throw error;
 }
 // No order/external_id is persisted: generating an offer never initiates a charge.
 return {
  plan:draft.plan,cycle:draft.cycle,currency:draft.currency,
  baseAmountCents:draft.baseAmountCents,accessDays:draft.accessDays,
  maxInstallments:draft.maxInstallments,installmentFeesPaidBy:draft.installmentFeesPaidBy,
  paymentMethod:draft.paymentMethod,automaticRenewal:draft.automaticRenewal,
  checkoutEnabled:ANNUAL_ORDER_FEATURE.checkoutCreationEnabled,
  needsVerifiedProviderContract:ANNUAL_ORDER_FEATURE.requiresVerifiedProviderContract,
  note:'Compra anual em preparacao. Nenhuma cobranca foi iniciada. As taxas serao confirmadas pela SyncPay antes de pagar.'
 };
}

/** Fail closed even if a caller discovers/guesses the checkout route. */
export function annualCheckoutUnavailable():never{
 throw new ApiError(503,'ANNUAL_CHECKOUT_DISABLED',
  'A compra anual ainda nao esta habilitada. Nenhuma cobranca foi iniciada.');
}