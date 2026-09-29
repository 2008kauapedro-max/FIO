import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('visão geral do FIO',()=>{
 it('troca o painel de agenda por uma home de destaques para equipe',()=>{
  const workspace=readFileSync(resolve('src/pages/Workspace.tsx'),'utf8');
  expect(workspace).toContain('function StaffHome');
  expect(workspace).toContain('EM BREVE • FIO NFC');
  expect(workspace).toContain('Sua marca também no mundo físico.');
  expect(workspace).toContain('home-quick-grid');
  expect(workspace).not.toContain("title={role==='CLIENT'?'Agende seu horário':'Agenda de hoje'}");
 });
 it('mantém a agenda acessível pelos atalhos e pelo menu',()=>{
  const workspace=readFileSync(resolve('src/pages/Workspace.tsx'),'utf8');
  expect(workspace).toContain('Horários e atendimentos em tempo real.');
  expect(workspace).toContain('Abrir mini site');
  expect(workspace).toContain('Personalização');
 });
});
