import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {canStartPaidCheckout} from '../src/lib/plan-presentation';
const text=(p:string)=>readFileSync(p,'utf8');
describe('Pix Automatico FIO - somente mensal com checkout seguro',()=>{
 it('nao oferece Pix Automatico como pagamento anual recorrente',()=>{
  const flags={billingConfigured:true,stripeConfigured:false,pixAutomaticoConfigured:true,syncpayCardConfigured:false,legacyPixCheckoutConfigured:false};
  expect(canStartPaidCheckout(flags,'monthly')).toBe(true);
  expect(canStartPaidCheckout(flags,'annual')).toBe(false);
  expect(text('src/pages/FioPlans.tsx')).toContain("{pixAutomaticoConfigured&&cycle==='monthly'&&<button");
 });
 it('o servidor rejeita Pix Automatico anual e nao confunde com 12x',()=>{
  expect(text('server/syncpay.ts')).toContain("'SYNCPAY_PIX_AUTO_MONTHLY_ONLY'");
 });
 it('rejeita outra cobranca antes de resolver checkout de cartao pendente',()=>{
  const source=text('server/syncpay.ts');
  expect(source).toContain(".from('fio_hosted_checkout_intents')");
  expect(source).toContain(".in('state',['creating','ready'])");
  expect(source).toContain("'SYNCPAY_HOSTED_PENDING'");
 });
});