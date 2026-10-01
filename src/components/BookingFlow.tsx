import {useEffect,useState} from 'react';
import type {Appointment} from '../../shared/domain';
import type {WorkspaceProps} from '../pages/Workspace';
import {dayKey} from '../pages/Workspace';
import {money} from '../../shared/domain';
import {api} from '../lib/api';
import {Field,Modal} from './ui';

export function BookingFlow(p:WorkspaceProps&{onClose:()=>void;appointment?:Appointment}){
 const {data,appointment:a}=p,zone=data.shop.timezone;
 const services=data.services.filter(s=>s.active),solo=data.shop.operation_mode==='SOLO',role=data.membership.role,isClient=role==='CLIENT',barbers=data.team.filter(t=>t.active&&(t.role==='BARBER'||(solo&&t.role==='OWNER'))&&(role!=='BARBER'||t.user_id===data.membership.user_id));
 const lockedProvider=role==='BARBER'||barbers.length===1;
 const defaultBarber=a?.barber_id??(role==='BARBER'?data.membership.user_id:barbers.length===1?(barbers[0]?.user_id??'any'):'any');
 const firstStep=lockedProvider?1:0;
 const [step,setStep]=useState(a?2:firstStep),[barber,setBarber]=useState(defaultBarber);
 const [service,setService]=useState(a?.service_id??services[0]?.id??''),[client,setClient]=useState(a?.client_id??data.customers.find(c=>c.user_id===data.membership.user_id)?.id??data.customers[0]?.id??'');
 const [date,setDate]=useState(dayKey(new Date().toISOString(),zone)),[slot,setSlot]=useState(''),[slots,setSlots]=useState<string[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[useSubscription,setUseSubscription]=useState(false);
 const svc=services.find(s=>s.id===service),sub=data.subscriptions.find(s=>(!s.client_id||s.client_id===client)&&s.status==='active'&&new Date(s.expires_at)>new Date(slot||Date.now())&&s.remaining_cuts>0);
 const clock=(v:string)=>new Date(v).toLocaleTimeString('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
 useEffect(()=>{
  let alive=true;setSlot('');setSlots([]);setLoading(true);setError('');
  if(!service||!barber||!date){setLoading(false);return;}
  const request=p.demo?Promise.resolve(['09:00','10:00','14:00','15:00'].map(t=>({starts_at:new Date(`${date}T${t}:00-03:00`).toISOString()})).filter(x=>Date.parse(x.starts_at)>Date.now())):api<{starts_at:string}[]>(`/slots?barberId=${barber}&serviceId=${service}&day=${date}`,data.shop.id);
  void request.then(rows=>{if(alive)setSlots(rows.map(r=>r.starts_at));}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};
 },[barber,service,date,revision,p.demo,data.shop.id]);
 async function confirm(){
  if(!slot||!svc||!client||busy)return;setBusy(true);setError('');
  try{
   let assigned=barber==='any'?barbers[0]?.user_id:barber;
   if(p.demo){if(!assigned)throw Error('Nenhum profissional disponível.');p.updateDemo(d=>({...d,appointments:a?d.appointments.map(x=>x.id===a.id?{...x,starts_at:slot,ends_at:new Date(Date.parse(slot)+svc.duration_minutes*60000).toISOString()}:x):[...d.appointments,{id:crypto.randomUUID(),client_id:client,barber_id:assigned!,service_id:service,starts_at:slot,ends_at:new Date(Date.parse(slot)+svc.duration_minutes*60000).toISOString(),status:'scheduled',price_cents:svc.price_cents,subscription_id:useSubscription?sub?.id:null}]}));}
   else if(a)await api(`/appointments/${a.id}/reschedule`,data.shop.id,{startsAt:slot,confirmed:true});
   else {const result=await api<{id:string;barberId:string}>('/appointments',data.shop.id,{barberId:barber==='any'?null:barber,serviceId:service,clientId:client,startsAt:slot,useSubscription});assigned=result.barberId;}
   // A successful mutation must not be presented as failed if only refreshing fails.
   if(!p.demo)await p.refresh().catch(()=>undefined);
   p.notify(`${p.demo?'Demonstração: ':''}${a?'Horário remarcado':'Agendamento criado'} com ${data.team.find(t=>t.user_id===assigned)?.display_name??'o profissional atribuído'}.`);p.onClose();
  }catch(e){setError((e as Error).message);setSlot('');setStep(2);}finally{setBusy(false);}
 }
 return <Modal title={a?(isClient?'Remarcar horário':'Remarcar atendimento'):(isClient?'Agendar horário':'Novo atendimento')} onClose={()=>{if(!busy)p.onClose();}}><div className="booking-flow">
  <ol className="booking-steps" aria-label="Etapas">{['Profissional','Serviço','Horário','Revisão'].map((label,i)=>lockedProvider&&i===0?null:<li key={label} aria-current={step===i?'step':undefined} className={step===i?'active':''}><span>{lockedProvider?i:i+1}</span>{label}</li>)}</ol>
  {p.demo&&<p className="muted">Demonstração com horários simulados.</p>}
  {step===0&&<><h3>Com quem você quer agendar?</h3><div className="booking-options">{data.membership.role!=='BARBER'&&barbers.length>1&&<button className={barber==='any'?'selected':''} onClick={()=>setBarber('any')} aria-pressed={barber==='any'}><span className="avatar">↗</span><span><strong>Sem preferência</strong><small>Um profissional disponível será atribuído na confirmação.</small></span></button>}{barbers.map(b=><button key={b.user_id} className={barber===b.user_id?'selected':''} onClick={()=>setBarber(b.user_id)} aria-pressed={barber===b.user_id}><span className="avatar">{b.avatar_url?<img src={b.avatar_url} alt=""/>:b.display_name.slice(0,2)}</span><span><strong>{b.display_name}</strong><small>{solo?'Profissional':'Profissional da barbearia'}</small></span></button>)}</div></>}
  {step===1&&<><h3>{isClient?'Escolha o serviço':'Cliente e serviço'}</h3><div className="booking-options">{services.map(s=><button key={s.id} className={service===s.id?'selected':''} onClick={()=>setService(s.id)} aria-pressed={service===s.id}><span><strong>{s.name}</strong><small>{s.duration_minutes} min · {money(s.price_cents)}</small>{s.description&&<small>{s.description}</small>}</span></button>)}</div>{data.membership.role!=='CLIENT'&&<Field label="Cliente"><select value={client} onChange={e=>{setClient(e.target.value);setUseSubscription(false);}}>{data.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}{!client&&<p role="alert">Cadastre um cliente antes de agendar.</p>}</>}
  {step===2&&<><h3>Dia e horário</h3><Field label="Data"><input type="date" value={date} min={dayKey(new Date().toISOString(),zone)} max={dayKey(new Date(Date.now()+60*86400000).toISOString(),zone)} onChange={e=>setDate(e.target.value)}/></Field><p className="muted">Horários de {data.shop.name} · {zone}</p><div className="slot-grid" aria-label="Horários disponíveis">{loading?<p role="status">Buscando horários…</p>:slots.map(s=><button key={s} className={slot===s?'selected':''} aria-pressed={slot===s} onClick={()=>setSlot(s)}>{clock(s)}</button>)}</div>{!loading&&!slots.length&&!error&&<p role="status">Nenhum horário disponível. Experimente outra data.</p>}<button className="text-button" disabled={loading} onClick={()=>setRevision(r=>r+1)}>Atualizar horários</button></>}
  {step===3&&<section className="booking-summary"><h3>Confira seu agendamento</h3><dl><dt>Barbearia</dt><dd>{data.shop.public_title||data.shop.name}</dd><dt>Profissional</dt><dd>{barber==='any'?'Sem preferência — atribuído ao confirmar':data.team.find(b=>b.user_id===barber)?.display_name}</dd><dt>Serviço</dt><dd>{svc?.name} · {svc?.duration_minutes} min</dd><dt>Horário</dt><dd>{new Date(slot).toLocaleDateString('pt-BR',{timeZone:zone})} às {clock(slot)}</dd></dl>{!a&&sub&&<label className="check-row"><input type="checkbox" checked={useSubscription} onChange={e=>setUseSubscription(e.target.checked)}/>Usar benefício de {sub.name} ({sub.remaining_cuts} restantes)</label>}<p className="muted">O FIO não processa pagamentos por este atendimento.</p></section>}
  {error&&<p className="notice" role="alert">{error} Escolha um horário disponível para tentar novamente.</p>}
  <div className="booking-footer">{step>(a?2:firstStep)&&<button className="secondary" disabled={busy} onClick={()=>setStep(s=>s-1)}>Voltar</button>}{step<3?<button className="primary" disabled={loading&&step===2||step===0&&!barber||step===1&&(!service||!client)||step===2&&!slot} onClick={()=>setStep(s=>s+1)}>Continuar</button>:<button className="primary" disabled={busy||!slot} onClick={()=>void confirm()}>{busy?'Confirmando…':a?'Confirmar remarcação':'Confirmar agendamento'}</button>}</div>
 </div></Modal>;
}
