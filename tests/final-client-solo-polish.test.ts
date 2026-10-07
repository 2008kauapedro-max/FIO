import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const read=(file:string)=>
 readFileSync(resolve(file),'utf8');

describe('polimento final cliente e SOLO',()=>{

 it('protege conta e senha',()=>{
  const app=read('src/App.tsx');
  const auth=read('src/pages/Auth.tsx');

  expect(app)
   .toContain("t('app.switchAccount')");

  expect(auth)
   .toContain('const strongPassword=(value:string)=>');

  expect(auth)
   .toContain("t('auth.confirmPassword')");

  expect(auth)
   .toMatch(
    /supabase!\.auth\.updateUser\(\{\s*password\s*\}\)/s
   );
 });

 it('SOLO mostra cliente e nome comercial correto',()=>{
  const workspace=read('src/pages/Workspace.tsx');
  const plans=read('shared/fio-plans.ts');

  expect(workspace)
   .toContain("role==='OWNER'&&!solo");

  expect(workspace)
   .toContain('simple-appointment-avatar');

  expect(workspace)
   .toContain('{!solo&&<div>');

  expect(plans)
   .toContain("plan==='SOLO'?'FIO PRO'");
 });

});
