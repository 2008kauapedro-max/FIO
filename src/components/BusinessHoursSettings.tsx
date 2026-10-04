import {useEffect,useState} from 'react';
import {Clock3} from 'lucide-react';
import {api} from '../lib/api';
import {useI18n} from '../i18n';
import type {WorkspaceProps} from '../pages/Workspace';

type Day={
 weekday:number;
 labelKey:string;
 enabled:boolean;
 opensAt:string;
 closesAt:string;
};

type Snapshot={
 hours:{weekday:number;opens_at:string;closes_at:string}[];
};

const defaults:Day[]=[
 {weekday:1,labelKey:'onboarding.dayMon',enabled:true,opensAt:'09:00',closesAt:'19:00'},
 {weekday:2,labelKey:'onboarding.dayTue',enabled:true,opensAt:'09:00',closesAt:'19:00'},
 {weekday:3,labelKey:'onboarding.dayWed',enabled:true,opensAt:'09:00',closesAt:'19:00'},
 {weekday:4,labelKey:'onboarding.dayThu',enabled:true,opensAt:'09:00',closesAt:'19:00'},
 {weekday:5,labelKey:'onboarding.dayFri',enabled:true,opensAt:'09:00',closesAt:'19:00'},
 {weekday:6,labelKey:'onboarding.daySat',enabled:true,opensAt:'09:00',closesAt:'19:00'},
 {weekday:0,labelKey:'onboarding.daySun',enabled:false,opensAt:'09:00',closesAt:'19:00'}
];

export function BusinessHoursSettings(p:WorkspaceProps){
 const {t}=useI18n();
 const [days,setDays]=useState<Day[]>(defaults);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  setLoading(true);
  setError('');

  void api<Snapshot>(
   '/onboarding/progress',
   p.data.shop.id
  ).then(snapshot=>{
   if(!active)return;

   setDays(defaults.map(day=>{
    const saved=snapshot.hours.find(hour=>hour.weekday===day.weekday);
    return saved
     ?{
       ...day,
       enabled:true,
       opensAt:saved.opens_at.slice(0,5),
       closesAt:saved.closes_at.slice(0,5)
      }
     :{...day,enabled:false};
   }));
  }).catch(e=>{
   if(active)setError((e as Error).message);
  }).finally(()=>{
   if(active)setLoading(false);
  });

  return()=>{active=false};
 },[p.data.shop.id]);

 const valid=
  days.some(day=>day.enabled)&&
  days.filter(day=>day.enabled).every(day=>day.opensAt<day.closesAt);

 async function save(){
  if(!valid){
   setError(t('settings.hoursInvalid'));
   return;
  }

  setBusy(true);
  setError('');

  try{
   await api(
    '/onboarding/hours',
    p.data.shop.id,
    {
     days:days.map(day=>({
      weekday:day.weekday,
      enabled:day.enabled,
      opensAt:day.opensAt,
      closesAt:day.closesAt
     }))
    }
   );

   p.notify(t('settings.hoursSaved'));
  }catch(e){
   setError((e as Error).message);
  }finally{
   setBusy(false);
  }
 }

 if(loading)
  return <section className="settings-card business-hours-settings"><p role="status">{t('ui.loading')}</p></section>;

 return <section className="settings-card business-hours-settings">
  <div className="section-title">
   <div>
    <h2>{t('settings.businessHours')}</h2>
    <span className="muted">{t('onboarding.hoursDesc')}</span>
   </div>
   <Clock3 size={20}/>
  </div>

  {error&&<p className="notice" role="alert">{error}</p>}

  <div className="business-hours-list">
   {days.map(day=>
    <article className={day.enabled?'business-hours-row is-open':'business-hours-row'} key={day.weekday}>
     <button
      type="button"
      className="business-hours-toggle"
      aria-pressed={day.enabled}
      onClick={()=>setDays(current=>current.map(item=>
       item.weekday===day.weekday?{...item,enabled:!item.enabled}:item
      ))}
     >
      <span>
       <strong>{t(day.labelKey)}</strong>
       <small>{day.enabled?t('onboarding.open'):t('onboarding.closed')}</small>
      </span>
      <b>{day.enabled?t('onboarding.open'):t('onboarding.closed')}</b>
     </button>

     {day.enabled&&
      <div className="business-hours-times">
       <label>
        <span>{t('onboarding.opensAt')}</span>
        <input
         type="time"
         value={day.opensAt}
         onChange={e=>setDays(current=>current.map(item=>
          item.weekday===day.weekday?{...item,opensAt:e.target.value}:item
         ))}
        />
       </label>
       <label>
        <span>{t('onboarding.closesAt')}</span>
        <input
         type="time"
         value={day.closesAt}
         onChange={e=>setDays(current=>current.map(item=>
          item.weekday===day.weekday?{...item,closesAt:e.target.value}:item
         ))}
        />
       </label>
      </div>
     }
    </article>
   )}
  </div>

  <button className="primary full" type="button" disabled={busy||!valid} onClick={()=>void save()}>
   {busy?t('settings.saving'):t('settings.saveHours')}
  </button>
 </section>;
}
