import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {TenantContext} from '../server/context.js';
import {annualStatusView,getAnnualOrderStatus,type AnnualStatusRow} from '../server/fio-annual-status.js';
import {readFileSync} from 'node:fs';

const shopId='6ca58a7d-4e0c-4bb7-a3c1-600000000002';
const row:AnnualStatusRow={
 id:'26b14c7d-4e0c-4bb7-a3c1-500000000001',barbershop_id:shopId,
 plan_code:'PRO',billing_cycle:'annual',currency:'BRL',base_amount_cents:143904,
 state:'preparing',created_at:'2026-10-15T12:00:00Z',provider_order_id:null,
 verified_at:null,paid_at:null,access_starts_at:null,access_ends_at:null,
 checkout_url:'https://example.test/secret',external_id:'hidden-value'
};
const ctx=(role='OWNER')=>({shopId,member:{role}} as unknown as TenantContext);
const db=(data:AnnualStatusRow|null=row,error:null|{code:string;message:string}=null)=>{
 const chain:any={};
 for(const method of ['select','eq','order','limit'])chain[method]=vi.fn(()=>chain);
 chain.maybeSingle=vi.fn(async()=>({data,error}));
 const from=vi.fn(()=>chain);
 return {client:{from} as unknown as SupabaseClient,from,chain};
};

beforeEach(()=>vi.stubEnv('FIO_ENABLE_ANNUAL_ORDER_DRAFTS','true'));
afterEach(()=>vi.unstubAllEnvs());

describe('FIO anual - consulta de pedido sem cobranca',()=>{
 it('fica desativada por padrao e nao le banco',async()=>{
  vi.stubEnv('FIO_ENABLE_ANNUAL_ORDER_DRAFTS','false');
  const m=db();const r=await getAnnualOrderStatus(ctx(),m.client);
  expect(r).toMatchObject({state:'disabled',checkoutEnabled:false,paymentVerificationRecorded:false});
  expect(m.from).not.toHaveBeenCalled();
 });
 it('recusa BARBER antes de ler banco',async()=>{
  const m=db();await expect(getAnnualOrderStatus(ctx('BARBER'),m.client)).rejects.toMatchObject({status:403,code:'FORBIDDEN'});
  expect(m.from).not.toHaveBeenCalled();
 });
 it('filtra pelo shop autenticado e consulta no maximo um pedido',async()=>{
  const m=db();await getAnnualOrderStatus(ctx(),m.client);
  expect(m.from).toHaveBeenCalledWith('fio_annual_orders');
  expect(m.chain.eq).toHaveBeenCalledWith('barbershop_id',shopId);
  expect(m.chain.limit).toHaveBeenCalledWith(1);
 });
 it('sem pedido nao inventa pagamento',async()=>{
  const r=await getAnnualOrderStatus(ctx(),db(null).client);
  expect(r).toMatchObject({state:'none',paymentVerificationRecorded:false,checkoutEnabled:false});
 });
 it('pedido preparando nunca prova pagamento',()=>{
  expect(annualStatusView(row,shopId)).toMatchObject({state:'preparing',baseAmountCents:143904,paymentVerificationRecorded:false});
 });
 it('pedido com checkout pronto continua sem comprovacao de pagamento',()=>{
  expect(annualStatusView({...row,state:'checkout_ready'},shopId)).toMatchObject({state:'checkout_ready',checkoutEnabled:false,paymentVerificationRecorded:false});
 });
 it('nao revela link, external_id nem identificador do provedor',()=>{
  const r=annualStatusView({...row,state:'checkout_ready',provider_order_id:'provider-hidden'},shopId);
  expect(JSON.stringify(r)).not.toContain('example.test');
  expect(JSON.stringify(r)).not.toContain('hidden-value');
  expect(JSON.stringify(r)).not.toContain('provider-hidden');
 });
 it('pagamento pago sem verificacao completa fica em revisao',()=>{
  const r=annualStatusView({...row,state:'paid',provider_order_id:'provider-1'},shopId);
  expect(r).toMatchObject({state:'review',paymentVerificationRecorded:false,accessEndsAt:null});
 });
 it('status pago com registro completo e apenas informativo',()=>{
  const paid={...row,state:'paid',provider_order_id:'provider-1',
   verified_at:'2026-10-15T12:10:00Z',paid_at:'2026-10-15T12:09:00Z',
   access_starts_at:'2026-10-15T12:09:00Z',access_ends_at:'2027-10-15T12:09:00Z'};
  const r=annualStatusView(paid,shopId);
  expect(r).toMatchObject({state:'paid',paymentVerificationRecorded:true,checkoutEnabled:false,automaticRenewal:false});
  expect(r).toHaveProperty('accessEndsAt',paid.access_ends_at);
 });
 it('acesso com datas invertidas nao e comprovacao completa',()=>{
  const r=annualStatusView({...row,state:'paid',provider_order_id:'a',verified_at:'2026-10-15T12:10:00Z',
   paid_at:'2026-10-15T12:09:00Z',access_starts_at:'2027-10-15T12:09:00Z',access_ends_at:'2026-10-15T12:09:00Z'},shopId);
  expect(r).toMatchObject({state:'review',paymentVerificationRecorded:false});
 });
 it('cancelado ou reembolsado nao significa acesso pago ativo',()=>{
  for(const state of ['cancelled','refunded','failed'])
   expect(annualStatusView({...row,state},shopId)).toMatchObject({state,paymentVerificationRecorded:false});
 });
 it('dado quebrado fica em revisao, sem liberar nada',()=>{
  const r=annualStatusView({...row,plan_code:'FREE',currency:'USD'},shopId);
  expect(r).toMatchObject({state:'review',paymentVerificationRecorded:false});
 });
 it('nao revela pedido de outra barbearia mesmo se consulta retornar errado',()=>{
  expect(()=>annualStatusView({...row,barbershop_id:'other-shop'},shopId)).toThrow();
 });
 it('erro de banco nao vira pagamento confirmado',async()=>{
  const m=db(null,{code:'network',message:'unknown'});
  await expect(getAnnualOrderStatus(ctx(),m.client)).rejects.toMatchObject({status:503});
 });
 it('rota autenticada existe sem mudar checkout anual bloqueado',()=>{
  const src=readFileSync('server/app.ts','utf8');
  expect(src).toContain("app.get('/api/saas/annual/status',rateLimitByUser('annual-status'");
  expect(src).toContain('requireOwner(c);res.json(await getAnnualOrderStatus(c));');
  expect(src).toContain('annualCheckoutUnavailable();');
 });
});
