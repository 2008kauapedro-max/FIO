import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

describe('experiência diária da equipe',()=>{

 const workspace=
  readFileSync(
   'src/pages/Workspace.tsx',
   'utf8'
  );

 const period=
  readFileSync(
   'src/components/AppointmentPeriod.tsx',
   'utf8'
  );

 const css=
  readFileSync(
   'src/styles.css',
   'utf8'
  );

 it('mostra próximo atendimento na visão geral',()=>{
  expect(workspace)
   .toContain('PRÓXIMO ATENDIMENTO');

  expect(workspace)
   .toContain('next-appointment-card');
 });

 it('usa primeiro nome e perfil do cliente',()=>{
  expect(workspace)
   .toContain('firstName(customer?.name)');

  expect(workspace)
   .toContain('Perfil do cliente');

  expect(workspace)
   .toContain('Chamar no WhatsApp');
 });

 it('remove etapa manual de iniciar',()=>{
  expect(workspace)
   .not.toContain('Iniciar atendimento');

  expect(workspace)
   .toContain('Finalizar atendimento');
 });

 it('histórico possui avatar e cards próprios',()=>{
  expect(period)
   .toContain('period-client-avatar');

  expect(period)
   .toContain('Ver histórico do mês');
 });

 it('remove textura e corrige fundos',()=>{
  expect(css)
   .toContain('.sidebar:after');

  expect(css)
   .toContain('display:none!important');

  expect(css)
   .toContain('#root:has(.workspace)');
 });

});
