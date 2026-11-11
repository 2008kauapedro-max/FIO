import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const app=readFileSync('server/app.ts','utf8');
const plans=readFileSync('src/pages/FioPlans.tsx','utf8');

describe('venda anual escondida por padrao',()=>{
 it('servidor so libera a aba anual com FIO_SHOW_ANNUAL_PLANS=true',()=>{
  expect(app.match(/annualSalesVisible:process\.env\.FIO_SHOW_ANNUAL_PLANS==='true'/g)?.length).toBe(3);
 });
 it('tela de planos comeca no mensal e so mostra o seletor quando liberado',()=>{
  expect(plans).toContain("useState<BillingCycle>('monthly')");
  expect(plans).toContain('const [annualSalesVisible,setAnnualSalesVisible]=useState(false);');
  expect(plans).toContain('{annualSalesVisible&&<div className="fio-payflow-cycle"');
 });
});
