import {describe,it,expect} from 'vitest';
import {ApiError} from '../server/errors';
import {annualBuyerPhone} from '../server/fio-annual-credit-card';
import {fioPaymentReadiness} from '../server/fio-payment-readiness';
import {FIO_RENEWAL_GRACE_MS,fioEffectivePlan} from '../shared/fio-access-policy';
import {readFileSync} from 'node:fs';
describe('V25 pagamentos - validados sem cobrar ninguém',()=>{
 it('anual requer telefone do comprador com DDD antes de enviar cobrança',()=>{
  expect(annualBuyerPhone('(61) 99999-8888')).toBe('61999998888');
  expect(annualBuyerPhone('5511999998888')).toBe('5511999998888');
  for(const v of ['123','', '1'.repeat(14)]){
   expect(()=>annualBuyerPhone(v)).toThrow(ApiError);
  }
  const source=readFileSync('server/fio-annual-credit-card.ts','utf8');
  expect(source).toContain('phone:z.string().regex(/^\\d{10,13}$/)');
  expect(source.indexOf('const phone=annualBuyerPhone(input.phone)')).toBeLessThan(source.indexOf("fio_begin_annual_submission_v1"));
  expect(source).toContain('installments!==1');
 });
 it('anual inclui telefone no checkout e não permite cobrar sem ele',()=>{
  const source=readFileSync('src/pages/AnnualCardCheckout.tsx','utf8');
  expect(source).toContain('Telefone com DDD do pagador');
  expect(source).toContain("phone:phone.replace(/\\D/g,'')");
  expect(source).toContain("!/^\\d{10,13}$/.test(phone.replace(/\\D/g,''))");
 });
 it('sem credenciais/flags não informa falsamente pagamento habilitado',()=>{
  const state=fioPaymentReadiness({});
  expect(state.monthly.pixAutomaticoConfigured).toBe(false);
  expect(state.monthly.directCardConfigured).toBe(false);
  expect(state.annual.singleChargeConfigured).toBe(false);
  expect(state.annual.installmentQuoteConfigured).toBe(false);
  expect(state.safeToDeclareLive).toBe(false);
 });
 it('flags configuradas NÃO se tornam homologação nem simulam compra',()=>{
  const state=fioPaymentReadiness({
   SYNCPAY_CLIENT_ID:'fake',SYNCPAY_CLIENT_SECRET:'fake',
   FIO_ENABLE_PIX_AUTOMATICO:'true',FIO_ENABLE_SYNCPAY_HOSTED_CARD:'true',
   FIO_ENABLE_SYNCPAY_CARD:'true',FIO_ENABLE_ANNUAL_API_CHARGES:'true',
   FIO_ENABLE_ANNUAL_ORDER_DRAFTS:'true',VITE_SYNCPAY_PUBLIC_KEY:'pk_live_abcdefghijk',
   SYNCPAY_ANNUAL_WEBHOOK_SECRET:'not-a-real-secret',SYNCPAY_WEBHOOK_SECRET:'not-a-real-secret'
  });
  expect(state.monthly.pixAutomaticoConfigured).toBe(true);
  expect(state.monthly.hostedCardConfigured).toBe(true);
  expect(state.monthly.directCardConfigured).toBe(true);
  expect(state.annual.singleChargeConfigured).toBe(true);
  expect(state.annual.maxVerifiedInstallments).toBe(1);
  expect(state.annual.providerLivePaymentVerified).toBe(false);
  expect(state.safeToDeclareLive).toBe(false);
 });
 it('vencimento corta o plano, exceto tolerância comprovada de dois dias',()=>{
  const now=Date.parse('2026-10-19T12:00:00Z');
  const due=new Date(now-60_000).toISOString();
  const paid={plan:'PRO' as const,status:'past_due',starts_at:'2026-09-19T12:00:00Z',expires_at:due,verified_paid_until:due};
  expect(FIO_RENEWAL_GRACE_MS).toBe(48*60*60*1000);
  expect(fioEffectivePlan(paid,now)).toBe('PRO');
  expect(fioEffectivePlan(paid,now+FIO_RENEWAL_GRACE_MS)).toBe('FREE');
  expect(fioEffectivePlan({...paid,verified_paid_until:null},now)).toBe('FREE');
  expect(fioEffectivePlan({...paid,status:'trialing'},now)).toBe('FREE');
 });
 it('diagnóstico é apenas para OWNER e não expõe credenciais',()=>{
  const app=readFileSync('server/app.ts','utf8');
  expect(app).toContain("'/api/saas/payment-readiness'");
  expect(app).toContain('const c=ctx(res);requireOwner(c);');
  const fn=readFileSync('server/fio-payment-readiness.ts','utf8');
  expect(fn).not.toContain('env.SYNCPAY_CLIENT_SECRET,');
  expect(fn).not.toContain('fetch(');
 });
});
