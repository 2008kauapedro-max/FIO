import {describe,it,expect} from 'vitest';
import {ANNUAL_ORDER_FEATURE,buildAnnualDraft,validateAnnualCheckoutUrl,checkAnnualPaymentEvidence} from '../shared/fio-annual-orders.js';

const orderId='26b14c7d-4e0c-4bb7-a3c1-500000000001';
const shopId='6ca58a7d-4e0c-4bb7-a3c1-600000000002';
const make=(plan:'PRO'|'PREMIUM'|'SOLO'|'SOLO_PREMIUM'='PRO',mode:'SHOP'|'SOLO'='SHOP')=>
 buildAnnualDraft({orderId,shopId,plan,mode});

describe('FIO anual - pedido seguro (sem cobranca ativa)',()=>{
 it('usa preco oficial de 20 porcento exatos e nao renova automaticamente',()=>{
  expect(make('PRO')).toMatchObject({baseAmountCents:143904,maxInstallments:12,installmentFeesPaidBy:'customer',automaticRenewal:false,accessDays:365});
  expect(make('PREMIUM').baseAmountCents).toBe(287904);
  expect(make('SOLO','SOLO').baseAmountCents).toBe(76704);
  expect(make('SOLO_PREMIUM','SOLO').baseAmountCents).toBe(189984);
 });
 it('usa id unico por tentativa, nao somente o id da barbearia',()=>{
  const a=make();
  const b=buildAnnualDraft({orderId:'26b14c7d-4e0c-4bb7-a3c1-500000000003',shopId,plan:'PRO',mode:'SHOP'});
  expect(a.externalId).not.toBe(b.externalId);
  expect(a.externalId).not.toContain(shopId);
  expect(a.externalId).toContain(orderId);
 });
 it('bloqueia comprar plano de equipe no modo solo e vice-versa',()=>{
  expect(()=>make('PRO','SOLO')).toThrow('ANNUAL_PLAN_MODE_MISMATCH');
  expect(()=>make('SOLO','SHOP')).toThrow('ANNUAL_PLAN_MODE_MISMATCH');
 });
 it('rejeita id invalido antes de preparar pedido',()=>{
  expect(()=>buildAnnualDraft({orderId:'123',shopId,plan:'PRO',mode:'SHOP'})).toThrow('ANNUAL_INVALID_ID');
 });
 it('nao aceita checkout antes de autorizar o host da SyncPay',()=>{
  expect(validateAnnualCheckoutUrl('https://app.syncpayments.com.br/checkout/abc',[])).toBeNull();
 });
 it('aceita HTTPS somente em host explicitamente autorizado',()=>{
  expect(validateAnnualCheckoutUrl('https://app.syncpayments.com.br/checkout/abc?t=1',['app.syncpayments.com.br']))
   .toBe('https://app.syncpayments.com.br/checkout/abc?t=1');
  for(const url of ['http://app.syncpayments.com.br/pay','https://app.syncpayments.com.br.evil.test/pay','https://evil.test/pay','https://user:pass@app.syncpayments.com.br/pay','https://app.syncpayments.com.br:8443/pay','https://app.syncpayments.com.br/pay#anchor'])
   expect(validateAnnualCheckoutUrl(url,['app.syncpayments.com.br'])).toBeNull();
 });
 const expected={externalId:`fio-annual-${orderId}`,providerOrderId:'syncpay-order-0001',amountCents:143904};
 const paid={source:'provider_lookup' as const,externalId:expected.externalId,providerOrderId:expected.providerOrderId,status:'paid',currency:'BRL',merchantNetCents:143904,paidAt:'2026-10-15T10:00:00.000Z'};
 it('aceita como evidencia apenas resposta confiavel com todos os dados iguais',()=>{
  expect(checkAnnualPaymentEvidence(expected,paid)).toBe(true);
 });
 it('retorno do navegador ou webhook sem validacao jamais libera acesso',()=>{
  expect(checkAnnualPaymentEvidence(expected,{...paid,source:'browser_redirect'})).toBe(false);
  expect(checkAnnualPaymentEvidence(expected,{...paid,source:'unverified_webhook'})).toBe(false);
 });
 it('rejeita valor incorreto, referencia trocada, moeda ou pagamento pendente',()=>{
  expect(checkAnnualPaymentEvidence(expected,{...paid,merchantNetCents:100})).toBe(false);
  expect(checkAnnualPaymentEvidence(expected,{...paid,externalId:'fio-annual-outro'})).toBe(false);
  expect(checkAnnualPaymentEvidence(expected,{...paid,providerOrderId:'outro'})).toBe(false);
  expect(checkAnnualPaymentEvidence(expected,{...paid,status:'pending'})).toBe(false);
  expect(checkAnnualPaymentEvidence(expected,{...paid,currency:'USD'})).toBe(false);
  expect(checkAnnualPaymentEvidence(expected,{...paid,paidAt:null})).toBe(false);
 });
 it('mantem criacao e concessao de acesso desativadas por padrao',()=>{
  expect(ANNUAL_ORDER_FEATURE.checkoutCreationEnabled).toBe(false);
  expect(ANNUAL_ORDER_FEATURE.accessGrantEnabled).toBe(false);
  expect(ANNUAL_ORDER_FEATURE.requiresVerifiedProviderContract).toBe(true);
 });
});
