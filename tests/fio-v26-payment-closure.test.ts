import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {syncpayBuyerIp} from '../server/syncpay';
import {annualCreditCardLiveEnabled} from '../server/fio-annual-credit-card';

describe('FIO V26: consolidacao de seguranca e formas de pagamento',()=>{
 const server=readFileSync('server/app.ts','utf8');
 const syncpay=readFileSync('server/syncpay.ts','utf8');
 const ui=readFileSync('src/pages/FioPlans.tsx','utf8');
 it('bloqueia novas vendas pelo Stripe preservando acesso aos contratos antigos',()=>{
  expect(server).toContain("throw new ApiError(410,'STRIPE_NEW_CHECKOUT_DISABLED'");
  expect(server).toContain("'/api/saas/stripe/portal'");
  expect(server).toContain("'/api/saas/stripe/refund'");
  expect(server).toContain('getStripeBilling(c)');
  expect(ui).toContain('setStripeConfigured(false)');
 });
 it('impede novas vendas por Pix manual, mas conserva gestao de cobrancas antigas',()=>{
  expect(syncpay).toContain("if(input.method==='qr_code'&&fioNewLegacyPixSalesDisabled())throw new ApiError(410");
  expect(ui).toContain('setLegacyPixCheckoutConfigured(false)');
  expect(server).toContain("'/api/saas/charge'");
 });
 it('nunca usa o IP do servidor nem aceita IP arbitrario ou local',()=>{
  expect(syncpayBuyerIp(undefined)).toBeNull();
  for(const ip of ['','garbage','8.8.8.999','10.0.0.4','127.0.0.1','169.254.1.1','192.168.1.1','172.16.0.1','::','::1','1.2.3.4.5','169.254.1.1.'])
   expect(syncpayBuyerIp(ip)).toBeNull();
  expect(syncpayBuyerIp('187.45.201.10')).toBe('187.45.201.10');
  expect(syncpayBuyerIp('187.45.201.10, 10.0.0.1')).toBe('187.45.201.10');
 });
 it('envia customer_ip exclusivamente na adesao de cartao (quando validado)',()=>{
  expect(server).toContain("req.get('x-vercel-forwarded-for')");
  expect(syncpay).toContain("if(input.method==='credit_card'){");
  expect(syncpay).toContain("payload.card={token:input.cardToken!};");
  expect(syncpay).toContain("const buyerIp=syncpayBuyerIp(buyerIpHeader);");
  expect(syncpay).toContain('if(buyerIp)payload.customer_ip=buyerIp');
  expect(syncpay).not.toContain('charge_now');
  expect(syncpay).not.toContain('payload.card={number:');
 });
 it('nao habilita pagamento anual com chave publica de cartao ausente',()=>{
  const fields=['FIO_ENABLE_ANNUAL_API_CHARGES','FIO_ENABLE_ANNUAL_ORDER_DRAFTS','SYNCPAY_CLIENT_ID','SYNCPAY_CLIENT_SECRET','VITE_SYNCPAY_PUBLIC_KEY'] as const;
  const old=fields.map(f=>process.env[f]);
  try{
   process.env.FIO_ENABLE_ANNUAL_API_CHARGES='true';
   process.env.FIO_ENABLE_ANNUAL_ORDER_DRAFTS='true';
   process.env.SYNCPAY_CLIENT_ID='fake';process.env.SYNCPAY_CLIENT_SECRET='fake';
   delete process.env.VITE_SYNCPAY_PUBLIC_KEY;
   expect(annualCreditCardLiveEnabled()).toBe(false);
   process.env.VITE_SYNCPAY_PUBLIC_KEY='pk_live_validkey12345';
   expect(annualCreditCardLiveEnabled()).toBe(true);
  }finally{fields.forEach((f,i)=>{if(old[i]===undefined)delete process.env[f];else process.env[f]=old[i];});}
 });
});
