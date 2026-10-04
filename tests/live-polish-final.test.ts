import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

let db:PGlite;

beforeAll(async()=>{
 db=new PGlite();

 await db.exec(`
  create schema auth;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create table auth.users(
   id uuid primary key
  );

  create function auth.uid()
  returns uuid
  language sql
  stable
  as $$
   select nullif(
    current_setting(
     'request.jwt.claim.sub',
     true
    ),
    ''
   )::uuid
  $$;

  grant usage
  on schema public,auth
  to authenticated,anon,service_role;

  grant execute
  on function auth.uid()
  to authenticated,anon,service_role;
 `);

 for(
  const file
  of readdirSync(
   resolve('supabase/migrations')
  ).sort()
 ){
  await db.exec(
   readFileSync(
    resolve(
     'supabase/migrations',
     file
    ),
    'utf8'
   )
  );
 }
},60000);

afterAll(async()=>{
 await db?.close();
});

describe('polimento final ao vivo',()=>{
 it('billing enrollment aceita SOLO e SOLO_PREMIUM',async()=>{
  const result=await db.query<{
   definition:string;
  }>(`
   select
    pg_get_constraintdef(oid) as definition

   from pg_constraint

   where
    conrelid=
     'public.syncpay_enrollment_intents'::regclass
    and conname=
     'syncpay_enrollment_intents_plan_code_check'
  `);

  const definition=
   result.rows[0]?.definition??'';

  expect(definition)
   .toContain('SOLO');

  expect(definition)
   .toContain('SOLO_PREMIUM');

  expect(definition)
   .toContain('PRO');

  expect(definition)
   .toContain('PREMIUM');
 });

 it('cliente não recebe plano FIO e assistente no rodapé das configurações',()=>{
  const workspace=readFileSync(
   resolve('src/pages/Workspace.tsx'),
   'utf8'
  );

  expect(workspace)
   .toContain(
    "p.data.membership.role!=='CLIENT'&&<section className=\"settings-card settings-meta\""
   );
 });

 it('tutorial navega para as telas reais e volta ao início ao terminar',()=>{
  const tour=readFileSync(
   resolve('src/components/GuidedTour.tsx'),
   'utf8'
  );

  const app=readFileSync(
   resolve('src/App.tsx'),
   'utf8'
  );

  expect(tour)
   .toContain(
    "route:`${base}/agenda`"
   );

  expect(tour)
   .toContain(
    "route:`${base}/configuracoes`"
   );

  expect(tour)
   .toContain(
    "route:`${base}/suporte`"
   );

  expect(tour)
   .toContain(
    "navigate(base,{"
   );

  expect(app)
   .toContain(
    'data-tour="navigation"'
   );

  expect(app)
   .toContain(
    "page==='/agenda'?'agenda-page'"
   );
 });

 it('compartilhamento usa branding público e não duplica o link',()=>{
  const onboarding=readFileSync(
   resolve('src/pages/OwnerOnboarding.tsx'),
   'utf8'
  );

  const server=readFileSync(
   resolve('server/app.ts'),
   'utf8'
  );

  expect(onboarding)
   .toContain(
    ".replaceAll(publicLink,'')"
   );

  expect(onboarding)
   .toContain(
    'if(favicon)favicon.href=href'
   );

  expect(server)
   .toContain(
    'property="og:image"'
   );

  expect(server)
   .toContain(
    'property="og:title"'
   );

  expect(server)
   .toContain(
    "['SOLO','SOLO_PREMIUM','PRO','PLUS','PREMIUM']"
   );
 });

 it('loading interativo e domingo fechado têm tratamento visual explícito',()=>{
  const api=readFileSync(
   resolve('src/lib/api.ts'),
   'utf8'
  );

  const styles=readFileSync(
   resolve('src/styles.css'),
   'utf8'
  );

  expect(api)
   .toContain(
    'beginInteractiveRequest'
   );

  expect(api)
   .toContain(
    "interactive=!['GET','HEAD'].includes(requestMethod)"
   );

  expect(styles)
   .toContain(
    '.fio-global-busy.is-visible'
   );

  expect(styles)
   .toContain(
    '.booking-calendar-grid>button.selected.closed'
   );

  expect(styles)
   .toContain(
    'background:#747474!important'
   );
 });

 it('SOLO não usa mais 1 profissional como argumento de venda',()=>{
  const catalog=readFileSync(
   resolve('shared/fio-plans.ts'),
   'utf8'
  );

  const marker=catalog.indexOf(
   "code:'SOLO'"
  );

  const premium=catalog.indexOf(
   "code:'SOLO_PREMIUM'"
  );

  expect(
   catalog.slice(
    marker,
    premium
   )
  )
   .toContain(
    'Agenda e app profissional'
   );

  expect(
   catalog.slice(
    marker,
    premium
   )
  )
   .not.toContain(
    "'1 profissional'"
   );

  expect(
   catalog.slice(
    premium,
    catalog.indexOf(
     "code:'PRO'",
     premium
    )
   )
  )
   .not.toContain(
    "'1 profissional'"
   );
 });
});