import {useEffect,useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {api} from '../lib/api';
import {useI18n} from '../i18n';

type Availability={day:string;available_count:number};
type PeriodItem={starts_at:string;status:string};
type PeriodResult={items:PeriodItem[]};

function moveMonth(value:string,amount:number){
 const [year,month]=value.split('-').map(Number);
 const date=new Date(Date.UTC(year,month-1+amount,1));
 return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}

export function AgendaMonthCalendar(p:{
 shopId:string;
 barberId:string;
 serviceId:string;
 zone:string;
 date:string;
 demo:boolean;
 onDateChange:(value:string)=>void;
}){
 const {t,locale}=useI18n();
 const dateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:p.zone,year:'numeric',month:'2-digit',day:'2-digit'});
 const today=dateFormatter.format(new Date());
 const [month,setMonth]=useState((p.date||today).slice(0,7));
 const [availability,setAvailability]=useState<Record<string,number>>({});
 const [bookedDays,setBookedDays]=useState<Set<string>>(new Set());
 const [loading,setLoading]=useState(false);

 useEffect(()=>{
  if(p.date&&p.date.slice(0,7)!==month)setMonth(p.date.slice(0,7));
 },[p.date]);

 useEffect(()=>{
  let alive=true;
  if(!p.barberId||!p.serviceId){setAvailability({});setBookedDays(new Set());return;}
  if(p.demo){
   const [y,m]=month.split('-').map(Number);
   const total=new Date(Date.UTC(y,m,0)).getUTCDate();
   const next:Record<string,number>={};
   for(let d=1;d<=total;d++){
    const key=`${month}-${String(d).padStart(2,'0')}`;
    if(key>=today)next[key]=2;
   }
   setAvailability(next);
   setBookedDays(new Set());
   return;
  }

  const [year,monthNumber]=month.split('-').map(Number);
  const lastDay=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  const from=`${month}-01`;
  const to=`${month}-${String(lastDay).padStart(2,'0')}`;

  setLoading(true);

  void Promise.all([
   api<Availability[]>(
    `/slots/month?barberId=${encodeURIComponent(p.barberId)}&serviceId=${encodeURIComponent(p.serviceId)}&monthStart=${month}-01`,
    p.shopId
   ),
   api<PeriodResult>(
    `/appointments/period?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&barberId=${encodeURIComponent(p.barberId)}`,
    p.shopId
   )
  ]).then(([rows,period])=>{
   if(!alive)return;
   setAvailability(Object.fromEntries(rows.map(row=>[row.day,Number(row.available_count)])));

   const formatter=new Intl.DateTimeFormat('en-CA',{
    timeZone:p.zone,
    year:'numeric',
    month:'2-digit',
    day:'2-digit'
   });

   const nextBooked=new Set(
    (period.items??[])
     .filter(item=>item.status!=='cancelled')
     .map(item=>formatter.format(new Date(item.starts_at)))
   );

   setBookedDays(nextBooked);
  }).catch(()=>{
   if(alive){setAvailability({});setBookedDays(new Set());}
  }).finally(()=>{
   if(alive)setLoading(false);
  });

  return()=>{alive=false};
 },[month,p.barberId,p.serviceId,p.shopId,p.demo,p.zone]);

 const [year,monthNumber]=month.split('-').map(Number);
 const lastDay=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
 const offset=(new Date(Date.UTC(year,monthNumber-1,1)).getUTCDay()+6)%7;
 const days=useMemo(()=>[
  ...Array(offset).fill(null),
  ...Array.from({length:lastDay},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)
 ],[month,offset,lastDay]);
 const previous=moveMonth(month,-1);
 const next=moveMonth(month,1);

 return <section className="simple-month-calendar">
  <div className="simple-month-head">
   <button type="button" onClick={()=>setMonth(previous)} aria-label={t('calendar.previousMonth')}><ChevronLeft size={17}/></button>
   <strong>{new Intl.DateTimeFormat(locale==='en'?'en-US':locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,monthNumber-1,1)))}</strong>
   <button type="button" onClick={()=>setMonth(next)} aria-label={t('calendar.nextMonth')}><ChevronRight size={17}/></button>
  </div>

  <div className="simple-month-weekdays">
   {['calendar.mon','calendar.tue','calendar.wed','calendar.thu','calendar.fri','calendar.sat','calendar.sun'].map(key=><span key={key}>{t(key).slice(0,1)}</span>)}
  </div>

  <div className="simple-month-grid">
   {days.map((key,index)=>{
    if(!key)return <span key={'blank-'+index}/>;
    const past=key<today;
    const count=Number(availability[key]??0);
    const known=Object.prototype.hasOwnProperty.call(availability,key);
    const available=known&&count>0;
    // Vermelho somente quando houve agendamento no dia e não restou nenhum horário.
    const full=known&&count===0&&bookedDays.has(key);
    return <button
     type="button"
     key={key}
     className={`${p.date===key?'selected ':''}${available?'available ':''}${full?'full ':''}${past?'past':''}`}
     onClick={()=>p.onDateChange(key)}
    >
     <strong>{Number(key.slice(-2))}</strong>
     {!loading&&known&&<i aria-hidden="true"/>}
    </button>;
   })}
  </div>

  <div className="simple-month-legend">
   <span><i className="available"/>{t('calendar.available')}</span>
   <span><i className="full"/>{t('calendar.full')}</span>
  </div>
 </section>;
}
