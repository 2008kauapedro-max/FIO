import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('MVP sem Power e sem criação manual indevida',()=>{
 it('remove o controle de abrir/fechar da interface',()=>{
  const app=readFileSync(resolve('src/App.tsx'),'utf8');
  expect(app).not.toContain('ShopPowerControl');
  expect(app).not.toContain('shop-power-button');
  expect(app).not.toContain('Fechar barbearia');
 });

 it('criação manual fica apenas para OWNER de operação com equipe',()=>{
  const workspace=readFileSync(resolve('src/pages/Workspace.tsx'),'utf8');
  const start=workspace.indexOf('function StaffAgenda');
  const end=workspace.indexOf('export function Agenda',start);
  const staff=workspace.slice(start,end);

  expect(staff).toContain("const canCreateManual=owner&&!solo;");
  expect(staff).toContain("canCreateManual&&new URLSearchParams(location.search).has('novo')");
  expect(staff).toContain('canCreateManual&&<button type="button" className="simple-new-booking"');
  expect(staff).toContain('canCreateManual&&booking&&');
 });

 it('bloqueia BARBER e também OWNER SOLO na API e no RPC',()=>{
  const server=readFileSync(resolve('server/app.ts'),'utf8');
  const oldSql=readFileSync(resolve('supabase/migrations/20261004152000_remove_power_and_staff_booking.sql'),'utf8');
  const sql=readFileSync(resolve('supabase/migrations/20261004204000_solo_live_qa_fixes.sql'),'utf8');

  expect(server).toContain("if(c.member.role==='BARBER')throw new ApiError(403,'FORBIDDEN'");
  expect(server).toContain("if(shop.data.operation_mode==='SOLO')throw new ApiError(403,'FORBIDDEN'");
  expect(oldSql).toContain('delete from public.shop_closures;');
  expect(sql).toContain("if v_role='BARBER' then");
  expect(sql).toContain("if v_mode='SOLO' then");
 });
});