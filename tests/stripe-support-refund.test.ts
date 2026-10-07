import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {stripeRefundWithinWindow,STRIPE_REFUND_WINDOW_MS} from '../server/stripe.js';

describe('FIO - Stripe + ajuda e reembolso em 7 dias',()=>{
 it('7 dias corridos exatos contam pelo servidor e nunca aceitam data futura',()=>{
  const paid=1_800_000_000;
  const origin=paid*1000;
  expect(STRIPE_REFUND_WINDOW_MS).toBe(604800000);
  expect(stripeRefundWithinWindow(paid,origin)).toBe(true);
  expect(stripeRefundWithinWindow(paid,origin+STRIPE_REFUND_WINDOW_MS)).toBe(true);
  expect(stripeRefundWithinWindow(paid,origin+STRIPE_REFUND_WINDOW_MS+1)).toBe(false);
  expect(stripeRefundWithinWindow(paid,origin-1)).toBe(false);
  expect(stripeRefundWithinWindow(NaN)).toBe(false);
 });
 it('solicita Stripe apenas ao owner, sem aceitar IDs do browser',()=>{
  const app=readFileSync('server/app.ts','utf8');
  const stripe=readFileSync('server/stripe.ts','utf8');
  expect(app).toContain("'/api/saas/stripe/refund-policy'");
  expect(app).toContain("'/api/saas/stripe/refund'");
  expect(stripe).toContain("z.object({confirmed:z.literal(true)}).strict().parse(raw)");
  expect(stripe).toContain(".eq('barbershop_id',ctx.shopId)");
  expect(stripe).toContain('metadata.fio_shop_id!==ctx.shopId');
  expect(stripe).toContain('stripe.invoicePayments.list');
 });
 it('reembolso usa PaymentIntent do primeiro pagamento + idempotencia',()=>{
  const stripe=readFileSync('server/stripe.ts','utf8');
  expect(stripe).toContain('payment_intent:paymentIntentId');
  expect(stripe).toContain('fio-7day-refund-v1:');
  expect(stripe).toContain("refund.status==='failed'");
  expect(stripe).toContain('stripe.subscriptions.cancel');
 });
 it('a central simplificada usa o formulario ja existente e esconde reembolso para cliente',()=>{
  const support=readFileSync('src/pages/FioSupport.tsx','utf8');
  const app=readFileSync('src/App.tsx','utf8');
  expect(support).toContain("const owner=p.data.membership.role==='OWNER'");
  expect(support).toContain("await api('/support/feedback'");
  expect(support).toContain("api<RefundResult>('/saas/stripe/refund'");
  expect(support).toContain('{owner&&<section className="fio-help-billing">');
  expect(app).toContain("case '/suporte':content=<FioSupport {...props}/>;");
 });
 it('plano Stripe aponta para a central de ajuda',()=>{
  const plans=readFileSync('src/pages/FioPlans.tsx','utf8');
  expect(plans).toContain('Reembolso e suporte FIO');
  expect(plans).toContain("navigate(p.base+'/suporte')");
 });
});
