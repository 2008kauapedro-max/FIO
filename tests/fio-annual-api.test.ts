import { describe,it,expect,vi } from 'vitest';
import type { TenantContext } from '../server/context.js';
import { getAnnualOffer,annualCheckoutUnavailable } from '../server/fio-annual-api.js';
import { readFileSync } from 'node:fs';

const shopId='6ca58a7d-4e0c-4bb7-a3c1-600000000002';
function mockCtx(mode:'SOLO'|'SHOP'='SHOP',role='OWNER'){
 const single=vi.fn(async()=>({data:{operation_mode:mode},error:null}));
 const eq=vi.fn(()=>({single}));
 const select=vi.fn(()=>({eq}));
 const from=vi.fn(()=>({select}));
 return {ctx:{shopId,member:{role},db:{from}} as unknown as TenantContext,from,select,eq,single};
}

describe('FIO anual API - fail closed',()=>{
 it('preview de equipe retorna preco oficial, sem identificador de cobranca',async()=>{
  const {ctx,from}=mockCtx();
  const result=await getAnnualOffer(ctx,'PRO');
  expect(result).toMatchObject({plan:'PRO',cycle:'annual',baseAmountCents:143904,maxInstallments:12,installmentFeesPaidBy:'customer',checkoutEnabled:false,automaticRenewal:false,accessDays:365});
  expect(Object.keys(result)).not.toContain('externalId');
  expect(Object.keys(result)).not.toContain('checkoutUrl');
  expect(from).toHaveBeenCalledTimes(1);
  expect(from).toHaveBeenCalledWith('barbershops');
 });
 it('preview premium e solo usam 20% exatos',async()=>{
  expect((await getAnnualOffer(mockCtx().ctx,'PREMIUM')).baseAmountCents).toBe(287904);
  expect((await getAnnualOffer(mockCtx('SOLO').ctx,'SOLO')).baseAmountCents).toBe(76704);
  expect((await getAnnualOffer(mockCtx('SOLO').ctx,'SOLO_PREMIUM')).baseAmountCents).toBe(189984);
 });
 it('bloqueia usuario que nao e OWNER antes de consultar banco',async()=>{
  const {ctx,from}=mockCtx('SHOP','BARBER');
  await expect(getAnnualOffer(ctx,'PRO')).rejects.toMatchObject({status:403,code:'FORBIDDEN'});
  expect(from).not.toHaveBeenCalled();
 });
 it('rejeita plano compativel com outro modo',async()=>{
  await expect(getAnnualOffer(mockCtx('SOLO').ctx,'PRO')).rejects.toMatchObject({status:400,code:'INVALID_PLAN'});
  await expect(getAnnualOffer(mockCtx('SHOP').ctx,'SOLO')).rejects.toMatchObject({status:400,code:'INVALID_PLAN'});
 });
 it('rejeita plano invalido antes de consultar o banco',async()=>{
  const {ctx,from}=mockCtx();
  await expect(getAnnualOffer(ctx,'FREE')).rejects.toBeTruthy();
  expect(from).not.toHaveBeenCalled();
 });
 it('checkout anual permanece recusado mesmo se rota for chamada',()=>{
  expect(()=>annualCheckoutUnavailable()).toThrow();
  try{annualCheckoutUnavailable();}catch(e){expect(e).toMatchObject({status:503,code:'ANNUAL_CHECKOUT_DISABLED'});}
 });
 it('rotas autenticadas e limitadas no app, sem provedor ou migracao',()=>{
  const source=readFileSync('server/app.ts','utf8');
  expect(source).toContain("app.get('/api/saas/annual/offer',rateLimitByUser('annual-offer'");
  expect(source).toContain("app.post('/api/saas/annual/checkout',rateLimitByUser('annual-checkout-disabled'");
  expect(source).toContain('requireOwner(c);res.json(await getAnnualOffer(c,req.query.plan));');
  expect(source).toContain('requireOwner(c);annualCheckoutUnavailable();');
 });
});