import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
const uid=(n:number)=>'c0000000-0000-4000-8000-'+String(n).padStart(12,'0');
let db:PGlite,shop:string;
async function asUser(n:number){await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+uid(n)+"',false);");}
async function isProvider(){await db.exec('reset role');const r=await db.query<{is_provider:boolean}>('select fio_private.is_provider($1,$2)',[shop,uid(1)]);await asUser(1);return r.rows[0].is_provider;}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec("create schema auth;create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;");
 for(const f of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 await db.query('insert into auth.users select unnest($1::uuid[])',[[1,2].map(uid)]);
 await asUser(1);shop=(await db.query<{create_barbershop:string}>("select public.create_barbershop('V23 Barbershop','v23-barbershop','Owner One')")).rows[0].create_barbershop;
},60000);
afterAll(async()=>{await db?.close();});
describe('V23 owner barber opt-out',()=>{
 it('owner is active by default and can disable without losing ownership',async()=>{
  await asUser(1);expect(await isProvider()).toBe(true);
  await db.query('select public.fio_set_owner_booking_availability($1,false)',[shop]);
  expect(await isProvider()).toBe(false);
  const role=await db.query<{member_role:string}>('select public.member_role($1)',[shop]);
  expect(role.rows[0].member_role).toBe('OWNER');
  await db.query('select public.fio_set_owner_booking_availability($1,true)',[shop]);
  expect(await isProvider()).toBe(true);
 });
 it('non-owner cannot change owner availability',async()=>{
  await asUser(2);await expect(db.query('select public.fio_set_owner_booking_availability($1,false)',[shop])).rejects.toThrow('FORBIDDEN');
 });
});
