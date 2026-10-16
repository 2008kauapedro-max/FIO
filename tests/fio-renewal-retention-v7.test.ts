import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {fioEffectivePlan,graceEndsAt} from '../shared/fio-access-policy';
import {fioVisibleClientPlans} from '../shared/fio-client-plan-visibility';
import {fioAnnualCardEstimate} from '../shared/fio-annual-card-estimate';
const date='2026-10-16T12:00:00Z';
const now=Date.parse(date);
describe('FIO payment/access and preserved client packages',()=>{
 it('cancelamento com período quitado preserva acesso e expira pontualmente',()=>{
  const s={plan:'PREMIUM' as const,status:'cancelled',expires_at:'2026-10-12T00:00:00Z',retained_paid_until:'2026-11-10T00:00:00Z',verified_paid_until:'2026-11-10T00:00:00Z'};
  expect(fioEffectivePlan(s,now)).toBe('PREMIUM');
  expect(fioEffectivePlan(s,Date.parse('2026-11-10T00:00:00Z'))).toBe('FREE');
 });
 it('cancelamento sem confirmação de periodo pago nunca libera Premium',()=>{
  expect(fioEffectivePlan({plan:'PREMIUM',status:'cancelled',expires_at:'2026-11-10T00:00:00Z'},now)).toBe('FREE');
 });
 it('rejeicao na primeira compra jamais gera acesso',()=>{
  expect(fioEffectivePlan({plan:'PREMIUM',status:'pending_first_payment',expires_at:null},now)).toBe('FREE');
 });
 it('falha na renovacao da dois dias de tolerancia e depois Free',()=>{
  const s={plan:'PRO' as const,status:'past_due',starts_at:'2026-09-15T00:00:00Z',expires_at:'2026-10-15T00:00:00Z',verified_paid_until:'2026-10-15T00:00:00Z'};
  expect(fioEffectivePlan(s,now)).toBe('PRO');
  expect(graceEndsAt(s)).toBe('2026-10-17T00:00:00.000Z');
  expect(fioEffectivePlan(s,Date.parse('2026-10-17T00:00:00Z'))).toBe('FREE');
 });
 it('primeira cobrança em aberto não recebe tolerância',()=>{
  expect(fioEffectivePlan({plan:'PRO',status:'past_due',expires_at:'2026-10-15T00:00:00Z'},now)).toBe('FREE');
 });
 it('Free oculta todos os pacotes sem apagar nenhum',()=>{
  const ten=Array.from({length:10},(_,i)=>({id:i,active:true}));
  expect(fioVisibleClientPlans(ten,'FREE')).toHaveLength(0);
  expect(ten).toHaveLength(10);
  expect(fioVisibleClientPlans(ten,'PRO')).toHaveLength(5);
  expect(fioVisibleClientPlans(ten,'PREMIUM')).toHaveLength(10);
 });
 it('respeita pacotes desativados pelo proprio dono',()=>{
  const data=[{id:'a',active:true},{id:'b',active:false},{id:'c',active:true}];
  expect(fioVisibleClientPlans(data,'PRO').map(x=>x.id)).toEqual(['a','c']);
 });
 it('simulacao do Premium em 12x não é cotacao nem autoriza cobranca',()=>{
  const e=fioAnnualCardEstimate(287904,12);
  expect(e.totalCents).toBe(337971);
  expect(e.interestCents).toBe(50067);
  expect(e.parts.reduce((a,b)=>a+b,0)).toBe(e.totalCents);
  expect(e.providerQuoteConfirmed).toBe(false);
  expect(e.canCharge).toBe(false);
 });
 it('anual a vista nao cobra juros de parcelamento',()=>{
  const e=fioAnnualCardEstimate(287904,1);
  expect(e.totalCents).toBe(287904);
  expect(e.interestCents).toBe(0);
 });
 it('SQL de retencao de cancelamento nao exclui registros',()=>{
  const sql=readFileSync('supabase/migrations/20261016160638_fio_paid_cancel_grace_v7.sql','utf8');
  expect(sql).toContain("s.status='cancelled' and s.retained_paid_until>now()");
  expect(sql).toContain("interval '2 days'");
  expect(sql).toContain('grant execute on function public.fio_prepare_paid_cancellation_v1');
  expect(sql).not.toMatch(/\bdelete\s+from\s+public\.(customers|subscription_plans|appointments)/i);
 });
 it('FIO protege a exposicao publica e a venda de pacotes excedentes',()=>{
  const app=readFileSync('server/app.ts','utf8');
  expect(app).toContain('fioVisibleClientPlans(publicPlans.data??[],effectivePublicPlan,priorityIds)');
  expect(app).toContain("throw new ApiError(403,'PLAN_LIMIT'");
 });
});
