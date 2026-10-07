/**
 * FIO MVP - 50 local synthetic users.
 * Uses PGlite in memory only, authentic schema migrations, no external connection.
 * Not a 50-independent-PostgreSQL-connections load test.
 */
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const project = process.cwd();
const migrations = resolve(project, 'supabase', 'migrations');
const uuid = n => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const say = (line) => console.log(line);
const n = (value) => Number(value);

if (!existsSync(join(project, 'package.json')) ||
    !existsSync(join(project, 'server', 'app.ts')) ||
    !existsSync(migrations)) {
  console.error('ERRO: rode dentro da pasta original do FIO; faltou package.json, server/ ou supabase/migrations/.');
  process.exit(2);
}

const migrationFiles = readdirSync(migrations).filter(x => x.endsWith('.sql')).sort();
if (migrationFiles.length < 30) {
  console.error(`ERRO: somente ${migrationFiles.length} migrations encontradas; teste cancelado.`);
  process.exit(2);
}

// This harness never imports Supabase clients or reads .env / credentials.
say('FIO MVP - 50 CLIENTES FICTICIOS | BANCO 100% NA MEMORIA');
say(`Migrations reais: ${migrationFiles.length}`);
say('Sem conexao com Supabase/Stripe, sem deploy e sem criar dados reais.');

let db;
let successes = 0;
const started = performance.now();

async function admin() {
  await db.exec('reset role');
}
async function asUser(userNumber) {
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${uuid(userNumber)}',false);`);
}
async function scalar(query, parameters=[]) {
  const res = await db.query(query, parameters);
  assert.ok(res.rows.length > 0, `Consulta sem linhas: ${query.slice(0,70)}`);
  return Object.values(res.rows[0])[0];
}
async function mustFail(query, args, code) {
  let thrown;
  try { await db.query(query, args); } catch(err) { thrown = err; }
  assert.ok(thrown, `Operacao deveria falhar (${code})`);
  assert.match(String(thrown.message ?? thrown), new RegExp(code), `Erro inesperado em ${code}`);
}
function futureSlots() {
  const days=[];
  let day=new Date(Date.now()+3*86_400_000);
  day.setUTCHours(15,0,0,0);
  while(days.length < 10) {
    if(![0,6].includes(day.getUTCDay()))days.push(new Date(day));
    day.setUTCDate(day.getUTCDate()+1);
  }
  return Array.from({length:25}, (_,i)=>{
    const date=new Date(days[Math.floor(i/3)]);
    date.setUTCHours(15+(i%3),0,0,0);
    return date.toISOString();
  });
}

try {
  db = new PGlite();
  await db.exec(`
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

  for(const file of migrationFiles) {
    let sql=readFileSync(join(migrations,file),'utf8');
    if(sql.charCodeAt(0)===0xFEFF)sql=sql.slice(1);
    try { await db.exec(sql); }
    catch(err) { throw new Error(`Migration ${file}: ${err.message}`,{cause:err}); }
  }
  say('OK: migrations do FIO aplicadas no banco descartavel.');

  // 2 owners + 3 barbers + 50 clients. No real email, phone or passwords.
  const users=Array.from({length:55},(_,i)=>uuid(i+1));
  await db.query('insert into auth.users select unnest($1::uuid[])',[users]);

  await asUser(1);
  const shopA=await scalar('select public.create_barbershop($1,$2,$3)', ['FIO Teste A','fio-mvp-qa-a','Responsavel QA A']);
  await asUser(2);
  const shopB=await scalar('select public.create_barbershop($1,$2,$3)', ['FIO Teste B','fio-mvp-qa-b','Responsavel QA B']);

  await admin();
  await db.query("update public.saas_subscriptions set plan='PRO' where barbershop_id=any($1::uuid[])",[[shopA,shopB]]);
  await db.query(`insert into public.memberships(barbershop_id,user_id,role,display_name,active)
    values($1,$2,'BARBER','Barbeiro A1',true),($1,$3,'BARBER','Barbeiro A2',true),($4,$5,'BARBER','Barbeiro B1',true)`,
    [shopA,uuid(3),uuid(4),shopB,uuid(5)]);

  const serviceA=await scalar("insert into public.services(barbershop_id,name,duration_minutes,price_cents) values($1,'Corte teste A',40,5000) returning id",[shopA]);
  const serviceB=await scalar("insert into public.services(barbershop_id,name,duration_minutes,price_cents) values($1,'Corte teste B',40,6000) returning id",[shopB]);

  const members=[];
  for(let k=0;k<50;k++) {
    const userNumber=k+6;
    const isA=k<25;
    await asUser(userNumber);
    await db.query('select public.join_barbershop($1,$2)',[isA?'fio-mvp-qa-a':'fio-mvp-qa-b',`Cliente Ficticio ${k+1}`]);
    members.push({userNumber,shop:isA?shopA:shopB,shopLabel:isA?'A':'B'});
  }
  await admin();
  const customers=(await db.query('select user_id,id,barbershop_id from public.customers where user_id=any($1::uuid[])',[users.slice(5)])).rows;
  const customerByUser=new Map(customers.map(row=>[row.user_id,row]));
  assert.equal(customers.length,50,'Esperava 50 clientes diferentes');
  assert.equal(new Set(customers.map(c=>c.id)).size,50,'IDs de cliente duplicados');
  say('OK: 2 barbearias + 3 profissionais + 50 clientes falsos criados localmente.');
  successes++;

  const slots=futureSlots();
  const bookingIds=[];
  const startBookings=performance.now();
  for(let i=0;i<members.length;i++) {
    const member=members[i];
    const indexInShop=i%25;
    const barber=member.shopLabel==='A'?(indexInShop%2===0?uuid(3):uuid(4)):uuid(5);
    const service=member.shopLabel==='A'?serviceA:serviceB;
    const customer=customerByUser.get(uuid(member.userNumber));
    assert.ok(customer,'Cliente ficticio sem cadastro');
    await asUser(member.userNumber);
    const id=await scalar('select public.book_appointment($1,$2,$3,$4,$5)',[member.shop,customer.id,barber,service,slots[indexInShop]]);
    bookingIds.push(id);
  }
  assert.equal(new Set(bookingIds).size,50,'IDs de agendamento duplicados');
  say(`OK: 50 agendamentos autenticos pelo RPC, 25 por barbearia (${Math.round(performance.now()-startBookings)} ms em PGlite).`);
  successes++;

  // Real RLS checks (roles simulated via auth.uid, not service role).
  for(const member of members) {
    await asUser(member.userNumber);
    const mine=n(await scalar('select count(*)::int from public.appointments'));
    assert.equal(mine,1,`RLS: cliente ${member.userNumber} nao enxerga so seu horario`);
    const otherShop=member.shopLabel==='A'?shopB:shopA;
    const other=n(await scalar('select count(*)::int from public.appointments where barbershop_id=$1',[otherShop]));
    assert.equal(other,0,`RLS: cliente ${member.userNumber} enxerga tenant alheio`);
  }
  await asUser(1);
  assert.equal(n(await scalar('select count(*)::int from public.appointments')),25);
  await asUser(2);
  assert.equal(n(await scalar('select count(*)::int from public.appointments')),25);
  say('OK: RLS validada para os 50 clientes e os 2 responsaveis, sem vazamento entre lojas.');
  successes++;

  const firstA=customerByUser.get(uuid(6)).id;
  const secondA=customerByUser.get(uuid(7)).id;
  const firstB=customerByUser.get(uuid(31)).id;
  await asUser(7);
  await mustFail('select public.book_appointment($1,$2,$3,$4,$5)',[shopA,secondA,uuid(3),serviceA,slots[0]],'SLOT_UNAVAILABLE');
  await asUser(6);
  await mustFail('select public.book_appointment($1,$2,$3,$4,$5)',[shopA,firstA,uuid(4),serviceA,slots[0]],'CLIENT_ALREADY_BOOKED');
  say('OK: horario ocupado e mesmo cliente em dois profissionais sao bloqueados.');
  successes++;

  await asUser(6);
  await mustFail('select public.book_appointment($1,$2,$3,$4,$5)',[shopA,secondA,uuid(3),serviceA,slots[23]],'FORBIDDEN');
  await mustFail('select public.book_appointment($1,$2,$3,$4,$5)',[shopB,firstB,uuid(5),serviceB,slots[23]],'FORBIDDEN');
  await asUser(3);
  await mustFail('select public.book_appointment($1,$2,$3,$4,$5)',[shopA,secondA,uuid(3),serviceA,slots[23]],'FORBIDDEN');
  say('OK: cliente nao agenda para outro cadastro e barbeiro nao cria reserva pela API/RPC.');
  successes++;

  await asUser(6);
  await db.query("select public.transition_appointment($1,$2,'cancelled')",[shopA,bookingIds[0]]);
  await asUser(7);
  const replaced=await scalar('select public.book_appointment($1,$2,$3,$4,$5)',[shopA,secondA,uuid(3),serviceA,slots[0]]);
  assert.ok(replaced!==bookingIds[0]);
  await admin();
  assert.equal(n(await scalar("select count(*)::int from public.appointments where status='cancelled'")),1);
  assert.equal(n(await scalar("select count(*)::int from public.appointments where status not in ('cancelled','no_show')")),50);
  say('OK: cancelar libera horario e outra pessoa consegue reservar sem duplicar ativos.');
  successes++;

  const backend=readFileSync(join(project,'server','app.ts'),'utf8');
  assert.ok(backend.includes("c.db.rpc('book_appointment'"),'API nao chama RPC do banco');
  say('OK: rota de producao aponta para RPC validado (verificacao estatica).');
  successes++;

  const totalMs=Math.round(performance.now()-started);
  say('--------------------------------------------------');
  say(`FIO MVP - ${successes}/${successes} grupos APROVADOS | ${totalMs} ms`);
  say('50 clientes/50 agendamentos: BANCO LOCAL, nao dados reais.');
  say('OBS: PGlite usa UMA conexao. Nao prova 50 conexoes simultaneas no servidor.');
  say('Proxima validacao independente: carga HTTP multi-conexao em ambiente de homologacao isolado.');
} catch(err) {
  console.error(`FALHA MVP LOCAL: ${err?.message??String(err)}`);
  if(process.env.FIO_QA_DEBUG==='1' && err?.stack)console.error(err.stack);
  process.exitCode=1;
} finally {
  try { await db?.close(); } catch {}
}
