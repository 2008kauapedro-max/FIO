import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('agenda premium',()=>{

 const booking=
  readFileSync(
   resolve('src/components/BookingFlow.tsx'),
   'utf8'
  );

 const calendar=
  readFileSync(
   resolve('src/components/BookingCalendar.tsx'),
   'utf8'
  );

 const workspace=
  readFileSync(
   resolve('src/pages/Workspace.tsx'),
   'utf8'
  );

 const sql=
  readFileSync(
   resolve(
    'supabase/migrations/20261001193000_agenda_calendar_availability.sql'
   ),
   'utf8'
  );

 it('cliente pode escolher profissional',()=>{

  expect(booking)
   .toContain("const lockedProvider=role==='BARBER'");

  expect(booking)
   .toContain('Escolha o profissional');

 });

 it('usa calendário mensal',()=>{

  expect(calendar)
   .toContain('DATA DO AGENDAMENTO');

  expect(calendar)
   .toContain('Manhã');

  expect(calendar)
   .toContain('Tarde');

  expect(calendar)
   .toContain('Noite');

  expect(calendar)
   .toContain('/slots/month?');

 });

 it('cliente vê alterações e status',()=>{

  expect(workspace)
   .toContain('Agendado');

  expect(workspace)
   .toContain('Alterações recentes');

  expect(workspace)
   .toContain('Agendar outro horário');

 });

 it('equipe separa cancelados e confirma atendimento',()=>{

  expect(workspace)
   .toContain('Histórico do dia');

  expect(workspace)
   .not.toContain('Confirmar horário');

  expect(workspace)
   .not.not.toContain('Iniciar atendimento');

  expect(workspace)
   .toContain('Finalizar atendimento');

 });

 it('novos horários começam em hora cheia',()=>{

  expect(sql)
   .toContain("interval '1 hour'");

  expect(sql)
   .toContain('FULL_HOUR_REQUIRED');

  expect(sql)
   .toContain('available_days');

 });

});