import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const uid='50000000-0000-4000-8000-000000000001';
let db:PGlite;

beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create schema auth;
 create role anon nologin;
 create role authenticated nologin;
 create role service_role nologin bypassrls;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;`);

 for(const file of readdirSync(resolve('supabase/migrations')).sort())
  await db.exec(readFileSync(resolve('supabase/migrations',file),'utf8'));

 await db.query('insert into auth.users(id) values($1)',[uid]);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${uid}',false);`);
});

afterAll(async()=>{await db?.close();});

describe('SOLO live QA V8',()=>{
 it('catálogo administrativo possui SOLO e o trial FREE -> SOLO funciona',async()=>{
  await db.exec('reset role;');
  const plans=await db.query<{code:string}>(
   "select code from public.saas_plans where code in ('SOLO','SOLO_PREMIUM') order by code"
  );
  expect(plans.rows.map(row=>row.code)).toEqual(['SOLO','SOLO_PREMIUM']);
  await db.exec('set role authenticated;');
  await db.query(
   "select set_config('request.jwt.claim.sub',$1,false)",
   [uid]
  );

  const created=await db.query<{create_workspace:string}>(
   "select public.create_workspace('Solo Trial','solo-trial','Pedro','SOLO')"
  );
  const shopId=created.rows[0].create_workspace;

  await db.query(
   'select public.start_saas_pro_trial($1)',
   [shopId]
  );

  const subscription=await db.query<{plan:string;status:string;plan_id:string|null}>(
   'select plan,status,plan_id from public.saas_subscriptions where barbershop_id=$1',
   [shopId]
  );

  expect(subscription.rows[0].plan).toBe('SOLO');
  expect(subscription.rows[0].status).toBe('trialing');
  expect(subscription.rows[0].plan_id).toBeTruthy();
 });

 it('agenda de gestão respeita closed do backend e pinta fechado separado',()=>{
  const calendar=readFileSync(resolve('src/components/AgendaMonthCalendar.tsx'),'utf8');
  const css=readFileSync(resolve('src/styles.css'),'utf8');

  expect(calendar).toContain('closed:boolean');
  expect(calendar).toContain("const closed=known&&Boolean(row?.closed);");
  expect(calendar).toContain("${closed?'closed ':''}");
  expect(css).toContain('.simple-month-grid>button.closed i');
  expect(css).toContain('background:#747474!important');
 });

 it('SOLO não mostra criação manual e Configurações edita dias de funcionamento',()=>{
  const workspace=readFileSync(resolve('src/pages/Workspace.tsx'),'utf8');
  const hours=readFileSync(resolve('src/components/BusinessHoursSettings.tsx'),'utf8');
  const server=readFileSync(resolve('server/app.ts'),'utf8');
  const sql=readFileSync(resolve('supabase/migrations/20261004204000_solo_live_qa_fixes.sql'),'utf8');

  expect(workspace).toContain('const canCreateManual=owner&&!solo;');
  expect(workspace).toContain("['hours',t('settings.businessHours'),Clock3]");
  expect(workspace).toContain("<BusinessHoursSettings {...p}/>");
  expect(hours).toContain("'/onboarding/progress'");
  expect(hours).toContain("'/onboarding/hours'");
  expect(server).toContain("if(shop.data.operation_mode==='SOLO')");
  expect(sql).toContain("if v_mode='SOLO' then");
 });

 it('site público deixa só instalar/abrir app e painel CLIENT recebe accent da barbearia',()=>{
  const portal=readFileSync(resolve('src/pages/PublicPortal.tsx'),'utf8');
  const app=readFileSync(resolve('src/App.tsx'),'utf8');
  const css=readFileSync(resolve('src/styles.css'),'utf8');

  expect(portal).not.toContain("onClick={goClient}>{t('role.clientArea')}</button>");
  expect(portal).toContain("onClick={()=>openInstallChooser()}");
  expect(app).toContain("'--client-accent':clientAccent");
  expect(css).toContain('.client-shell .primary');
  expect(css).toContain('var(--client-accent)');
 });

 it('planos mobile mantêm controles/CTA fixos e removem textos redundantes',()=>{
  const plans=readFileSync(resolve('src/pages/FioPlans.tsx'),'utf8');
  const css=readFileSync(resolve('src/styles.css'),'utf8');

  expect(plans).not.toContain('Escolha seu plano');
  expect(plans).not.toContain('Compare e assine em poucos toques.');
  expect(plans).not.toContain('Pix · ativa assim que o pagamento for confirmado');
  expect(plans).toContain('fio-payflow-plan-controls');
  expect(plans).toContain('fio-payflow-plan-scroll');
  expect(plans).toContain("t('fp.trialCta'");
  expect(css).toContain('grid-template-rows:auto minmax(0,1fr) auto');
 });

 it('checkout deixa o aceite grande e loading preserva a logo inteira',()=>{
  const css=readFileSync(resolve('src/styles.css'),'utf8');

  expect(css).toContain('.fio-payflow-consent input');
  expect(css).toContain('width:24px!important');
  expect(css).toContain('.fio-loading-screen.fio-loading-screen--brand .fio-loading-brand-logo:not(.is-fio)');
  expect(css).toContain('object-fit:contain!important');
 });
});
