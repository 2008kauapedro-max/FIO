import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

describe('agenda sem barbeiro ativo',()=>{
 const workspace=readFileSync('src/pages/Workspace.tsx','utf8');
 const styles=readFileSync('src/styles.css','utf8');
 it('avisa sobre a equipe sem ocultar os horários cadastrados',()=>{
  expect(workspace).toContain('Nenhum barbeiro ativo na agenda');
  expect(workspace).toContain('Os serviços e horários cadastrados continuam salvos');
  expect(workspace).toContain("navigate(p.base+'/equipe')");
 });
 it('não apresenta mês como fechado se falta um profissional',()=>{
  expect(workspace).toContain("providers.length>0?<AgendaMonthCalendar");
  expect(workspace).toContain('Não alteramos seus horários de funcionamento');
 });
 it('mantém layout adaptado ao celular',()=>{
  expect(styles).toContain('FIO_V20_AGENDA_STAFF_EMPTY_SAFE_20261019');
  expect(styles).toContain('.fio-agenda-team-empty');
 });
});
