import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {fioEffectivePlan} from '../shared/fio-access-policy';
import {fioVisibleClientPlans} from '../shared/fio-client-plan-visibility';
const now=Date.parse('2026-10-16T12:00:00.000Z');
const due='2026-10-16T11:00:00.000Z';
const raw={plan:'PRO' as const,status:'past_due',starts_at:'2026-09-16T11:00:00.000Z',expires_at:due};
describe('FIO V8: pagamento demonstrado, cancelamento e pacotes',()=>{
 it('nega 48h a uma assinatura em atraso sem prova de pagamento',()=>{
  expect(fioEffectivePlan(raw,now)).toBe('FREE');
 });
 it('aceita janela de 48h somente quando o periodo pago foi provado',()=>{
  const paid={...raw,verified_paid_until:due};
  expect(fioEffectivePlan(paid,now)).toBe('PRO');
  expect(fioEffectivePlan(paid,Date.parse(due)+2*86400000)).toBe('FREE');
 });
 it('um comprovante antigo nao estende periodo novo',()=>{
  expect(fioEffectivePlan({...raw,verified_paid_until:'2026-09-16T11:00:00.000Z'},now)).toBe('FREE');
 });
 it('cancelamento retido termina no limite',()=>{
  const state={plan:'PRO' as const,status:'cancelled',expires_at:due,retained_paid_until:'2026-11-16T11:00:00.000Z',verified_paid_until:'2026-11-16T11:00:00.000Z'};
  expect(fioEffectivePlan(state,now)).toBe('PRO');
  expect(fioEffectivePlan(state,Date.parse(state.retained_paid_until))).toBe('FREE');
 });
 it('escolha do dono decide quais pacotes aparecem no Pro',()=>{
  const plans=Array.from({length:10},(_,i)=>({id:String(i),active:true}));
  expect(fioVisibleClientPlans(plans,'PRO',['8','7','6','5','4']).map(p=>p.id)).toEqual(['8','7','6','5','4']);
  expect(fioVisibleClientPlans(plans,'PREMIUM',['8','7','6','5','4'])).toHaveLength(10);
 });
 it('upgrade recupera os pacotes sem exclusao',()=>{
  const plans=Array.from({length:10},(_,i)=>({id:String(i),active:true}));
  expect(plans).toHaveLength(10);
  expect(fioVisibleClientPlans(plans,'PRO')).toHaveLength(5);
  expect(fioVisibleClientPlans(plans,'FREE')).toHaveLength(0);
  expect(fioVisibleClientPlans(plans,'PREMIUM')).toHaveLength(10);
 });
 it('migracao tem protecao anon, evidencias e apenas operacoes nao destrutivas',()=>{
  const sql=readFileSync('supabase/migrations/20261016160742_fio_verified_payment_priority_v8.sql','utf8');
  expect(sql).toContain("p.provider_status='cancelled'");
  expect(sql).toContain("p.billing_cycle='monthly'");
  expect(sql).toContain('verified_paid_until=s.expires_at');
  expect(sql).toContain('enable row level security');
  expect(sql).not.toMatch(/^\s*(delete\s+from|truncate\s+|drop\s+table)/im);
 });
});
