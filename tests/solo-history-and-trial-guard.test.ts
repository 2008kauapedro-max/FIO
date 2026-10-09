import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { historyToCsv } from '../src/lib/appointment-history';
const source=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8');
describe('SOLO: agenda, checkout e identidade',()=>{
 it('exporta CSV com texto malicioso neutralizado sem alterar nome',()=>{
  const row={id:'abc',client_id:'x',barber_id:'y',service_id:'s',starts_at:'2026-10-08T12:00:00Z',ends_at:'2026-10-08T12:30:00Z',status:'completed' as const,price_cents:3000,subscription_id:null,customer_name:'=HYPERLINK("evil")',service_name:'Corte'};
  const csv=historyToCsv([row],'America/Sao_Paulo');
  expect(csv).toContain('"\'=HYPERLINK(""evil"")"');
  expect(csv).toContain('"Finalizado"');
  expect(csv).toContain('"30,00"');
 });
 it('busca histórico por mês com escopo de profissional no servidor',()=>{
  const api=source('../server/app.ts');
  expect(api).toContain("app.get('/api/appointments/history'");
  expect(api).toContain("c.member.role==='BARBER'");
  expect(api).toContain(".eq('barbershop_id',c.shopId)");
 });
 it('preserva 3 abas e oferece histórico e PDF',()=>{
  const ui=source('../src/pages/Workspace.tsx');
  expect(ui).toContain("'today'|'done'|'calendar'");
  expect(ui).toContain('fio-history-print-area');
  expect(ui).toContain('historyMonth');
  expect(source('../src/i18n/dictionaries.ts')).toContain('"agendaSimple.done":"Finalizados"');
 });
 it('não anuncia trial com renovação automática sem mandato',()=>{
  const api=source('../server/app.ts');
  expect(api).toContain('TRIAL_PAYMENT_AUTH_REQUIRED');
  const ui=source('../src/pages/FioPlans.tsx');
  expect(ui).toContain('requer autorização prévia de cartão ou Pix Automático');
 });
});
