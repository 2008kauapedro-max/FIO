import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildStripeCheckoutParams} from '../server/stripe.js';

const stripe=readFileSync('server/stripe.ts','utf8');
const app=readFileSync('server/app.ts','utf8');
const plans=readFileSync('src/pages/FioPlans.tsx','utf8');
const billing=readFileSync('shared/billing-state.ts','utf8');

describe('FIO MVP - contrato Stripe/SyncPay',()=>{
 it('faz retorno do Checkout para o painel correto',()=>{
  const params=buildStripeCheckoutParams('PRO','monthly',
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   'cliente@example.test','https://usefio.example');
  expect(params.success_url).toContain('/owner/plano-fio?stripe=success&session_id=');
  expect(params.cancel_url).toBe('https://usefio.example/owner/plano-fio?stripe=cancelled');
 });
 it('nao reutiliza idempotencia eterna de um plano',()=>{
  expect(stripe).toContain('randomUUID()');
  expect(stripe).not.toContain('fio-checkout-v1:');
 });
 it('só considera ativo apos retorno do estado gravado pelo webhook',()=>{
  expect(plans).toContain("result.subscription?.provider==='stripe'&&result.subscription.providerStatus==='active'");
  expect(plans).toContain('await p.refresh()');
 });
 it('faz consulta de assinatura Stripe com escopo de barbearia',()=>{
  expect(stripe).toContain(".eq('barbershop_id',ctx.shopId).eq('provider','stripe')");
  expect(app).toContain('getStripeBilling(c)');
  expect(billing).toContain("provider:'syncpay'|'stripe'");
 });
 it('roteia gerenciamento da Stripe para portal exclusivo do dono, sem usar rotas SyncPay',()=>{
  expect(app).toContain("app.post('/api/saas/stripe/portal'");
  expect(stripe).toContain("ctx.member.role!=='OWNER'");
  expect(stripe).toContain("url.hostname!=='billing.stripe.com'");
  expect(plans).toContain("if(billing?.provider==='stripe')");
  expect(plans).toContain("{billing.provider==='stripe'?<>");
 });
});
