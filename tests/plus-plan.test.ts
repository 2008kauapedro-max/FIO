import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {FIO_PLAN_CATALOG} from '../shared/fio-plans';
import {FIO_FEATURES} from '../shared/entitlements';

describe('FIO PLUS ativo',()=>{
 it('expõe PLUS como plano contratável com preço e recursos',()=>{
  const plus=FIO_PLAN_CATALOG.find(plan=>plan.code==='PLUS');
  expect(plus).toBeTruthy();
  expect(plus?.proposal).not.toBe(true);
  expect(plus?.prices.weekly).toBe(4990);
  expect(plus?.prices.monthly).toBe(14990);
  expect(plus?.prices.annual).toBe(159990);
  expect(FIO_FEATURES.PLUS).toEqual({assistant:true,feed:true,communication:true,client_plans:true});
 });
 it('aceita PLUS no backend, página pública e banco',()=>{
  const syncpay=readFileSync(resolve('server/syncpay.ts'),'utf8');
  const app=readFileSync(resolve('server/app.ts'),'utf8');
  const migration=readFileSync(resolve('supabase/migrations/20260929193500_activate_plus_plan.sql'),'utf8');
  expect(syncpay).toContain("const PAID_PLANS=['PRO','PLUS','PREMIUM'] as const;");
  expect(app).toContain("['PRO','PLUS','PREMIUM'].includes");
  expect(migration).toContain("'FREE','PRO','PLUS','PREMIUM'");
  expect(migration).toContain("when 'PLUS' then 3000");
 });
});
