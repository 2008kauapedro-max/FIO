import { z } from 'zod';
import { checkAnnualPaymentEvidence } from '../shared/fio-annual-orders.js';

/**
 * Strict mapping from a NORMALIZED, AUTHENTICATED provider lookup to RPC input.
 * This function does not itself authenticate SyncPay or release access.
 * NEVER call it with browser input, return_url or raw webhook JSON.
 * The provider adapter and authenticated lookup are NOT implemented yet.
 */
const lookupSchema=z.object({
 source:z.literal('provider_lookup'),
 externalId:z.string().min(16).max(160),
 providerOrderId:z.string().min(1).max(200),
 providerTransactionId:z.string().min(1).max(200),
 status:z.enum(['paid','completed']),
 currency:z.literal('BRL'),
 merchantNetCents:z.number().int().positive(),
 paidAt:z.iso.datetime({offset:true})
}).strict();

const orderSchema=z.object({
 id:z.uuid(),
 external_id:z.string().min(16).max(160),
 provider_order_id:z.string().min(1).max(200),
 base_amount_cents:z.number().int().positive(),
 state:z.enum(['checkout_ready','review']),
 created_at:z.iso.datetime({offset:true})
}).strict();

export type AnnualSettlementCommand={
 p_order_id:string;
 p_external_id:string;
 p_provider_order_id:string;
 p_provider_transaction_id:string;
 p_merchant_net_cents:number;
 p_paid_at:string;
};

/** Pure validation, no database writes, network calls or payment side effects. */
export function annualSettlementCommand(orderInput:unknown,lookupInput:unknown,at:Date=new Date()):AnnualSettlementCommand{
 const order=orderSchema.parse(orderInput);
 const proof=lookupSchema.parse(lookupInput);
 const now=at.getTime();
 const paidTime=Date.parse(proof.paidAt);
 const createdTime=Date.parse(order.created_at);
 if(!Number.isFinite(now)||!Number.isFinite(paidTime)||!Number.isFinite(createdTime))throw new Error('ANNUAL_INVALID_TIME');
 if(paidTime<createdTime-300_000||paidTime>now+300_000)throw new Error('ANNUAL_PAYMENT_TIME_MISMATCH');
 if(!checkAnnualPaymentEvidence(
  {externalId:order.external_id,providerOrderId:order.provider_order_id,amountCents:order.base_amount_cents},
  {source:proof.source,externalId:proof.externalId,providerOrderId:proof.providerOrderId,
   status:proof.status,currency:proof.currency,merchantNetCents:proof.merchantNetCents,paidAt:proof.paidAt}
 ))throw new Error('ANNUAL_PAYMENT_EVIDENCE_MISMATCH');
 return Object.freeze({
  p_order_id:order.id,
  p_external_id:order.external_id,
  p_provider_order_id:order.provider_order_id,
  p_provider_transaction_id:proof.providerTransactionId,
  p_merchant_net_cents:proof.merchantNetCents,
  p_paid_at:proof.paidAt
 });
}
