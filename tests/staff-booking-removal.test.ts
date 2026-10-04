import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('MVP sem Power e sem criação manual pelo BARBER',()=>{
 it('remove o controle de abrir/fechar da interface',()=>{
  const app=readFileSync(resolve('src/App.tsx'),'utf8');
  expect(app).not.toContain('ShopPowerControl');
  expect(app).not.toContain('shop-power-button');
  expect(app).not.toContain('Fechar barbearia');
 });

 it('mantém criação manual somente para OWNER na StaffAgenda',()=>{
  const workspace=readFileSync(resolve('src/pages/Workspace.tsx'),'utf8');
  const start=workspace.indexOf('function StaffAgenda');
  const end=workspace.indexOf('export function Agenda',start);
  const staff=workspace.slice(start,end);

  expect(staff).toContain("owner&&new URLSearchParams(location.search).has('novo')");
  expect(staff).toContain('owner&&<button type="button" className="simple-new-booking"');
  expect(staff).toContain('owner&&booking&&');
 });

 it('bloqueia BARBER também na API e no RPC',()=>{
  const server=readFileSync(resolve('server/app.ts'),'utf8');
  const sql=readFileSync(resolve('supabase/migrations/20261004152000_remove_power_and_staff_booking.sql'),'utf8');

  expect(server).toContain("if(c.member.role==='BARBER')throw new ApiError(403,'FORBIDDEN'");
  expect(sql).toContain("if public.member_role(p_shop)='BARBER' then");
  expect(sql).toContain('delete from public.shop_closures;');
 });
});