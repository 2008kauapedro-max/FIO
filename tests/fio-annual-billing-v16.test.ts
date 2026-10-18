import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {annualBillingView,type AnnualVerifiedOrder,type AnnualVerifiedSubscription} from '../server/fio-annual-billing.js';

const paidAt='2026-10-15T12:00:00.000Z';
const until='2027-10-15T12:00:00.000Z';
const row:AnnualVerifiedOrder={
 barbershop_id:'6ca58a7d-4e0c-4bb7-a3c1-600000000002',plan_code:'PRO',
 billing_cycle:'annual',currency:'BRL',base_amount_cents:143904,state:'paid',
 provider_order_id:'transaction-test-123456',provider_transaction_id:'transaction-test-123456',
 verified_at:'2026-10-15T12:05:00Z',paid_at:paidAt,access_starts_at:paidAt,access_ends_at:until
};
const sub:AnnualVerifiedSubscription={plan:'PRO',status:'active',starts_at:paidAt,expires_at:until};
const now=Date.parse('2026-10-20T12:00:00Z');

describe('FIO V16 - assinatura anual exibida sem converter em recorrente',()=>{
 it('reconhece pagamento verificado que corresponde ao acesso atual de 365 dias',()=>{
  expect(annualBillingView(row,sub,now)).toMatchObject({provider:'annual',providerStatus:'active',
   plan:'PRO',cycle:'annual',amountCents:143904,automaticRenewal:false,accessEndsAt:until});
 });
 it('nao mostra como ativo pedido nao pago, reembolsado ou cancelado',()=>{
  for(const state of ['preparing','submitting','review','failed','refunded','cancelled'])
   expect(annualBillingView({...row,state},sub,now)).toBeNull();
 });
 it('nao confunde recibo antigo com assinatura posterior de outra modalidade',()=>{
  expect(annualBillingView(row,{...sub,plan:'FREE'},now)).toBeNull();
  expect(annualBillingView(row,{...sub,status:'cancelled'},now)).toBeNull();
  expect(annualBillingView(row,{...sub,starts_at:'2026-11-15T12:00:00Z'},now)).toBeNull();
  expect(annualBillingView(row,{...sub,expires_at:'2027-11-15T12:00:00Z'},now)).toBeNull();
 });
 it('sem transacao vinculada e datas comprovadas nao anuncia assinatura paga',()=>{
  expect(annualBillingView({...row,provider_transaction_id:null},sub,now)).toBeNull();
  expect(annualBillingView({...row,provider_order_id:'different'},sub,now)).toBeNull();
  expect(annualBillingView({...row,paid_at:null},sub,now)).toBeNull();
  expect(annualBillingView({...row,access_ends_at:'2027-10-14T12:00:00Z'},sub,now)).toBeNull();
  expect(annualBillingView({...row,currency:'USD'},sub,now)).toBeNull();
 });
 it('recusa periodo ja vencido e nunca habilita renovacao automatica',()=>{
  expect(annualBillingView(row,sub,Date.parse('2027-10-15T12:00:01Z'))).toBeNull();
  expect(annualBillingView(row,sub,now)?.automaticRenewal).toBe(false);
 });
 it('consulta a compra anual antes de contratos antigos na rota de billing',()=>{
  const app=readFileSync('server/app.ts','utf8');
  const from=app.indexOf("app.get('/api/saas/billing'");
  const fragment=app.slice(from,from+1300);
  expect(fragment).toContain('getActiveAnnualBilling(c.shopId,serviceDb())');
  expect(fragment.indexOf('getActiveAnnualBilling')).toBeLessThan(fragment.indexOf('getStripeBilling'));
 });
 it('antigos eventos recorrentes nao mudam um periodo anual atual',()=>{
  const syncpay=readFileSync('server/syncpay.ts','utf8');
  expect(syncpay).toContain('if(owner.data&&await getActiveAnnualBilling(owner.data.barbershop_id,db))');
  expect(syncpay).toContain('ANNUAL_ACTIVE_CONTRACT');
 });
 it('migration grava evidencia verificada apos gatilho de reativacao',()=>{
  const sql=readFileSync('supabase/migrations/20261018160000_fio_annual_verified_period_v16.sql','utf8');
  expect(sql).toContain('UPDATE public.saas_subscriptions SET verified_paid_until=v_end');
  expect(sql).toContain("IF NOT FOUND THEN RAISE EXCEPTION 'ANNUAL_VERIFIED_PERIOD_NOT_RECORDED'");
  expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.fio_settle_annual_order_v10');
 });
});