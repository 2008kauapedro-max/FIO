import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { planBadgeLabel,premiumInitialPlan,canStartPaidCheckout } from '../src/lib/plan-presentation';
describe('FIO: teste grátis, premium e bloqueio seguro',()=>{
 it('mostra somente teste grátis no prazo e plano após pagamento',()=>{
  const trial={status:'trialing',trial_ends_at:'2026-10-24T12:00:00Z'};
  expect(planBadgeLabel('SOLO',trial,Date.parse('2026-10-10T12:00:00Z'))).toBe('Teste grátis');
  expect(planBadgeLabel('SOLO_PREMIUM',trial,Date.parse('2026-10-10T12:00:00Z'))).toBe('Teste grátis');
  expect(planBadgeLabel('SOLO',trial,Date.parse('2026-10-25T12:00:00Z'))).toBe('Teste encerrado');
  expect(planBadgeLabel('SOLO',{status:'active'})).toBe('FIO PRO');
  expect(planBadgeLabel('SOLO_PREMIUM',{status:'active'})).toBe('FIO PREMIUM');
 });
 it('abre em premium anual no SOLO e equipe',()=>{
  expect(premiumInitialPlan(true)).toBe('SOLO_PREMIUM');
  expect(premiumInitialPlan(false)).toBe('PREMIUM');
  const code=readFileSync(new URL('../src/pages/FioPlans.tsx',import.meta.url),'utf8');
  expect(code).toContain('useState<Plan>(premiumInitialPlan(soloMode))');
  expect(code).toContain("useState<BillingCycle>('annual')");
 });
 it('não habilita pagamento sem método confirmado',()=>{
  const flags={billingConfigured:true,stripeConfigured:false,pixAutomaticoConfigured:false,syncpayCardConfigured:false,legacyPixCheckoutConfigured:false};
  expect(canStartPaidCheckout(flags,'annual')).toBe(false);
  expect(canStartPaidCheckout(flags,'monthly')).toBe(false);
  expect(canStartPaidCheckout({...flags,syncpayCardConfigured:true},'monthly')).toBe(true);
  expect(canStartPaidCheckout({...flags,syncpayCardConfigured:true},'annual')).toBe(false);
  expect(canStartPaidCheckout({...flags,pixAutomaticoConfigured:true},'annual')).toBe(true);
 });
});
