import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const uid=(n:number)=>`31000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let db:PGlite,shop:string;

async function asUser(n:number){
 await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${uid(n)}',false);`);
}
async function scalar<T=string>(sql:string,args:unknown[]=[]){
 const r=await db.query<Record<string,T>>(sql,args);
 return Object.values(r.rows[0])[0];
}

beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create schema auth;create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`);
 for(const f of readdirSync(resolve('supabase/migrations')).sort())await db.exec(readFileSync(resolve('supabase/migrations',f),'utf8'));
 await db.query('insert into auth.users select unnest($1::uuid[])',[[1,2,3].map(uid)]);
 await asUser(1);
 shop=await scalar("select public.create_workspace('Entrada Cliente','entrada-cliente','Owner','SHOP')");
});
afterAll(async()=>{await db?.close();});

describe('entrada do cliente no MVP',()=>{
 it('grava vínculo e telefone juntos e desfaz tudo quando o telefone pertence a outra conta',async()=>{
  await asUser(2);
  expect(await scalar("select public.join_barbershop_with_profile('entrada-cliente','Cliente Um','61999999999')")).toBe(shop);

  // O registry é privado por desenho. A checagem do teste usa o papel de banco
  // apenas para inspecionar o efeito; usuários autenticados continuam sem SELECT.
  await db.exec('reset role');
  expect(await scalar("select phone_e164 from public.account_phone_registry where user_id=$1",[uid(2)])).toBe('5561999999999');

  await asUser(3);
  await expect(db.query("select public.join_barbershop_with_profile('entrada-cliente','Cliente Dois','61999999999')")).rejects.toThrow('PHONE_ALREADY_IN_USE');

  await db.exec('reset role');
  expect(await scalar<number>("select count(*)::int from public.memberships where barbershop_id=$1 and user_id=$2",[shop,uid(3)])).toBe(0);
  expect(await scalar<number>("select count(*)::int from public.customers where barbershop_id=$1 and user_id=$2",[shop,uid(3)])).toBe(0);
 });

 it('mantém o cliente fora da visão geral/IA e deixa campanhas/notificações fora da interface',()=>{
  const app=readFileSync(resolve('src/App.tsx'),'utf8');
  const workspace=readFileSync(resolve('src/pages/Workspace.tsx'),'utf8');
  const server=readFileSync(resolve('server/app.ts'),'utf8');
  const auth=readFileSync(resolve('src/pages/Auth.tsx'),'utf8');

  expect(app).toContain("roles:['OWNER','BARBER'],feature:'assistant'");
  expect(app).toContain("if(role==='CLIENT'&&page==='')return <Navigate replace to={`${base}/agenda${location.search}`}/>");
  expect(app).not.toContain("path:'/comunicacao'");
  expect(workspace).not.toContain("['notifications',t('settings.notifications')");
  expect(server).toContain("Assistente disponível apenas para a equipe.");
  expect(auth).toContain("mode:'join'");
  expect(auth).toContain("displayName:displayName.trim()");
  expect(auth).toContain("phone:phone.trim()");
  expect(auth).toContain("slug,");
 });
});
