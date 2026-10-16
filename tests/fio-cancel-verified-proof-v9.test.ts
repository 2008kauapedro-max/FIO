import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {fioEffectivePlan} from '../shared/fio-access-policy';
const now=Date.parse('2026-10-16T12:00:00Z');
const paidUntil='2026-11-16T12:00:00Z';
const cancelled={plan:'PRO' as const,status:'cancelled',expires_at:'2026-10-16T12:00:00Z',retained_paid_until:paidUntil};
describe('FIO V9: cancelamento exige prova de pagamento',()=>{
 it('não concede periodo quitado apenas por haver retencao preenchida',()=>{
  expect(fioEffectivePlan(cancelled,now)).toBe('FREE');
 });
 it('recusa comprovante antigo ou diferente do periodo retido',()=>{
  expect(fioEffectivePlan({...cancelled,verified_paid_until:'2026-10-16T12:00:00Z'},now)).toBe('FREE');
 });
 it('mantem acesso apenas com comprovante do periodo, até a data final',()=>{
  const verified={...cancelled,verified_paid_until:paidUntil};
  expect(fioEffectivePlan(verified,now)).toBe('PRO');
  expect(fioEffectivePlan(verified,Date.parse(paidUntil))).toBe('FREE');
 });
 it('SQL exige prova, permite cancelar sem prova e protege EXECUTE',()=>{
  const sql=readFileSync('supabase/migrations/20261016161919_fio_cancel_verified_proof_v9.sql','utf8');
  expect(sql).toContain('s.verified_paid_until=s.expires_at');
  expect(sql).toContain('s.verified_paid_until=d');
  expect(sql).toContain('s.verified_paid_until=s.retained_paid_until');
  expect(sql).toContain('if d is null then return null; end if;');
  expect(sql).toContain('return result_date;');
  expect(sql).toContain('revoke all on function public.fio_prepare_paid_cancellation_v1');
  expect(sql).not.toMatch(/^\s*(delete\s+from|truncate\s+|drop\s+table|create\s+table)/im);
 });
});
