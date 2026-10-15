import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {TenantContext} from '../server/context.js';
import {annualDraftStorageEnabled,prepareAnnualOrder} from '../server/fio-annual-store.js';
import {readFileSync} from 'node:fs';

const shopId='6ca58a7d-4e0c-4bb7-a3c1-600000000002';
const userId='90fefaba-8da5-4faf-aadd-500000000123';
function ctx(mode:'SHOP'|'SOLO'='SHOP',role='OWNER'){
 const chain:any={};
 for(const method of ['select','eq','in','limit','order'])chain[method]=()=>chain;
 chain.single=async()=>({data:{operation_mode:mode},error:null});
 const from=vi.fn(()=>chain);
 return {data:{shopId,userId,member:{role},db:{from}} as unknown as TenantContext,from};
}
function store(options:{baseStatus?:string;provider?:boolean;hosted?:boolean;insertConflict?:boolean}={}){
 let order:any=null;
 const inserts:any[]=[];
 const from=vi.fn((name:string)=>{
  const chain:any={};
  for(const method of ['select','eq','in','order','limit'])chain[method]=()=>chain;
  chain.maybeSingle=async()=>({data:
   name==='saas_subscriptions'?(options.baseStatus?{status:options.baseStatus,expires_at:null}:null):
   name==='saas_provider_subscriptions'?(options.provider?{id:'subscription'}:null):
   name==='fio_hosted_checkout_intents'?(options.hosted?{id:'hosted'}:null):
   name==='fio_annual_orders'?order:null,error:null});
  chain.insert=(row:any)=>{inserts.push(row);chain.single=async()=>{
   if(options.insertConflict)return {data:null,error:{code:'23505',message:'unique'}};
   order={...row,created_at:new Date().toISOString()};return {data:order,error:null};
  };return chain;};
  return chain;
 });
 return {db:{from} as unknown as SupabaseClient,from,inserts,getOrder:()=>order};
}
beforeEach(()=>vi.stubEnv('FIO_ENABLE_ANNUAL_ORDER_DRAFTS','true'));
afterEach(()=>vi.unstubAllEnvs());

describe('pedido anual local - zero cobrancas externas',()=>{
 it('permanece fechado por padrao',()=>{
  delete process.env.FIO_ENABLE_ANNUAL_ORDER_DRAFTS;
  expect(annualDraftStorageEnabled()).toBe(false);
 });
 it('nao consulta banco nem inicia pedido quando desabilitado',async()=>{
  vi.stubEnv('FIO_ENABLE_ANNUAL_ORDER_DRAFTS','false');const c=ctx();const d=store();
  await expect(prepareAnnualOrder(c.data,{plan:'PRO'},d.db)).rejects.toMatchObject({code:'ANNUAL_DRAFTS_DISABLED',status:503});
  expect(c.from).not.toHaveBeenCalled();expect(d.from).not.toHaveBeenCalled();
 });
 it('bloqueia BARBER antes de consultar banco',async()=>{
  const c=ctx('SHOP','BARBER');const d=store();
  await expect(prepareAnnualOrder(c.data,{plan:'PRO'},d.db)).rejects.toMatchObject({code:'FORBIDDEN',status:403});
  expect(c.from).not.toHaveBeenCalled();
 });
 it('salva somente pedido local sem link, token ou estado pago',async()=>{
  const c=ctx();const d=store();
  const order=await prepareAnnualOrder(c.data,{plan:'PRO'},d.db);
  expect(order).toMatchObject({plan:'PRO',baseAmountCents:143904,state:'preparing',checkoutEnabled:false,automaticRenewal:false});
  expect(d.inserts).toHaveLength(1);
  expect(d.inserts[0]).toMatchObject({actor_user_id:userId,barbershop_id:shopId,state:'preparing',base_amount_cents:143904,installment_fees_payer:'customer'});
  expect(d.inserts[0].external_id).toContain(d.inserts[0].id);
  expect(d.inserts[0]).not.toHaveProperty('provider_order_id');
  expect(order).not.toHaveProperty('externalId');expect(order).not.toHaveProperty('checkoutUrl');
 });
 it('reutiliza pedido pendente, sem criar outro',async()=>{
  const c=ctx();const d=store();
  const a=await prepareAnnualOrder(c.data,{plan:'PRO'},d.db);
  const b=await prepareAnnualOrder(c.data,{plan:'PRO'},d.db);
  expect(b.id).toBe(a.id);expect(d.inserts).toHaveLength(1);
 });
 it('recusa outra oferta com pedido ja pendente',async()=>{
  const c=ctx();const d=store();
  await prepareAnnualOrder(c.data,{plan:'PRO'},d.db);
  await expect(prepareAnnualOrder(c.data,{plan:'PREMIUM'},d.db)).rejects.toMatchObject({code:'ANNUAL_ORDER_PENDING',status:409});
  expect(d.inserts).toHaveLength(1);
 });
 it.each([{baseStatus:'active'},{baseStatus:'trialing'},{provider:true},{hosted:true}])('bloqueia contrato ativo ou pendente %j',async(options)=>{
  const c=ctx();const d=store(options);
  await expect(prepareAnnualOrder(c.data,{plan:'PRO'},d.db)).rejects.toMatchObject({code:'ANNUAL_CONTRACT_CONFLICT',status:409});
  expect(d.inserts).toHaveLength(0);
 });
 it('recusa plano SOLO numa barbearia de equipe',async()=>{
  const c=ctx();const d=store();
  await expect(prepareAnnualOrder(c.data,{plan:'SOLO'},d.db)).rejects.toMatchObject({code:'INVALID_PLAN'});
  expect(d.from).not.toHaveBeenCalled();
 });
 it('recusa dado extra do cliente, preservando preco do catalogo',async()=>{
  const c=ctx();const d=store();
  await expect(prepareAnnualOrder(c.data,{plan:'PRO',amountCents:1},d.db)).rejects.toBeTruthy();
  expect(c.from).not.toHaveBeenCalled();
 });
 it('rejeita conflito de escrita concorrente sem repetir a insercao',async()=>{
  const c=ctx();const d=store({insertConflict:true});
  await expect(prepareAnnualOrder(c.data,{plan:'PRO'},d.db)).rejects.toMatchObject({code:'ANNUAL_ORDER_PENDING',status:409});
  expect(d.inserts).toHaveLength(1);
 });
 it('rota exige owner e nao habilita o checkout financeiro',()=>{
  const s=readFileSync('server/app.ts','utf8');
  expect(s).toContain("app.post('/api/saas/annual/prepare',rateLimitByUser('annual-prepare'");
  expect(s).toContain('requireOwner(c);res.status(201).json(await prepareAnnualOrder(c,req.body));');
  expect(s).toContain('annualCheckoutUnavailable();');
 });
});
