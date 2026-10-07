/**
 * FIO | SQL Stripe subscription re-purchase regression.
 * Executes authentic migration chain in local in-memory PGlite ONLY.
 * No dotenv, Supabase network, Stripe network, requests or data persistence.
 */
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const project=process.cwd();
const migrationDir=join(project,'supabase','migrations');
const patchFile='20261007010000_stripe_reassinatura_apos_cancelamento.sql';
const patchPath=join(migrationDir,patchFile);
const actor='78888888-8888-4888-8888-888888888801';
const hex='c'.repeat(64);
let pg;
let pass=0;
const ok=(message)=>{console.log('OK: '+message);pass++;};
function eventParams({event,sub,plan='PRO',amount=14990,status='active',shop}){
 const time=new Date().toISOString();
 return [event,'customer.subscription.updated',time,hex,shop,actor,
    sub,'cus_fiomvp_local_fixture','price_fiomvp_local_fixture',plan,'monthly',amount,
    status,time,status==='active'||status==='overdue'?new Date(Date.now()+30*86400000).toISOString():null,
    status==='cancelled'?time:null,'fio-subscription-v2'];
}
async function rpc(x){
 const response=await pg.query(`select public.apply_stripe_subscription_state(
   $1::text,$2::text,$3::timestamptz,$4::text,$5::uuid,$6::uuid,
   $7::text,$8::text,$9::text,$10::text,$11::text,$12::integer,
   $13::text,$14::timestamptz,$15::timestamptz,$16::timestamptz,$17::text
 ) as value`,eventParams(x));
 return response.rows[0].value;
}
async function row(sql,args=[]){return (await pg.query(sql,args)).rows[0];}
try{
 if(!existsSync(join(project,'package.json'))||!existsSync(join(project,'server','stripe.ts')))
  throw new Error('Execute na pasta do FIO, com server/stripe.ts.');
 if(!existsSync(patchPath))throw new Error('Faltou migration local: '+patchPath);
 pg=new PGlite();
 await pg.exec(`
 create schema auth;
 create role anon nologin;
 create role authenticated nologin;
 create role service_role nologin bypassrls;
 create table auth.users (id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
 $$;
 grant usage on schema public,auth to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;
 `);
 const files=readdirSync(migrationDir).filter(x=>x.endsWith('.sql')&&x!==patchFile).sort();
 if(files.length<40)throw new Error('Migrations originais incompletas: '+files.length);
 for(const filename of files){
  let sql=readFileSync(join(migrationDir,filename),'utf8').replace(/^\uFEFF/,'');
  try{await pg.exec(sql);}catch(e){throw new Error(`Falhou migration ${filename}: ${e.message}`)}
 }
 ok(`${files.length} migrations reais aplicadas NO BANCO DESCARTAVEL`);
 await pg.query('insert into auth.users (id) values ($1)',[actor]);
 await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false);`);
 const shop=(await row('select public.create_barbershop($1,$2,$3) as id',[
  'FIO Assinatura Teste','fio-qa-reassinatura-local','Usuario Teste'])).id;
 await pg.exec('reset role;');
 assert.ok(shop);
 ok('barbearia ficticia criada sem tocar em dados reais');
 const A='sub_fiomvp_first_sub_123';
 const B='sub_fiomvp_second_sub_456';
 const C='sub_fiomvp_third_sub_789';
 const a=await rpc({event:'evt_fiomvp_activate_first_01',sub:A,shop});
 assert.equal(a.applied,true,JSON.stringify(a));
 assert.equal((await row('select plan,status from public.saas_subscriptions where barbershop_id=$1',[shop])).plan,'PRO');
 ok('primeiro webhook de assinatura ativa o plano PRO');
 const duplicated=await rpc({event:'evt_fiomvp_activate_first_01',sub:A,shop});
 assert.equal(duplicated.duplicate,true);
 ok('webhook duplicado nao duplica cobranca nem alteracao de plano');
 const canceled=await rpc({event:'evt_fiomvp_cancel_first_02',sub:A,shop,status:'cancelled'});
 assert.equal(canceled.applied,true);
 assert.equal((await row('select status from public.saas_subscriptions where barbershop_id=$1',[shop])).status,'cancelled');
 ok('cancelamento remove o acesso da assinatura anterior');
 const conflict=await rpc({event:'evt_fiomvp_original_conflict_03',sub:B,shop,plan:'PREMIUM',amount:29990});
 assert.equal(conflict.conflict,true,'Esperava reproduzir bloqueio de recontratacao sem patch');
 ok('falha antiga reproduzida: recontratacao barrada apos cancelamento');
 const sql=readFileSync(patchPath,'utf8').replace(/^\uFEFF/,'');
 await pg.exec(sql);
 ok('migracao candidata de recontratacao aplicada SOMENTE NA MEMORIA');
 const b=await rpc({event:'evt_fiomvp_activate_second_04',sub:B,shop,plan:'PREMIUM',amount:29990});
 assert.equal(b.applied,true,'Nova assinatura deve ser aceita depois do cancelamento');
 assert.equal((await row('select plan,status from public.saas_subscriptions where barbershop_id=$1',[shop])).plan,'PREMIUM');
 const now=await pg.query('select provider_subscription_token,provider_status,is_current from public.saas_provider_subscriptions where barbershop_id=$1 order by created_at,provider_subscription_token',[shop]);
 assert.equal(now.rows.length,2);
 assert.equal(now.rows.filter(x=>x.is_current).length,1);
 assert.equal(now.rows.find(x=>x.provider_subscription_token===A).is_current,false);
 assert.equal(now.rows.find(x=>x.provider_subscription_token===B).is_current,true);
 ok('nova assinatura PREMIUM ativa; antiga fica arquivada; uma unica assinatura atual');
 const replay=await rpc({event:'evt_fiomvp_activate_second_04',sub:B,shop,plan:'PREMIUM',amount:29990});
 assert.equal(replay.duplicate,true);
 const late=await rpc({event:'evt_fiomvp_late_old_cancel_05',sub:A,shop,status:'cancelled'});
 assert.equal(late.historical,true,JSON.stringify(late));
 assert.equal((await row('select plan,status from public.saas_subscriptions where barbershop_id=$1',[shop])).plan,'PREMIUM');
 ok('duplicata e webhook atrasado nao roubam acesso da assinatura nova');
 const blocked=await rpc({event:'evt_fiomvp_prevent_third_06',sub:C,shop,plan:'PRO'});
 assert.equal(blocked.conflict,true);
 const cur=await row('select count(*)::integer as n from public.saas_provider_subscriptions where barbershop_id=$1 and is_current',[shop]);
 assert.equal(cur.n,1);
 ok('nova tentativa concorrente nao substitui assinatura ativa');
 console.log(`\nFIO - REASSINATURA LOCAL ${pass}/${pass}: VERDE.`);
 console.log('Nao houve conexao a internet, .env, Stripe nem Supabase remoto.');
 console.log('Migration pronta no FIO local, mas NAO aplicada ao banco remoto.');
}catch(e){
 console.error('FALHA: '+(e?.stack||String(e)));
 process.exitCode=1;
}finally{
 try{await pg?.close()}catch{}
}
