import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { annualSettlementCommand } from '../server/fio-annual-evidence.js';

const now=new Date('2026-10-15T14:30:00.000Z');
const order={
 id:'26b14c7d-4e0c-4bb7-a3c1-500000000001',
 external_id:'fio-annual-26b14c7d-4e0c-4bb7-a3c1-500000000001',
 provider_order_id:'sp-order-abc',base_amount_cents:143904,
 state:'checkout_ready',created_at:'2026-10-15T14:00:00.000Z'
};
const proof={source:'provider_lookup',externalId:order.external_id,
 providerOrderId:'sp-order-abc',providerTransactionId:'sp-transaction-abc',
 status:'paid',currency:'BRL',merchantNetCents:143904,
 paidAt:'2026-10-15T14:10:00.000Z'};
const settle=(r:unknown=order,p:unknown=proof)=>annualSettlementCommand(r,p,now);

describe('FIO V5 - validacao do pagamento anual sem cobrar',()=>{
 it('converte somente consulta autenticada e consistente em parametros de RPC',()=>{
  expect(settle()).toEqual({p_order_id:order.id,p_external_id:order.external_id,
   p_provider_order_id:'sp-order-abc',p_provider_transaction_id:'sp-transaction-abc',
   p_merchant_net_cents:143904,p_paid_at:proof.paidAt});
 });
 it('aceita estado review por reconciliacao posterior',()=>{
  expect(settle({...order,state:'review'}).p_order_id).toBe(order.id);
 });
 it('nao permite ativar pedido ainda sem checkout',()=>{
  for(const state of ['preparing','failed','paid','cancelled','refunded'])
   expect(()=>settle({...order,state})).toThrow();
 });
 it('rejeita browser, retorno ou webhook sem lookup',()=>{
  for(const source of ['browser_redirect','unverified_webhook','return_url'])
   expect(()=>settle(order,{...proof,source})).toThrow();
 });
 it('rejeita pagamento nao aprovado',()=>{
  for(const status of ['pending','authorized','failed','refunded'])
   expect(()=>settle(order,{...proof,status})).toThrow();
 });
 it('rejeita outro pedido ou outra transacao sem identificador',()=>{
  expect(()=>settle(order,{...proof,externalId:'fio-annual-wrong'})).toThrow();
  expect(()=>settle(order,{...proof,providerOrderId:'other'})).toThrow();
  expect(()=>settle(order,{...proof,providerTransactionId:''})).toThrow();
 });
 it('rejeita valor ou moeda incorretos (nao inventa juros)',()=>{
  expect(()=>settle(order,{...proof,merchantNetCents:143903})).toThrow();
  expect(()=>settle(order,{...proof,merchantNetCents:144000})).toThrow();
  expect(()=>settle(order,{...proof,currency:'USD'})).toThrow();
 });
 it('rejeita datas fora da janela do pedido',()=>{
  expect(()=>settle(order,{...proof,paidAt:'2026-10-15T13:00:00.000Z'})).toThrow();
  expect(()=>settle(order,{...proof,paidAt:'2026-10-15T15:00:00.000Z'})).toThrow();
 });
 it('rejeita payload extra e data invalida',()=>{
  expect(()=>settle(order,{...proof,verifiedByCustomer:true})).toThrow();
  expect(()=>settle(order,{...proof,paidAt:'yesterday'})).toThrow();
 });
 it('migracao so permite executar RPC como service_role',()=>{
  const sql=readFileSync('supabase/migrations/20261015_fio_annual_settlement_v5.sql','utf8');
  expect(sql).toContain('security definer');
  expect(sql).toContain("set search_path = ''");
  expect(sql).toMatch(/revoke all on function public\.fio_settle_annual_order_v1\([\s\S]*?from anon,authenticated;/);
  expect(sql).toMatch(/grant execute on function public\.fio_settle_annual_order_v1\([\s\S]*?to service_role;/);
 });
 it('transacao idempotente, sem renovacao ou pagto por redirect',()=>{
  const sql=readFileSync('supabase/migrations/20261015_fio_annual_settlement_v5.sql','utf8');
  for(const fragment of ["v_order.state='paid'",'alreadySettled',"state in ('checkout_ready','review')",
   "v_order.provider_order_id is distinct from p_provider_order_id",'p_merchant_net_cents',
   "interval '365 days'",'for update','public.saas_subscriptions'])expect(sql).toContain(fragment);
  expect(sql).not.toContain('return_url');
 });
 it('nao expoe RPC em rota do FIO ou dispara cobrancas',()=>{
  const app=readFileSync('server/app.ts','utf8');
  expect(app).not.toContain('fio_settle_annual_order_v1');
  expect(app).toContain('annualCheckoutUnavailable();');
 });
});
