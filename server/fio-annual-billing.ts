import type {SupabaseClient} from '@supabase/supabase-js';
import type {BillingState,PaidPlan} from '../shared/billing-state.js';
import {dbError} from './errors.js';

export type AnnualVerifiedOrder={
 barbershop_id:string;plan_code:string;billing_cycle:string;currency:string;
 base_amount_cents:number;state:string;provider_order_id:string|null;
 provider_transaction_id:string|null;verified_at:string|null;paid_at:string|null;
 access_starts_at:string|null;access_ends_at:string|null;
};
export type AnnualVerifiedSubscription={
 plan:string;status:string;starts_at:string|null;expires_at:string|null;
};
const annualPlans=new Set(['SOLO','SOLO_PREMIUM','PRO','PREMIUM']);
const instant=(value:string|null)=>value?Date.parse(value):NaN;

/** Display only a paid annual order that STILL matches the actual FIO entitlement.
 * A receipt alone cannot activate a plan. Refunds and later subscriptions win. */
export function annualBillingView(
 order:AnnualVerifiedOrder|null,subscription:AnnualVerifiedSubscription|null,
 now=Date.now()
):BillingState|null{
 if(!order||!subscription||order.state!=='paid'||order.billing_cycle!=='annual'||
    order.currency!=='BRL'||!annualPlans.has(order.plan_code)||
    !Number.isSafeInteger(order.base_amount_cents)||order.base_amount_cents<=0||
    !order.provider_transaction_id||order.provider_order_id!==order.provider_transaction_id||
    !Number.isFinite(instant(order.verified_at))||
    subscription.plan!==order.plan_code||subscription.status!=='active')return null;
 const paid=instant(order.paid_at),start=instant(order.access_starts_at),end=instant(order.access_ends_at);
 if(!Number.isFinite(paid)||!Number.isFinite(start)||!Number.isFinite(end)||
    start!==paid||end-start!==365*86400_000||end<=now||
    instant(subscription.starts_at)!==start||instant(subscription.expires_at)!==end)return null;
 return {
  provider:'annual',providerStatus:'active',billingMethod:'credit_card',
  plan:order.plan_code as PaidPlan,cycle:'annual',amountCents:order.base_amount_cents,
  nextChargeAt:null,payment:null,refund:{eligible:false,deadline:null},
  accessEndsAt:order.access_ends_at,automaticRenewal:false
 };
}

/** Read-only service-role check, safe independently of the checkout feature flags. */
export async function getActiveAnnualBilling(shopId:string,database:SupabaseClient):Promise<BillingState|null>{
 const result=await database.from('fio_annual_orders')
  .select('barbershop_id,plan_code,billing_cycle,currency,base_amount_cents,state,provider_order_id,provider_transaction_id,verified_at,paid_at,access_starts_at,access_ends_at')
  .eq('barbershop_id',shopId).eq('state','paid')
  .gt('access_ends_at',new Date().toISOString())
  .order('created_at',{ascending:false}).limit(1).maybeSingle();
 dbError(result.error);
 if(!result.data)return null;
 const subscription=await database.from('saas_subscriptions')
  .select('plan,status,starts_at,expires_at')
  .eq('barbershop_id',shopId).maybeSingle();
 dbError(subscription.error);
 return annualBillingView(result.data as AnnualVerifiedOrder,subscription.data as AnnualVerifiedSubscription|null);
}