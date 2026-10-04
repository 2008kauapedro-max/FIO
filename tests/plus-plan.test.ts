import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {FIO_PLAN_CATALOG,SALE_BILLING_CYCLES} from '../shared/fio-plans';

describe('catálogo comercial oficial do FIO',()=>{
 it('separa planos solo e equipe',()=>{
  expect(FIO_PLAN_CATALOG.map(plan=>plan.code)).toEqual(['FREE','SOLO','SOLO_PREMIUM','PRO','PREMIUM']);
  expect(SALE_BILLING_CYCLES).toEqual(['monthly','annual']);
 });

 it('usa os preços oficiais e 20% OFF no anual do SOLO PREMIUM',()=>{
  expect(FIO_PLAN_CATALOG.find(x=>x.code==='SOLO')?.prices).toMatchObject({weekly:null,monthly:7990,annual:76704});
  expect(FIO_PLAN_CATALOG.find(x=>x.code==='SOLO_PREMIUM')?.prices).toMatchObject({weekly:null,monthly:19790,annual:189984});
  expect(FIO_PLAN_CATALOG.find(x=>x.code==='PRO')?.prices).toMatchObject({weekly:null,monthly:14990,annual:143904});
  expect(FIO_PLAN_CATALOG.find(x=>x.code==='PREMIUM')?.prices).toMatchObject({weekly:null,monthly:29990,annual:287904});
 });

 it('backend vende SOLO, SOLO PREMIUM, PRO e PREMIUM, mas não PLUS nem semanal',()=>{
  const syncpay=readFileSync(resolve('server/syncpay.ts'),'utf8');
  expect(syncpay).toContain("const PAID_PLANS=['SOLO','SOLO_PREMIUM','PRO','PREMIUM'] as const;");
  expect(syncpay).toContain("const CYCLES=['monthly','annual'] as const;");
 });
});
