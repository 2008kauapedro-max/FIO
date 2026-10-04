import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
 FIO_PLAN_CATALOG,
 SALE_BILLING_CYCLES
} from '../shared/fio-plans';

describe('catálogo comercial oficial do FIO',()=>{
 it('vende FREE, SOLO, PRO e PREMIUM',()=>{
  expect(
   FIO_PLAN_CATALOG.map(plan=>plan.code)
  ).toEqual(['FREE','SOLO','PRO','PREMIUM']);

  expect(SALE_BILLING_CYCLES)
   .toEqual(['monthly','annual']);
 });

 it('usa preços oficiais',()=>{
  expect(
   FIO_PLAN_CATALOG.find(x=>x.code==='PRO')?.prices
  ).toMatchObject({
   weekly:null,
   monthly:14990,
   annual:143904
  });

  expect(
   FIO_PLAN_CATALOG.find(x=>x.code==='PREMIUM')?.prices
  ).toMatchObject({
   weekly:null,
   monthly:29990,
   annual:287904
  });
 });

 it('backend vende SOLO, PRO e PREMIUM, mas não PLUS nem semanal',()=>{
  const syncpay=
   readFileSync(resolve('server/syncpay.ts'),'utf8');

  expect(syncpay).toContain(
   "const PAID_PLANS=['SOLO','PRO','PREMIUM'] as const;"
  );

  expect(syncpay).toContain(
   "const CYCLES=['monthly','annual'] as const;"
  );
 });
});
