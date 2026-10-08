import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Stripe na UI do FIO',()=>{
 const ui=readFileSync('src/pages/FioPlans.tsx','utf8');
 const app=readFileSync('server/app.ts','utf8');
 const stripe=readFileSync('server/stripe.ts','utf8');

 it('oferece Cartao e Pix mantendo o Pix QR legado da SyncPay',()=>{
  expect(ui).toContain("type PaymentMethod='card'|'pix'|'pix-auto'|'sync-card'");
  expect(ui).toContain('Continuar com cartão');
  expect(ui).toContain("'Gerar Pix'");
  expect(ui).toContain('pixAutomaticoConfigured');
  expect(ui).toContain("method:paymentMethod==='sync-card'?'credit_card':paymentMethod==='pix-auto'?'pix_automatico':'qr_code'");
 });

 it('Cartao usa apenas Checkout Stripe hospedado',()=>{
  expect(ui).toContain("'/saas/stripe/checkout'");
  expect(ui).toContain("checkoutUrl.hostname!=='checkout.stripe.com'");
  expect(ui).toContain('window.location.assign(checkoutUrl.toString())');
 });

 it('CPF/CNPJ permanece no fluxo Pix SyncPay',()=>{
  expect(ui).toContain("paymentMethod==='card'");
  expect(ui).toContain('CPF ou CNPJ do responsável');
  expect(ui).toContain('document:digits');
 });

 it('backend informa se Stripe esta configurada',()=>{
  expect(app).toContain('stripeConfigured:stripeCheckoutConfigured()');
  expect(stripe).toContain('export function stripeCheckoutConfigured()');
 });
});
