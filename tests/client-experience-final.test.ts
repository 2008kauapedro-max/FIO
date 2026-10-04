import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const uid=(n:number)=>
 `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

let db:PGlite;
let shop:string;
let service20:string;
let service60:string;
let customer3:string;
let customer4:string;
let mondayKey:string;
let followingMondayKey:string;
let tuesdayKey:string;

async function asUser(n:number){
 await db.exec(
  `reset role;
   set role authenticated;
   select set_config(
    'request.jwt.claim.sub',
    '${uid(n)}',
    false
   );`
 );
}

async function admin(){
 await db.exec('reset role');
}

async function scalar<T=string>(
 sql:string,
 args:unknown[]=[]
):Promise<T>{
 const result=await db.query<Record<string,T>>(sql,args);
 return Object.values(result.rows[0])[0];
}

function nextMonday(offsetDays=3){
 const d=new Date(Date.now()+offsetDays*86400000);
 d.setUTCHours(12,0,0,0);

 while(d.getUTCDay()!==1)
  d.setUTCDate(d.getUTCDate()+1);

 return d;
}

function dateKey(value:unknown){
 if(value instanceof Date)
  return value.toISOString().slice(0,10);

 return String(value).slice(0,10);
}

function saoPauloIso(
 day:string,
 hour:number,
 minute:number
){
 // Brasil não usa horário de verão desde 2019.
 return `${day}T${String(hour+3).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00.000Z`;
}

beforeAll(async()=>{
 db=new PGlite();

 await db.exec(`
  create schema auth;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create table auth.users(id uuid primary key);

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
  of readdirSync(resolve('supabase/migrations')).sort()
 ){
  await db.exec(
   readFileSync(
    resolve('supabase/migrations',file),
    'utf8'
   )
  );
 }

 await db.query(
  'insert into auth.users select unnest($1::uuid[])',
  [[1,2,3,4].map(uid)]
 );

 await asUser(1);

 shop=await scalar(
  'select public.create_barbershop($1,$2,$3)',
  [
   'Experiência Cliente',
   'experiencia-cliente',
   'Dono'
  ]
 );

 const invite=await scalar(
  'select public.create_invitation($1,$2)',
  [shop,'BARBER']
 );

 await asUser(2);

 await db.query(
  'select public.accept_invitation($1,$2)',
  [invite,'Barbeiro']
 );

 await asUser(3);

 await db.query(
  'select public.join_barbershop($1,$2)',
  ['experiencia-cliente','Cliente Um']
 );

 await asUser(4);

 await db.query(
  'select public.join_barbershop($1,$2)',
  ['experiencia-cliente','Cliente Dois']
 );

 await asUser(1);

 customer3=await scalar(
  'select id from public.customers where barbershop_id=$1 and user_id=$2',
  [shop,uid(3)]
 );

 customer4=await scalar(
  'select id from public.customers where barbershop_id=$1 and user_id=$2',
  [shop,uid(4)]
 );

 service20=await scalar(
  `insert into public.services(
    barbershop_id,
    name,
    duration_minutes,
    price_cents
   )
   values($1,'Corte 20',20,4000)
   returning id`,
  [shop]
 );

 service60=await scalar(
  `insert into public.services(
    barbershop_id,
    name,
    duration_minutes,
    price_cents
   )
   values($1,'Corte 60',60,7000)
   returning id`,
  [shop]
 );

 await db.query(
  'select public.configure_staff_schedule($1,$2,$3::jsonb,$4::uuid[])',
  [
   shop,
   uid(2),
   JSON.stringify([
    {
     weekday:1,
     opens_at:'09:00',
     closes_at:'10:00'
    }
   ]),
   []
  ]
 );

 const monday=nextMonday();

 const followingMonday=
  new Date(monday);

 followingMonday.setUTCDate(
  followingMonday.getUTCDate()+7
 );

 const tuesday=
  new Date(monday);

 tuesday.setUTCDate(
  tuesday.getUTCDate()+1
 );

 mondayKey=
  monday.toISOString().slice(0,10);

 followingMondayKey=
  followingMonday.toISOString().slice(0,10);

 tuesdayKey=
  tuesday.toISOString().slice(0,10);
},60000);

afterAll(async()=>{
 await db?.close();
});


describe(
 'experiência final do cliente',
 ()=>{
  it(
   'aceita 09:20 e mantém a grade real de 20 minutos',
   async()=>{
    await asUser(3);

    const start=
     saoPauloIso(
      mondayKey,
      9,
      20
     );

    const id=await scalar(
     `select public.book_appointment(
       $1,$2,$3,$4,$5,false
      )`,
     [
      shop,
      customer3,
      uid(2),
      service20,
      start
     ]
    );

    expect(id).toMatch(
     /^[0-9a-f-]{36}$/i
    );

    expect(
     dateKey(
      await scalar(
       'select starts_at from public.appointments where id=$1',
       [id]
      )
     )
    ).toBe(mondayKey);
   }
  );


  it(
   'marca sem expediente como fechado e lotação real como full',
   async()=>{
    await asUser(4);

    await scalar(
     `select public.book_appointment(
       $1,$2,$3,$4,$5,false
      )`,
     [
      shop,
      customer4,
      uid(2),
      service60,
      saoPauloIso(
       followingMondayKey,
       9,
       0
      )
     ]
    );

    await asUser(3);

    const mondayRows=
     (
      await db.query<{
       day:unknown;
       available_count:number;
       closed:boolean;
      }>(
       `select *
        from public.calendar_day_availability(
         $1,$2,$3,$4
        )`,
       [
        shop,
        uid(2),
        service60,
        followingMondayKey.slice(0,7)+'-01'
       ]
      )
     ).rows;

    const fullDay=
     mondayRows.find(
      row=>
       dateKey(row.day)===
       followingMondayKey
     );

    expect(fullDay).toBeTruthy();
    expect(fullDay?.closed).toBe(false);
    expect(
     Number(
      fullDay?.available_count??-1
     )
    ).toBe(0);

    const tuesdayRows=
     (
      await db.query<{
       day:unknown;
       available_count:number;
       closed:boolean;
      }>(
       `select *
        from public.calendar_day_availability(
         $1,$2,$3,$4
        )`,
       [
        shop,
        uid(2),
        service20,
        tuesdayKey.slice(0,7)+'-01'
       ]
      )
     ).rows;

    const closedDay=
     tuesdayRows.find(
      row=>
       dateKey(row.day)===
       tuesdayKey
     );

    expect(closedDay).toBeTruthy();
    expect(closedDay?.closed).toBe(true);
    expect(
     Number(
      closedDay?.available_count??-1
     )
    ).toBe(0);
   }
  );


  it(
   'perfil do Feed entrega avaliações sem expor identidade do cliente',
   async()=>{
    await admin();

    const appointment=await scalar(
     `insert into public.appointments(
       barbershop_id,
       client_id,
       barber_id,
       service_id,
       starts_at,
       ends_at,
       price_cents,
       status,
       created_by
      )
      values(
       $1,$2,$3,$4,
       now()-interval '2 days',
       now()-interval '2 days'+interval '20 minutes',
       4000,
       'completed',
       $5
      )
      returning id`,
     [
      shop,
      customer3,
      uid(2),
      service20,
      uid(3)
     ]
    );

    await db.query(
     `insert into public.reviews(
       barbershop_id,
       appointment_id,
       client_id,
       barber_id,
       rating,
       comment
      )
      values(
       $1,$2,$3,$4,5,$5
      )`,
     [
      shop,
      appointment,
      customer3,
      uid(2),
      'Atendimento excelente'
     ]
    );

    await asUser(4);

    const profiles=await scalar<
     Array<{
      barber_id:string;
      review_count:number;
      completed_count:number;
      reviews:Array<Record<string,unknown>>;
     }>
    >(
     'select public.feed_professional_profiles($1)',
     [shop]
    );

    const barber=
     profiles.find(
      item=>
       item.barber_id===uid(2)
     );

    expect(barber).toBeTruthy();
    expect(
     Number(
      barber?.review_count??0
     )
    ).toBeGreaterThan(0);

    expect(
     Number(
      barber?.completed_count??0
     )
    ).toBeGreaterThan(0);

    const review=
     barber?.reviews.find(
      item=>
       item.comment===
       'Atendimento excelente'
     );

    expect(review).toBeTruthy();
    expect(review).not.toHaveProperty('client_id');
    expect(review).not.toHaveProperty('client_name');
    expect(review).not.toHaveProperty('phone');
   }
  );


  it(
   'UI diferencia fechado/lotado, organiza Feed e limpa o site público',
   ()=>{
    const calendar=
     readFileSync(
      resolve(
       'src/components/BookingCalendar.tsx'
      ),
      'utf8'
     );

    const feed=
     readFileSync(
      resolve('src/pages/Feed.tsx'),
      'utf8'
     );

    const portal=
     readFileSync(
      resolve(
       'src/pages/PublicPortal.tsx'
      ),
      'utf8'
     );

    const styles=
     readFileSync(
      resolve('src/styles.css'),
      'utf8'
     );

    expect(calendar)
     .toContain(
      "isClosed||!inRange"
     );

    expect(calendar)
     .toContain(
      'const available=inRange&&known&&!isClosed&&count>0;'
     );

    expect(calendar)
     .toContain(
      'const full=inRange&&known&&!isClosed&&count===0;'
     );

    expect(feed)
     .toContain(
      'feed-professional-scroll'
     );

    expect(feed)
     .toContain(
      "tab==='reviews'"
     );

    expect(feed)
     .toContain(
      'feed-review-filters'
     );

    expect(feed)
     .toContain(
      'sortReviews'
     );

    expect(portal)
     .not.toContain(
      'booking-powered-card'
     );

    expect(portal)
     .not.toContain(
      'Plano FIO ativo'
     );

    expect(portal)
     .not.toContain(
      'Assistente FIO incluído'
     );

    expect(portal)
     .toContain(
      '--public-surface-secondary'
     );

    expect(styles)
     .toContain(
      'var(--shop-accent)'
     );

    expect(styles)
     .toContain(
      '.feed-profile-tabs'
     );
   }
  );
 }
);