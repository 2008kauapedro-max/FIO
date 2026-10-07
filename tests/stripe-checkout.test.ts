import { describe,expect,it } from 'vitest';
import type Stripe from 'stripe';
import { buildStripeCheckoutParams,normalizeStripeStatus,subscriptionIdFromEvent,stripeInternals } from '../server/stripe.js';

describe('Stripe Checkout FIO',()=>{
 it('usa o catalogo do FIO como preco-base em BRL',()=>{
  expect(stripeInternals.planConfig('PRO','monthly')).toMatchObject({
   amountCents:14990,
   interval:'month',
   publicName:'FIO PRO'
  });

  expect(stripeInternals.planConfig('SOLO','annual')).toMatchObject({
   amountCents:76704,
   interval:'year',
   publicName:'FIO PRO'
  });
 });

 it('cria Checkout de assinatura com cartao e Adaptive Pricing',()=>{
  const params=buildStripeCheckoutParams(
   'PREMIUM',
   'monthly',
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   'owner@example.com',
   'http://127.0.0.1:5173'
  );

  expect(params.mode).toBe('subscription');
  expect(params.adaptive_pricing).toEqual({enabled:true});
  expect(params.payment_method_types).toEqual(['card']);
  expect(params.customer_email).toBe('owner@example.com');
  expect(params.client_reference_id).toBe('11111111-1111-4111-8111-111111111111');

  const item=params.line_items?.[0];
  expect(item?.price_data?.currency).toBe('brl');
  expect(item?.price_data?.unit_amount).toBe(29990);
  expect(item?.price_data?.recurring?.interval).toBe('month');
  expect(params.metadata?.fio_plan).toBe('PREMIUM');
  expect(params.subscription_data?.metadata?.fio_plan).toBe('PREMIUM');
 });

 it('normaliza estados Stripe para o billing do FIO',()=>{
  expect(normalizeStripeStatus('active')).toBe('active');
  expect(normalizeStripeStatus('trialing')).toBe('active');
  expect(normalizeStripeStatus('past_due')).toBe('overdue');
  expect(normalizeStripeStatus('unpaid')).toBe('suspended');
  expect(normalizeStripeStatus('canceled')).toBe('cancelled');
  expect(normalizeStripeStatus('incomplete')).toBe('pending_first_payment');
 });

 it('encontra a assinatura em eventos relevantes',()=>{
  const checkout={
   type:'checkout.session.completed',
   data:{object:{subscription:'sub_checkout'}}
  } as unknown as Stripe.Event;

  const subscription={
   type:'customer.subscription.updated',
   data:{object:{id:'sub_update'}}
  } as unknown as Stripe.Event;

  const invoice={
   type:'invoice.paid',
   data:{object:{parent:{subscription_details:{subscription:'sub_invoice'}}}}
  } as unknown as Stripe.Event;

  expect(subscriptionIdFromEvent(checkout)).toBe('sub_checkout');
  expect(subscriptionIdFromEvent(subscription)).toBe('sub_update');
  expect(subscriptionIdFromEvent(invoice)).toBe('sub_invoice');
 });
});
