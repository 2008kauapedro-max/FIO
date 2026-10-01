import {useEffect,useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,Clock3} from 'lucide-react';
import {api} from '../lib/api';

type Availability={day:string;available_count:number};
type Period='morning'|'afternoon'|'night';

const labels:Record<Period,string>={
 morning:'Manhã',
 afternoon:'Tarde',
 night:'Noite'
};

function moveMonth(value:string,amount:number){
 const [year,month]=value.split('-').map(Number);
 const date=new Date(Date.UTC(year,month-1+amount,1));
 return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}

function monthName(value:string){
 const [year,month]=value.split('-').map(Number);
 return new Intl.DateTimeFormat('pt-BR',{
  month:'long',
  year:'numeric',
  timeZone:'UTC'
 }).format(new Date(Date.UTC(year,month-1,1)));
}

export function BookingCalendar(p:{
 shopId:string;
 barberId:string;
 serviceId:string;
 zone:string;
 date:string;
 slot:string;
 slots:string[];
 loading:boolean;
 error:string;
 demo:boolean;
 onDateChange:(value:string)=>void;
 onSlotChange:(value:string)=>void;
 onRefresh:()=>void;
}){
 const dateFormatter=new Intl.DateTimeFormat('en-CA',{
  timeZone:p.zone,
  year:'numeric',
  month:'2-digit',
  day:'2-digit'
 });

 const today=dateFormatter.format(new Date());
 const maxDate=dateFormatter.format(new Date(Date.now()+60*86400000));

 const [month,setMonth]=useState((p.date||today).slice(0,7));
 const [availability,setAvailability]=useState<Record<string,number>>({});
 const [monthLoading,setMonthLoading]=useState(false);
 const [monthError,setMonthError]=useState('');
 const [period,setPeriod]=useState<Period>('morning');

 useEffect(()=>{
  if(p.date&&p.date.slice(0,7)!==month)
   setMonth(p.date.slice(0,7));
 },[p.date]);

 useEffect(()=>{
  let alive=true;

  setAvailability({});
  setMonthError('');

  if(!p.barberId||!p.serviceId)return;

  if(p.demo){
   const [year,monthNumber]=month.split('-').map(Number);
   const total=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
   const values:Record<string,number>={};

   for(let d=1;d<=total;d++){
    const key=`${month}-${String(d).padStart(2,'0')}`;
    if(key>=today&&key<=maxDate) values[key]=3;
   }

   setAvailability(values);
   return;
  }

  setMonthLoading(true);

  void api<Availability[]>(
   `/slots/month?barberId=${encodeURIComponent(p.barberId)}&serviceId=${encodeURIComponent(p.serviceId)}&monthStart=${month}-01`,
   p.shopId
  )
  .then(rows=>{
   if(!alive)return;
   setAvailability(
    Object.fromEntries(
     rows.map(row=>[row.day,Number(row.available_count)])
    )
   );
  })
  .catch(e=>{
   if(alive)setMonthError(e.message);
  })
  .finally(()=>{
   if(alive)setMonthLoading(false);
  });

  return()=>{alive=false};
 },[month,p.barberId,p.serviceId,p.shopId,p.demo]);

 const grouped=useMemo(()=>{
  const result:Record<Period,string[]>={
   morning:[],
   afternoon:[],
   night:[]
  };

  const formatter=new Intl.DateTimeFormat('pt-BR',{
   timeZone:p.zone,
   hour:'2-digit',
   hour12:false
  });

  for(const value of p.slots){
   const hour=Number(
    formatter.format(new Date(value)).replace(/\D/g,'')
   );

   if(hour<12)result.morning.push(value);
   else if(hour<18)result.afternoon.push(value);
   else result.night.push(value);
  }

  return result;
 },[p.slots,p.zone]);

 useEffect(()=>{
  if(grouped[period].length)return;

  const first=(['morning','afternoon','night'] as Period[])
   .find(key=>grouped[key].length);

  if(first)setPeriod(first);
 },[p.slots]);

 const [year,monthNumber]=month.split('-').map(Number);

 const lastDay=
  new Date(Date.UTC(year,monthNumber,0)).getUTCDate();

 const offset=
  (new Date(Date.UTC(year,monthNumber-1,1)).getUTCDay()+6)%7;

 const days=[
  ...Array(offset).fill(null),
  ...Array.from(
   {length:lastDay},
   (_,i)=>`${month}-${String(i+1).padStart(2,'0')}`
  )
 ];

 const clock=(value:string)=>
  new Date(value).toLocaleTimeString('pt-BR',{
   timeZone:p.zone,
   hour:'2-digit',
   minute:'2-digit'
  });

 const previous=moveMonth(month,-1);
 const next=moveMonth(month,1);

 return <section className="booking-calendar-shell">

  <div className="booking-calendar-head">

   <button
    type="button"
    className="icon-button"
    disabled={previous<today.slice(0,7)}
    onClick={()=>setMonth(previous)}
    aria-label="Mês anterior"
   >
    <ChevronLeft/>
   </button>

   <div>
    <span className="eyebrow">DATA DO AGENDAMENTO</span>
    <strong>{monthName(month)}</strong>
   </div>

   <button
    type="button"
    className="icon-button"
    disabled={next>maxDate.slice(0,7)}
    onClick={()=>setMonth(next)}
    aria-label="Próximo mês"
   >
    <ChevronRight/>
   </button>

  </div>

  <div className="booking-calendar-weekdays">
   {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
    .map(day=><span key={day}>{day}</span>)}
  </div>

  <div className="booking-calendar-grid">

   {days.map((key,index)=>{

    if(!key)
     return <span key={`blank-${index}`}/>;

    const disabled=
     key<today||
     key>maxDate||
     monthLoading;

    const available=
     Number(availability[key]??0)>0;

    return <button
     type="button"
     key={key}
     disabled={disabled}
     className={
      `${p.date===key?'selected ':''}`+
      `${available?'available':'full'}`
     }
     onClick={()=>p.onDateChange(key)}
    >

     <strong>{Number(key.slice(-2))}</strong>

     {!disabled&&<i aria-hidden="true"/>}

    </button>;

   })}

  </div>

  <div className="calendar-legend">
   <span><i className="available"/>Tem horário</span>
   <span><i className="full"/>Lotado</span>

   {monthLoading&&
    <small>Atualizando disponibilidade…</small>}
  </div>

  {monthError&&
   <p className="booking-calendar-warning">
    Não foi possível carregar os indicadores do mês.
   </p>}

  <div className="booking-time-section">

   <div>
    <span className="eyebrow">HORÁRIOS DISPONÍVEIS</span>
    <h3>Escolha o melhor horário</h3>
   </div>

   <div className="booking-period-tabs">

    {(['morning','afternoon','night'] as Period[])
     .map(key=>
      <button
       type="button"
       key={key}
       disabled={!grouped[key].length}
       className={period===key?'selected':''}
       onClick={()=>setPeriod(key)}
      >
       {labels[key]}
       <small>{grouped[key].length||'—'}</small>
      </button>
     )}

   </div>

   <div className="booking-hour-grid">

    {p.loading?

     <p role="status">Buscando horários…</p>

     :grouped[period].length?

     grouped[period].map(value=>
      <button
       type="button"
       key={value}
       className={p.slot===value?'selected':''}
       onClick={()=>p.onSlotChange(value)}
      >
       {clock(value)}
      </button>
     )

     :

     <div className="booking-no-slots">
      <Clock3 size={21}/>
      <strong>Nenhum horário neste período</strong>
      <small>
       Escolha outro período, dia ou profissional.
      </small>
     </div>

    }

   </div>

   {!p.loading&&!p.slots.length&&!p.error&&
    <p className="booking-calendar-empty">
     Este dia não possui horários livres.
    </p>}

   {p.error&&
    <p className="notice" role="alert">{p.error}</p>}

   <button
    type="button"
    className="text-button"
    disabled={p.loading}
    onClick={p.onRefresh}
   >
    Atualizar horários
   </button>

  </div>

 </section>;
}