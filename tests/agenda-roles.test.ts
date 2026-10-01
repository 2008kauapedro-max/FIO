import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('agenda separada por papel',()=>{
 const workspace=readFileSync(resolve('src/pages/Workspace.tsx'),'utf8');
 const booking=readFileSync(resolve('src/components/BookingFlow.tsx'),'utf8');
 const client=workspace.slice(workspace.indexOf('function ClientAgenda'),workspace.indexOf('function StaffAgenda'));
 const staff=workspace.slice(workspace.indexOf('function StaffAgenda'),workspace.indexOf('export function Agenda'));

 it('cliente recebe uma agenda simples focada nos próprios horários',()=>{
  expect(client).toContain('Seus agendamentos');
  expect(workspace).toContain('AGENDAMENTO FEITO');
  expect(client).toContain('ClientAppointmentRow');
  expect(client).toContain('Agendar horário');
  expect(client).not.toContain('AppointmentPeriod');
  expect(client).not.toContain('agenda-controls');
  expect(client).not.toContain('Registrar falta');
  expect(client).not.toContain('Iniciar');
  expect(client).not.toContain('Concluir');
 });

 it('dono e funcionário continuam com a agenda operacional',()=>{
  expect(staff).toContain('AppointmentPeriod');
  expect(staff).toContain('Agenda da barbearia');
  expect(staff).toContain('Aqui aparecem somente os atendimentos atribuídos a você.');
  expect(staff).toContain('Filtrar profissional');
  expect(staff).toContain('Registrar falta');
 });

 it('fluxo de agendamento evita etapa de profissional quando só existe um possível',()=>{
  expect(booking).toContain('lockedProvider');
  expect(booking).toContain("barbers.length===1");
  expect(booking).toContain("isClient?'Agendar horário':'Novo atendimento'");
 });
});

describe('horários de agendamento',()=>{
 it('a migration nova oferece inícios em passos de uma hora',()=>{
  const sql=readFileSync(resolve('supabase/migrations/20261001025300_role_aware_hourly_agenda.sql'),'utf8');
  expect(sql).toContain("interval '1 hour'");
  expect(sql).not.toContain("interval '15 minutes'");
 });
});
