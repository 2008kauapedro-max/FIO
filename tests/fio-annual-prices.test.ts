import {describe,expect,it} from 'vitest';
import {FIO_PLAN_CATALOG} from '../shared/fio-plans.js';

describe('precos anuais FIO: 20% de desconto exato',()=>{
 it('todos os planos pagos custam 80% de doze mensalidades',()=>{
  for(const plan of FIO_PLAN_CATALOG.filter(item=>item.code!=='FREE')){
   const monthly=plan.prices.monthly;
   const annual=plan.prices.annual;
   expect(monthly,plan.code).not.toBeNull();
   expect(annual,plan.code).toBe(Math.round(monthly!*12*80/100));
  }
 });
 it('Premium anual custa R$ 2.879,04',()=>{
  expect(FIO_PLAN_CATALOG.find(p=>p.code==='PREMIUM')?.prices.annual).toBe(287904);
 });
});