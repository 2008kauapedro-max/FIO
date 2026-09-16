import { useState,useEffect,type FormEvent,type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight,ArrowLeft,Plus,Scissors,Clock3,Users,CalendarDays,Check,Search,Copy,SlidersHorizontal,MessageCircle,Star,Link as LinkIcon,Download,X,Share2,SquarePlus,UserRound,Store,ShieldCheck,KeyRound,LogOut,Palette,Eye,EyeOff } from 'lucide-react';
import type { Bootstrap,Appointment,Service } from '../../shared/domain';
import { money } from '../../shared/domain';
import { api,supabase } from '../lib/api';
import { Empty,Field,Modal,PageTitle,ArrowLink } from '../components/ui';
export interface WorkspaceProps {data:Bootstrap;demo:boolean;base:string;refresh:()=>Promise<void>;notify:(text:string)=>void;updateDemo:(fn:(d:Bootstrap)=>Bootstrap)=>void;canInstall?:boolean;installApp?:()=>Promise<void>}
const time=(date:string,zone:string)=>new Date(date).toLocaleTimeString('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
const whats=(phone?:string|null)=>{const digits=(phone??'').replace(/\D/g,'');if(!digits)return '';return `https://wa.me/${digits.startsWith('55')?digits:`55${digits}`}`;};
export const dayKey=(date:string,zone:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export function Dashboard(p:WorkspaceProps){
 const {data,base}=p,role=data.membership.role,navigate=useNavigate(),today=dayKey(new Date().toISOString(),data.shop.timezone);
 const appointments=data.appointments.filter(a=>dayKey(a.starts_at,data.shop.timezone)===today&&a.status!=='cancelled');
 const next=(role==='CLIENT'?data.appointments:appointments).filter(a=>a.status==='scheduled'&&(role!=='CLIENT'||new Date(a.ends_at)>new Date())).slice(0,4),done=appointments.filter(a=>a.status==='completed').length;
 return <><PageTitle eyebrow={new Date().toLocaleDateString('pt-BR',{timeZone:data.shop.timezone,weekday:'long',day:'numeric',month:'long'})} title={`Olá, ${data.membership.display_name.split(' ')[0]}.`} description={role==='OWNER'?'Um olhar claro sobre o seu dia.':role==='BARBER'?'Seu talento. Uma rotina mais leve.':'Seu momento de cuidar de você.'} action={<button className="primary" onClick={()=>navigate(`${base}/agenda?novo=1`)}><Plus size={18}/>{role==='CLIENT'?'Agendar horário':'Novo agendamento'}</button>}/>{role==='CLIENT'&&<ReviewPrompt {...p}/>}<section className="overview"><div className="overview-primary"><div className="section-kicker"><span>{role==='OWNER'?'RECEBIDO NESTA SEMANA':role==='BARBER'?'SUA AGENDA DE HOJE':'SEU PRÓXIMO ENCONTRO'}</span><ArrowUpRight size={20}/></div><strong className={role==='CLIENT'?'next-date':''}>{role==='OWNER'?money(data.revenue??0):role==='BARBER'?String(appointments.length).padStart(2,'0'):next[0]?time(next[0].starts_at,data.shop.timezone):'Vamos agendar?'}</strong><p>{role==='OWNER'?'Recebimentos registrados · segunda até hoje':role==='BARBER'?'atendimentos no seu ritmo':next[0]?data.services.find(s=>s.id===next[0].service_id)?.name:'Encontre um horário que combine com você.'}</p><div className="overview-line"/></div><div className="overview-stats"><div><span><CalendarDays size={17}/> {role==='CLIENT'?'Agendamentos hoje':'Na agenda hoje'}</span><strong>{String(appointments.length).padStart(2,'0')}</strong><small>Seu dia, organizado</small></div><div><span>{role==='CLIENT'?<Scissors size={17}/>:<Check size={17}/>} {role==='CLIENT'?'Cortes no plano':'Concluídos hoje'}</span><strong>{String(role==='CLIENT'?(data.subscriptions.find(s=>s.status==='active'&&new Date(s.expires_at)>new Date())?.remaining_cuts??0):done).padStart(2,'0')}</strong><small>{role==='CLIENT'?'No seu plano ativo':'Cada detalhe conta'}</small></div></div></section>{role==='CLIENT'&&<InstallNudge {...p}/>}<div className="dashboard-grid dashboard-grid-simple"><section><div className="section-title"><h2>Próximos atendimentos<span className="count">{next.length}</span></h2><ArrowLink onClick={()=>navigate(`${base}/agenda`)}>Ver agenda</ArrowLink></div>{next.length?<div className="appointment-list">{next.map(a=><AppointmentRow key={a.id} appointment={a} data={data} onClick={()=>navigate(`${base}/agenda`)}/>)}</div>:<Empty title="Seu dia tem espaço">Os próximos agendamentos aparecem aqui.</Empty>}</section></div><div className="quiet-footer"><span>O cuidado está nos detalhes.</span><span>FIO / {data.shop.name.toUpperCase()}</span></div></>;
}
function InstallNudge(p:WorkspaceProps){
 const key=`fio-install-dismissed:${p.data.shop.id}:${p.data.membership.user_id}`;
 const standalone=typeof window!=='undefined'&&(window.matchMedia?.('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
 const ios=typeof navigator!=='undefined'&&/iphone|ipad|ipod/i.test(navigator.userAgent);
 const [visible,setVisible]=useState(()=>!standalone&&localStorage.getItem(key)!=='1'),[guide,setGuide]=useState(false);
 if(!visible||standalone)return null;
 const install=async()=>{if(p.canInstall){await p.installApp?.();setVisible(false);return;}setGuide(true);};
 const dismiss=()=>{localStorage.setItem(key,'1');setVisible(false);};
 return <><section className="install-nudge"><div className="install-nudge-icon"><Download size={18}/></div><div><strong>Instale o app de {p.data.shop.public_title||p.data.shop.name}</strong><span>Acesse sua agenda direto pela tela inicial.</span></div><button className="install-nudge-action" onClick={()=>void install()}>{p.canInstall?'Instalar':ios?'Como instalar':'Instalar app'}</button><button className="install-nudge-close" aria-label="Fechar" onClick={dismiss}><X size={16}/></button></section>{guide&&<Modal title={ios?'Adicionar à Tela de Início':'Instalar aplicativo'} onClose={()=>setGuide(false)}><div className="install-guide">{ios?<><div><Share2 size={22}/><span><b>1.</b> Toque em <strong>Compartilhar</strong> no Safari.</span></div><div><SquarePlus size={22}/><span><b>2.</b> Escolha <strong>Adicionar à Tela de Início</strong>.</span></div><p className="muted">Depois confirme em “Adicionar”. O app abrirá sem a barra do navegador.</p></>:<><p>Abra o menu do navegador e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</p></>}</div></Modal>}</>;
}
function ReviewPrompt(p:WorkspaceProps){
 const completed=p.data.appointments.filter(a=>a.status==='completed'&&!p.data.reviews.some(r=>r.appointment_id===a.id));
 const [appointment,setAppointment]=useState<Appointment|null>(null),[rating,setRating]=useState(5),[comment,setComment]=useState(''),[busy,setBusy]=useState(false);
 const pending=completed[0];if(!pending)return null;
 const barber=p.data.team.find(t=>t.user_id===pending.barber_id)?.display_name??'seu profissional';
 async function submit(){if(!appointment)return;setBusy(true);try{if(p.demo){p.updateDemo(d=>({...d,reviews:[...d.reviews,{id:crypto.randomUUID(),appointment_id:appointment.id,client_id:appointment.client_id,barber_id:appointment.barber_id,rating,comment,created_at:new Date().toISOString()}]}));}else{await api('/reviews',p.data.shop.id,{appointmentId:appointment.id,rating,comment});await p.refresh();}setAppointment(null);setComment('');setRating(5);p.notify('Obrigado pela avaliação.');}catch(e){p.notify((e as Error).message);}finally{setBusy(false);}}
 return <><button className="review-prompt" onClick={()=>setAppointment(pending)}><div><span className="eyebrow">COMO FOI?</span><strong>Avalie seu atendimento com {barber.split(' ')[0]}</strong><small>Leva menos de 20 segundos.</small></div><div className="review-stars">★★★★★</div><ArrowUpRight size={18}/></button>{appointment&&<Modal title="Avalie seu atendimento" onClose={()=>setAppointment(null)}><div className="review-modal"><p className="muted">Sua avaliação vai para {barber} e ajuda a barbearia a melhorar.</p><div className="star-picker" aria-label="Nota">{[1,2,3,4,5].map(n=><button type="button" aria-label={`${n} estrela${n>1?'s':''}`} className={n<=rating?'selected':''} key={n} onClick={()=>setRating(n)}><Star size={30} fill={n<=rating?'currentColor':'none'}/></button>)}</div><Field label="Comentário (opcional)"><textarea maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Conte como foi sua experiência."/></Field><button className="primary full" disabled={busy} onClick={submit}>{busy?'Enviando…':'Enviar avaliação'}</button></div></Modal>}</>;
}
function AppointmentRow({appointment:a,data,onClick}:{appointment:Appointment;data:Bootstrap;onClick:()=>void}){const name=data.customers.find(c=>c.id===a.client_id)?.name??'Atendimento';return <button className="appointment-row" onClick={onClick}><div className="appointment-time">{time(a.starts_at,data.shop.timezone)}<small>{time(a.ends_at,data.shop.timezone)}</small></div><span className="avatar">{name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div className="appointment-info"><strong>{name}</strong><span>{data.services.find(s=>s.id===a.service_id)?.name??'Serviço'} <i>·</i> {data.team.find(t=>t.user_id===a.barber_id)?.display_name.split(' ')[0]}</span></div><span className={`status ${a.status}`}>{{scheduled:'Agendado',confirmed:'Confirmado',in_service:'Em atendimento',completed:'Concluído',cancelled:'Cancelado',no_show:'Faltou'}[a.status]}</span><ArrowUpRight size={16}/></button>;}
export function Agenda(p:WorkspaceProps){
 const {data}=p,zone=data.shop.timezone; const [date,setDate]=useState(dayKey(new Date().toISOString(),zone)),[booking,setBooking]=useState(new URLSearchParams(location.search).has('novo')),[selected,setSelected]=useState<Appointment|null>(null),[busy,setBusy]=useState(false);
 const appointments=data.appointments.filter(a=>dayKey(a.starts_at,zone)===date);
 async function transition(status:'confirmed'|'in_service'|'completed'|'cancelled'|'no_show'){
  if(!selected)return; setBusy(true);
  try{if(p.demo){p.updateDemo(d=>({...d,appointments:d.appointments.map(a=>a.id===selected.id?{...a,status}:a)}));}else{await api(`/appointments/${selected.id}`,data.shop.id,{status,confirmed:true},'PATCH');await p.refresh();} setSelected(null);p.notify({confirmed:'Atendimento confirmado.',in_service:'Atendimento iniciado.',completed:'Atendimento concluído.',cancelled:'Agendamento cancelado.',no_show:'Falta registrada.'}[status]);}
  catch(e){p.notify((e as Error).message);}finally{setBusy(false);}
 }
 const staff=data.membership.role!=='CLIENT';
 return <><PageTitle eyebrow="CADA HORÁRIO IMPORTA" title={data.membership.role==='OWNER'?'Agenda':'Minha agenda'} description="Seu tempo, bem cuidado." action={<button className="primary" onClick={()=>setBooking(true)}><Plus size={18}/>Agendar horário</button>}/><div className="agenda-controls"><Field label="Dia da agenda"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><span className="muted">{appointments.length} atendimento{appointments.length!==1?'s':''} · {zone}</span></div>{appointments.length?<div className="appointment-list">{appointments.map(a=><AppointmentRow key={a.id} appointment={a} data={data} onClick={()=>setSelected(a)}/>)}</div>:<Empty title="Um espaço livre no seu dia">Escolha outra data ou crie um agendamento.</Empty>}{booking&&<BookingModal {...p} onClose={()=>setBooking(false)}/>} {selected&&<Modal title="Detalhes do atendimento" onClose={()=>setSelected(null)}><div className="detail-summary"><h3>{data.customers.find(c=>c.id===selected.client_id)?.name}</h3><p>{data.services.find(s=>s.id===selected.service_id)?.name}</p><p>{new Date(selected.starts_at).toLocaleDateString('pt-BR',{timeZone:zone})} · {time(selected.starts_at,zone)} — {time(selected.ends_at,zone)}</p><p>{selected.subscription_id?'Coberto por assinatura':money(selected.price_cents)}</p></div><p className="muted">Status: {selected.status.replace('_',' ')}.</p><div className="modal-actions">{['scheduled','confirmed'].includes(selected.status)&&<button className="danger" disabled={busy} onClick={()=>transition('cancelled')}>Cancelar</button>}{staff&&selected.status==='scheduled'&&<button className="primary" disabled={busy} onClick={()=>transition('confirmed')}>Confirmar</button>}{staff&&['scheduled','confirmed'].includes(selected.status)&&<button className="primary" disabled={busy} onClick={()=>transition('in_service')}>Iniciar</button>}{staff&&selected.status==='in_service'&&<button className="primary" disabled={busy} onClick={()=>transition('completed')}>Concluir</button>}{staff&&['scheduled','confirmed'].includes(selected.status)&&new Date(selected.starts_at)<=new Date()&&<button className="secondary" disabled={busy} onClick={()=>transition('no_show')}>Registrar falta</button>}</div></Modal>}</>;
}
function BookingModal(p:WorkspaceProps&{onClose:()=>void}){
 const {data}=p,services=data.services.filter(s=>s.active),barbers=data.team.filter(t=>t.role==='BARBER'&&(data.membership.role!=='BARBER'||t.user_id===data.membership.user_id));
 const [serviceId,setServiceId]=useState(services[0]?.id??''),[barberId,setBarberId]=useState(barbers[0]?.user_id??''),[clientId,setClientId]=useState(data.customers[0]?.id??''),[date,setDate]=useState(dayKey(new Date().toISOString(),data.shop.timezone)),[slots,setSlots]=useState<string[]>([]),[slot,setSlot]=useState(''),[useSubscription,setUseSubscription]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loadingSlots,setLoadingSlots]=useState(false);
 const activeSub=data.subscriptions.find(s=>(!s.client_id||s.client_id===clientId)&&s.status==='active'&&new Date(s.expires_at)>new Date()&&s.remaining_cuts>0);
 useEffect(()=>{let active=true;setSlot('');setSlots([]);setError('');if(!serviceId||!barberId||!date)return;setLoadingSlots(true);if(p.demo){const values=['09:00','10:30','11:45','14:00','15:30','17:00'].map(t=>new Date(`${date}T${t}:00-03:00`).toISOString()).filter(x=>new Date(x)>new Date());setSlots(values);setLoadingSlots(false);return;}api<{starts_at:string}[]>(`/slots?barberId=${barberId}&serviceId=${serviceId}&day=${date}`,data.shop.id).then(v=>{if(active)setSlots(v.map(x=>x.starts_at));}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoadingSlots(false);});return()=>{active=false;};},[serviceId,barberId,date,p.demo,data.shop.id]);
 async function submit(e:FormEvent){e.preventDefault();if(!slot)return;setBusy(true);setError('');try{if(p.demo){const svc=services.find(s=>s.id===serviceId)!;p.updateDemo(d=>({...d,appointments:[...d.appointments,{id:crypto.randomUUID(),client_id:clientId,barber_id:barberId,service_id:serviceId,starts_at:slot,ends_at:new Date(+new Date(slot)+svc.duration_minutes*60000).toISOString(),price_cents:svc.price_cents,status:'scheduled' as const,subscription_id:useSubscription?activeSub?.id:null,payment_method:useSubscription?'subscription' as const:'pending' as const}].sort((a,b)=>a.starts_at.localeCompare(b.starts_at))}));}else{await api('/appointments',data.shop.id,{serviceId,barberId,clientId,startsAt:slot,useSubscription});await p.refresh();}p.notify('Agendamento criado.');p.onClose();}catch(e){setError((e as Error).message);setSlot('');}finally{setBusy(false);}}
 return <Modal title="Agendar horário" onClose={p.onClose}><form onSubmit={submit}><Field label="Cliente"><select value={clientId} onChange={e=>{setClientId(e.target.value);setUseSubscription(false);}}>{data.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Profissional"><select value={barberId} onChange={e=>setBarberId(e.target.value)}>{barbers.map(b=><option key={b.user_id} value={b.user_id}>{b.display_name}</option>)}</select></Field><Field label="Serviço"><select value={serviceId} onChange={e=>setServiceId(e.target.value)}>{services.map(s=><option key={s.id} value={s.id}>{s.name} · {money(s.price_cents)}</option>)}</select></Field><Field label="Data"><input type="date" min={dayKey(new Date().toISOString(),data.shop.timezone)} value={date} onChange={e=>setDate(e.target.value)}/></Field>{activeSub&&<label className="check-row"><input type="checkbox" checked={useSubscription} onChange={e=>setUseSubscription(e.target.checked)}/><span>Usar 1 corte da assinatura “{activeSub.name}” ({activeSub.remaining_cuts} restantes)</span></label>}<div className="slot-grid">{loadingSlots?<span className="muted">Buscando horários…</span>:slots.map(x=><button type="button" className={slot===x?'selected':''} key={x} onClick={()=>setSlot(x)}>{time(x,data.shop.timezone)}</button>)}</div>{error&&<p className="notice" role="alert">{error}</p>}<button className="primary full" disabled={busy||!slot}>Confirmar agendamento</button></form></Modal>;
}
export function Services(p:WorkspaceProps){const {data}=p,[modal,setModal]=useState(false),[editing,setEditing]=useState<Service|null>(null),[name,setName]=useState(''),[price,setPrice]=useState('65'),[duration,setDuration]=useState('45'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');const values={name,duration_minutes:Number(duration),price_cents:Math.round(Number(price)*100)};try{if(p.demo){p.updateDemo(d=>({...d,services:editing?d.services.map(s=>s.id===editing.id?{...s,...values}:s):[...d.services,{...values,id:crypto.randomUUID(),active:true}]}));}else{await api(editing?`/services/${editing.id}`:'/services',data.shop.id,values,editing?'PATCH':'POST');await p.refresh();}setModal(false);p.notify('Serviço salvo.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <><PageTitle eyebrow="A ARTE DO CUIDADO" title="Serviços" description="Detalhes que fazem a diferença." action={data.membership.role==='OWNER'&&<button className="primary" onClick={()=>{setEditing(null);setName('');setPrice('65');setDuration('45');setModal(true);}}><Plus size={18}/>Novo serviço</button>}/>{data.services.length?<div className="service-list">{data.services.filter(s=>s.active).map((s,i)=><div className="service-row" key={s.id}><span className="service-number">{String(i+1).padStart(2,'0')}</span><div className="service-name"><h2>{s.name}</h2><span><Clock3 size={14}/>{s.duration_minutes} minutos</span></div><strong>{money(s.price_cents)}</strong>{data.membership.role==='OWNER'&&<button className="icon-button" aria-label={`Editar ${s.name}`} onClick={()=>{setEditing(s);setName(s.name);setPrice(String(s.price_cents/100));setDuration(String(s.duration_minutes));setModal(true);}}><SlidersHorizontal size={18}/></button>}</div>)}</div>:<Empty title="Seu catálogo começa aqui">Adicione o primeiro serviço.</Empty>}{modal&&<Modal title={editing?'Editar serviço':'Novo serviço'} onClose={()=>setModal(false)}><form onSubmit={submit}><Field label="Nome"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field><div className="form-grid"><Field label="Valor (R$)"><input required type="number" min="0" max="10000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></Field><Field label="Duração (minutos)"><input required type="number" min="10" max="240" value={duration} onChange={e=>setDuration(e.target.value)}/></Field></div>{error&&<p className="notice" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Salvando…':'Salvar serviço'}</button></form></Modal>}</>;
}
export function Customers(p:WorkspaceProps){
 const [search,setSearch]=useState(''),[modal,setModal]=useState(false),[selected,setSelected]=useState<(typeof p.data.customers)[number]|null>(null),[name,setName]=useState(''),[phone,setPhone]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{if(p.demo)p.updateDemo(d=>({...d,customers:[...d.customers,{id:crypto.randomUUID(),name,phone,user_id:null}]}));else{await api('/customers',p.data.shop.id,{name,phone:phone||undefined});await p.refresh();}setModal(false);setName('');setPhone('');p.notify('Cliente cadastrado.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const customers=p.data.customers.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||(c.phone??'').includes(search));
 return <><PageTitle eyebrow="CONEXÕES QUE CONTINUAM" title={p.data.membership.role==='OWNER'?'Clientes':'Meus clientes'} description="Cada pessoa tem sua história." action={p.data.membership.role==='OWNER'&&<button className="primary" onClick={()=>setModal(true)}><Plus size={18}/>Novo cliente</button>}/><label className="search-input"><Search size={18}/><input aria-label="Buscar cliente" placeholder="Buscar por nome ou telefone" value={search} onChange={e=>setSearch(e.target.value)}/></label>{customers.length?<div className="people-list">{customers.map(c=><button key={c.id} className="person-row person-button" onClick={()=>setSelected(c)}><span className="avatar">{c.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><h3>{c.name}</h3><p>{c.phone|| (c.user_id?'Conta conectada':'Cadastro da barbearia')}</p></div><span className="muted">{p.data.appointments.filter(a=>a.client_id===c.id&&a.status==='completed').length} atend.</span></button>)}</div>:<Empty title="Nenhum cliente encontrado">{search?'Tente outro nome.':'Seus clientes aparecerão aqui.'}</Empty>}{selected&&<Modal title="Perfil do cliente" onClose={()=>setSelected(null)}><div className="profile-detail"><span className="avatar profile-avatar">{selected.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><h3>{selected.name}</h3><p className="muted">{selected.phone||'Telefone ainda não cadastrado.'}</p><div className="profile-stats"><div><strong>{p.data.appointments.filter(a=>a.client_id===selected.id&&a.status==='completed').length}</strong><span>atendimentos</span></div><div><strong>{p.data.subscriptions.find(x=>x.client_id===selected.id&&x.status==='active')?.remaining_cuts??0}</strong><span>cortes no plano</span></div></div>{selected.phone&&<a className="primary full whatsapp-button" href={whats(selected.phone)} target="_blank" rel="noreferrer"><MessageCircle size={18}/>Chamar no WhatsApp</a>}</div></Modal>}{modal&&<Modal title="Novo cliente" onClose={()=>setModal(false)}><form onSubmit={submit}><Field label="Nome do cliente"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="WhatsApp / telefone"><input type="tel" inputMode="tel" minLength={8} maxLength={24} placeholder="(61) 99999-9999" value={phone} onChange={e=>setPhone(e.target.value)}/></Field>{error&&<p role="alert" className="notice">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Salvando…':'Salvar cliente'}</button></form></Modal>}</>;
}
export function Team(p:WorkspaceProps){
 const owner=p.data.membership.role==='OWNER';
 const [modal,setModal]=useState(false),[selected,setSelected]=useState<(typeof p.data.team)[number]|null>(null),[name,setName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function createStaff(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('/staff',p.data.shop.id,{name,email,phone,temporaryPassword:password});await p.refresh();setModal(false);setName('');setEmail('');setPhone('');setPassword('');p.notify('Acesso do profissional criado.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const people=p.data.team.filter(m=>m.role!=='CLIENT');
 return <><PageTitle eyebrow="PROFISSIONAIS" title={p.data.membership.role==='CLIENT'?'Quem cuida de você':'Equipe'} description={p.data.membership.role==='CLIENT'?'Veja os profissionais e fale com a barbearia quando precisar.':'Contatos e desempenho da equipe.'} action={owner?<button className="primary" onClick={()=>setModal(true)}><Plus size={18}/>Adicionar profissional</button>:undefined}/><div className="people-list">{people.map(m=>{const reviews=p.data.reviews.filter(r=>r.barber_id===m.user_id),avg=reviews.length?reviews.reduce((a,b)=>a+b.rating,0)/reviews.length:0;return <button className="person-row person-button" key={m.user_id} onClick={()=>setSelected(m)}><span className="avatar">{m.display_name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><h3>{m.display_name}</h3><p>{m.role==='OWNER'?'Responsável pela barbearia':m.phone||'Profissional'}</p></div>{m.role==='BARBER'&&reviews.length>0?<span className="rating-chip"><Star size={14} fill="currentColor"/>{avg.toFixed(1)} · {reviews.length}</span>:<span className="status">{m.role==='OWNER'?'Responsável':'Ativo'}</span>}</button>})}</div>{selected&&<Modal title="Contato" onClose={()=>setSelected(null)}><div className="profile-detail"><span className="avatar profile-avatar">{selected.display_name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><h3>{selected.display_name}</h3><p className="muted">{selected.role==='OWNER'?'Responsável pela barbearia':'Profissional da equipe'}</p><p>{selected.phone||'Telefone ainda não cadastrado.'}</p>{selected.phone&&<a className="primary full whatsapp-button" href={whats(selected.phone)} target="_blank" rel="noreferrer"><MessageCircle size={18}/>Chamar no WhatsApp</a>}</div></Modal>}{owner&&modal&&<Modal title="Novo profissional" onClose={()=>setModal(false)}><form onSubmit={createStaff}><p className="muted compact-copy">Crie o acesso e entregue ao profissional. A senha não fica salva pelo FIO.</p><Field label="Nome"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="E-mail"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="WhatsApp / telefone"><input type="tel" inputMode="tel" required minLength={8} maxLength={24} value={phone} onChange={e=>setPhone(e.target.value)}/></Field><Field label="Senha inicial"><input type="password" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></Field>{error&&<p role="alert" className="notice">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Criando acesso…':'Criar acesso'}</button></form></Modal>}</>;
}
export function Subscriptions(p:WorkspaceProps){const [modal,setModal]=useState(false),[clientId,setClientId]=useState(p.data.customers[0]?.id??''),[name,setName]=useState('Essencial'),[cuts,setCuts]=useState('4'),[expires,setExpires]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const expiresAt=new Date(`${expires}T23:59:59-03:00`).toISOString();if(p.demo)p.updateDemo(d=>({...d,subscriptions:[...d.subscriptions,{id:crypto.randomUUID(),name,remaining_cuts:Number(cuts),expires_at:expiresAt,status:'active'}]}));else{await api('/subscriptions',p.data.shop.id,{clientId,name,cuts:Number(cuts),expiresAt,confirmed:true});await p.refresh();}setModal(false);p.notify('Plano de cortes registrado.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <><PageTitle eyebrow="CUIDADO QUE CONTINUA" title={p.data.membership.role==='CLIENT'?'Minha assinatura':'Assinaturas'} description="Mais frequência. Sempre o mesmo cuidado." action={p.data.membership.role==='OWNER'&&<button className="primary" onClick={()=>setModal(true)}><Plus size={18}/>Registrar plano de cortes</button>}/>{p.data.subscriptions.length?<div className="subscription-grid">{p.data.subscriptions.map(s=><article key={s.id} className="subscription-card"><span className="eyebrow">PLANO DE CORTES</span><h2>{s.name}</h2>{p.data.membership.role==="OWNER"&&s.client_id&&<p>{p.data.customers.find(c=>c.id===s.client_id)?.name??"Cliente"}</p>}<strong>{s.remaining_cuts}<span> cortes restantes</span></strong><p>Validade: {new Date(s.expires_at).toLocaleDateString('pt-BR',{timeZone:p.data.shop.timezone})}</p><span className="status">{s.status==='active'&&new Date(s.expires_at)>new Date()?'Ativo':'Inativo ou vencido'}</span></article>)}</div>:<Empty title="Nenhuma assinatura por aqui">{p.data.membership.role==='CLIENT'?'Converse com sua barbearia para conhecer os planos.':'Registre o primeiro plano de cortes.'}</Empty>}{modal&&<Modal title="Registrar plano de cortes" onClose={()=>setModal(false)}><form onSubmit={submit}><Field label="Cliente"><select required value={clientId} onChange={e=>setClientId(e.target.value)}>{p.data.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Nome do plano"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Quantidade de cortes"><input type="number" required min="1" max="1000" value={cuts} onChange={e=>setCuts(e.target.value)}/></Field><Field label="Válido até"><input required type="date" min={dayKey(new Date().toISOString(),p.data.shop.timezone)} value={expires} onChange={e=>setExpires(e.target.value)}/></Field><p className="muted">Confirme os dados antes de registrar. Este cadastro não realiza cobrança.</p>{error&&<p className="notice" role="alert">{error}</p>}<button className="primary full" disabled={busy}>Confirmar plano de cortes</button></form></Modal>}</>;
}
export function Reports(p:WorkspaceProps){const [selected,setSelected]=useState<Appointment|null>(null),[busy,setBusy]=useState(false);async function receive(){if(!selected)return;setBusy(true);try{if(p.demo){p.notify('Demonstração: nenhum recebimento real foi registrado.');}else{await api('/payments',p.data.shop.id,{appointmentId:selected.id,confirmed:true});await p.refresh();p.notify('Recebimento registrado.');}setSelected(null);}catch(e){p.notify((e as Error).message);}finally{setBusy(false);}}
 const completed=p.data.appointments.filter(a=>a.status==='completed');
 return <><PageTitle eyebrow="DECISÕES COM CLAREZA" title="Financeiro" description="Recebimentos registrados, sem estimativas."/><section className="report-total"><span className="eyebrow">RECEBIDO NESTA SEMANA</span><strong>{money(p.data.revenue??0)}</strong><p className="muted">De segunda-feira até agora · {p.data.shop.timezone}</p></section><div className="section-title"><h2>Atendimentos concluídos</h2><span className="muted">Últimos 30 dias</span></div><p className="muted">Abra um atendimento para confirmar um recebimento ainda não registrado.</p>{completed.length?completed.map(a=><AppointmentRow key={a.id} data={p.data} appointment={a} onClick={()=>setSelected(a)}/>):<Empty title="Ainda não há atendimentos concluídos"/>}{selected&&<Modal title="Confirmar recebimento" onClose={()=>setSelected(null)}><p>Você recebeu {money(selected.price_cents)} por este atendimento?</p><p className="muted">Esta ação registra um valor recebido. Não cobra o cliente. Recebimentos duplicados são bloqueados.</p><button className="primary full" disabled={busy} onClick={receive}>Confirmar recebimento</button></Modal>}</>;
}
export function Communication(p:WorkspaceProps){
 const [modal,setModal]=useState(false),[title,setTitle]=useState(''),[body,setBody]=useState(''),[audience,setAudience]=useState<'CLIENT'|'BARBER'|'ALL'>('CLIENT'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function create(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{if(p.demo){p.notify('Campanha criada na demonstração.');setModal(false);return;}await api('/campaigns',p.data.shop.id,{title,body,audience});await p.refresh();setModal(false);setTitle('');setBody('');p.notify('Rascunho criado.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function publish(id:string){if(!confirm('Publicar esta comunicação agora para o público selecionado?'))return;setBusy(true);try{if(p.demo){p.notify('Publicação simulada na demonstração.');return;}await api(`/campaigns/${id}/publish`,p.data.shop.id,{confirmed:true});await p.refresh();p.notify('Comunicação publicada e notificações internas criadas.');}catch(e){p.notify((e as Error).message);}finally{setBusy(false);}}
 return <><PageTitle eyebrow="PERTO DE QUEM IMPORTA" title="Comunicação" description="Avisos internos para clientes e equipe. WhatsApp/e-mail entram depois via provedor." action={<button className="primary" onClick={()=>setModal(true)}><Plus size={18}/>Nova comunicação</button>}/>{p.data.campaigns.length?<div className="people-list">{p.data.campaigns.map(c=><div className="person-row" key={c.id}><div><h3>{c.title}</h3><p>{c.body}</p><small className="muted">Público: {c.audience} · {c.status==='published'?'Publicado':'Rascunho'}</small></div>{c.status==='draft'&&<button className="secondary" disabled={busy} onClick={()=>publish(c.id)}>Publicar</button>}</div>)}</div>:<Empty title="Nenhuma comunicação criada">Crie avisos para aparecerem como notificações dentro do FIO.</Empty>}{modal&&<Modal title="Nova comunicação" onClose={()=>setModal(false)}><form onSubmit={create}><Field label="Título"><input required minLength={2} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Mensagem"><textarea required maxLength={1000} rows={5} value={body} onChange={e=>setBody(e.target.value)}/></Field><Field label="Público"><select value={audience} onChange={e=>setAudience(e.target.value as 'CLIENT'|'BARBER'|'ALL')}><option value="CLIENT">Clientes</option><option value="BARBER">Equipe</option><option value="ALL">Todos</option></select></Field>{error&&<p className="notice" role="alert">{error}</p>}<button className="primary full" disabled={busy}>Salvar rascunho</button></form></Modal>}</>;
}
export function Settings(p:WorkspaceProps){
 const owner=p.data.membership.role==='OWNER',navigate=useNavigate();
 const [section,setSection]=useState<'profile'|'barbershop'|'access'|'account'>('profile');
 const [phone,setPhone]=useState(p.data.membership.phone??'');
 const [title,setTitle]=useState(p.data.shop.public_title??p.data.shop.name);
 const [description,setDescription]=useState(p.data.shop.public_description??'');
 const [logoUrl,setLogoUrl]=useState(p.data.shop.logo_url??'');
 const [coverUrl,setCoverUrl]=useState(p.data.shop.cover_url??'');
 const [backgroundUrl,setBackgroundUrl]=useState(p.data.shop.background_url??'');
 const [accentColor,setAccentColor]=useState(p.data.shop.accent_color??'#ffffff');
 const [busy,setBusy]=useState(false),[accountEmail,setAccountEmail]=useState('');
 const [newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState('');
 const [showPassword,setShowPassword]=useState(false),[showConfirm,setShowConfirm]=useState(false),[passwordBusy,setPasswordBusy]=useState(false);
 const origin=typeof window==='undefined'?'':window.location.origin;
 const links={gestao:`${origin}/acesso/gestao`,equipe:`${origin}/acesso/equipe`,clientes:`${origin}/b/${p.data.shop.slug}`};

 useEffect(()=>{let active=true;if(!supabase)return;void supabase.auth.getUser().then(({data})=>{if(active)setAccountEmail(data.user?.email??'');});return()=>{active=false;};},[]);

 async function saveContact(){
  setBusy(true);
  try{await api('/profile/contact',p.data.shop.id,{phone},'PATCH');await p.refresh();p.notify('Seu contato foi atualizado.');}
  catch(e){p.notify((e as Error).message);}
  finally{setBusy(false);}
 }
 async function saveBrand(){
  setBusy(true);
  try{await api('/shop/branding',p.data.shop.id,{title,description,logoUrl,coverUrl,backgroundUrl,accentColor},'PATCH');await p.refresh();p.notify('Visual dos clientes atualizado.');}
  catch(e){p.notify((e as Error).message);}
  finally{setBusy(false);}
 }
 async function copy(value:string){
  try{await navigator.clipboard.writeText(value);p.notify('Link copiado.');}
  catch{p.notify('Não foi possível copiar automaticamente.');}
 }
 async function changePassword(e:FormEvent){
  e.preventDefault();
  if(newPassword.length<8){p.notify('A nova senha precisa ter pelo menos 8 caracteres.');return;}
  if(newPassword!==confirmPassword){p.notify('As duas senhas precisam ser iguais.');return;}
  if(!supabase){p.notify('A conexão da conta não está disponível agora.');return;}
  setPasswordBusy(true);
  try{
   const r=await supabase.auth.updateUser({password:newPassword});
   if(r.error)throw r.error;
   setNewPassword('');setConfirmPassword('');
   p.notify('Senha atualizada com segurança.');
  }catch(e){p.notify((e as Error).message||'Não foi possível alterar a senha agora.');}
  finally{setPasswordBusy(false);}
 }

 const sections=[
  ['profile','Meu perfil',UserRound],
  ...(owner?[['barbershop','Barbearia',Store] as const]:[]),
  ['access','Acessos e app',ShieldCheck],
  ['account','Conta e segurança',KeyRound],
 ] as const;

 return <>
  <button className="settings-back" type="button" onClick={()=>navigate(-1)}><ArrowLeft size={16}/>Voltar</button>
  <PageTitle eyebrow="CONFIGURAÇÕES" title="Seu espaço" description="Perfil, identidade, acessos e segurança em um só lugar."/>
  <div className="settings-workspace">
   <nav className="settings-nav" aria-label="Seções das configurações">
    {sections.map(([key,label,Icon])=><button key={key} type="button" className={section===key?'active':''} onClick={()=>setSection(key)}><Icon size={17}/><span>{label}</span></button>)}
   </nav>

   <div className="settings-content">
    {section==='profile'&&<>
     <section className="settings-card settings-profile-card">
      <div className="settings-profile-head">
       <span className="avatar settings-avatar">{p.data.membership.display_name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>
       <div><h2>{p.data.membership.display_name}</h2><p className="muted">{owner?'Responsável pela barbearia':p.data.membership.role==='BARBER'?'Profissional da equipe':'Cliente'}</p></div>
      </div>
      {accountEmail&&<div className="settings-readonly"><span>E-mail da conta</span><strong>{accountEmail}</strong></div>}
      <Field label="WhatsApp / telefone"><input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(61) 99999-9999"/></Field>
      <button className="primary" disabled={busy} onClick={saveContact}>{busy?'Salvando…':'Salvar meu contato'}</button>
     </section>
     <section className="settings-card">
      <div className="section-title"><h2>Aplicativo</h2><span className="muted">{owner?'FIO Gestão':p.data.membership.role==='BARBER'?'FIO Equipe':'App da barbearia'}</span></div>
      <p className="muted">Instale o FIO para abrir direto pela tela inicial sem depender de procurar o link novamente.</p>
      <button className="secondary" onClick={()=>void p.installApp?.()}><Download size={16}/>{p.canInstall?'Instalar aplicativo':'Como instalar'}</button>
     </section>
    </>}

    {section==='barbershop'&&owner&&<>
     <section className="settings-card branding-card">
      <div className="section-title"><h2>Identidade da barbearia</h2><span className="muted">O que o cliente vê.</span></div>
      <Field label="Nome exibido"><input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></Field>
      <Field label="Descrição"><textarea maxLength={280} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Uma frase curta sobre a barbearia."/></Field>
      <div className="form-grid">
       <Field label="URL da logo"><input type="url" value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://..."/></Field>
       <Field label="URL da capa"><input type="url" value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="https://..."/></Field>
      </div>
      <Field label="URL do fundo"><input type="url" value={backgroundUrl} onChange={e=>setBackgroundUrl(e.target.value)} placeholder="https://..."/></Field>
      <Field label="Cor principal"><div className="color-field"><input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)}/><input value={accentColor} maxLength={7} pattern="#[0-9A-Fa-f]{6}" onChange={e=>setAccentColor(e.target.value)}/></div></Field>
      <div className="branding-preview" style={{'--preview-accent':accentColor,backgroundImage:backgroundUrl?`linear-gradient(#0009,#000b),url(${backgroundUrl})`:undefined} as CSSProperties}>
       <span style={{backgroundImage:logoUrl?`url(${logoUrl})`:undefined}}>{!logoUrl?'LOGO':''}</span>
       <div><strong>{title||p.data.shop.name}</strong><small>{description||'Prévia da experiência do cliente.'}</small></div>
       <button type="button">Agendar</button>
      </div>
      <button className="primary" disabled={busy} onClick={saveBrand}><Palette size={16}/>{busy?'Salvando…':'Salvar identidade'}</button>
     </section>
     <section className="settings-card">
      <div className="section-title"><h2>Site e app dos clientes</h2><span className="muted">Link público da barbearia.</span></div>
      <div className="share-links">
       <button onClick={()=>copy(links.clientes)}><LinkIcon size={17}/><div><span>Link dos clientes</span><small>{links.clientes}</small></div><Copy size={16}/></button>
      </div>
      <p className="muted settings-help">A logo da barbearia identifica a experiência instalada pelos clientes.</p>
     </section>
    </>}

    {section==='access'&&<>
     <section className="settings-card">
      <div className="section-title"><h2>Links de acesso</h2><span className="muted">Prontos para enviar.</span></div>
      <div className="share-links">
       {owner&&<button onClick={()=>copy(links.gestao)}><LinkIcon size={17}/><div><span>FIO Gestão</span><small>{links.gestao}</small></div><Copy size={16}/></button>}
       {owner&&<button onClick={()=>copy(links.equipe)}><LinkIcon size={17}/><div><span>FIO Equipe</span><small>{links.equipe}</small></div><Copy size={16}/></button>}
       <button onClick={()=>copy(links.clientes)}><LinkIcon size={17}/><div><span>Link dos clientes</span><small>{links.clientes}</small></div><Copy size={16}/></button>
      </div>
     </section>
     {owner&&<section className="settings-card">
      <div className="section-title"><h2>Equipe e permissões</h2><span className="muted">Controle quem trabalha no espaço.</span></div>
      <p className="muted">Os acessos da equipe continuam separados do acesso do responsável. Adicione e consulte profissionais na área Equipe.</p>
      <button className="secondary" onClick={()=>navigate(`${p.base}/equipe`)}><Users size={16}/>Abrir equipe</button>
     </section>}
    </>}

    {section==='account'&&<>
     <section className="settings-card">
      <div className="section-title"><h2>Alterar senha</h2><span className="muted">Proteja sua conta.</span></div>
      <form onSubmit={changePassword}>
       <Field label="Nova senha"><div className="password-field"><input type={showPassword?'text':'password'} minLength={8} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/><button type="button" className="password-toggle" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></Field>
       <Field label="Confirmar nova senha"><div className="password-field"><input type={showConfirm?'text':'password'} minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/><button type="button" className="password-toggle" aria-label={showConfirm?'Ocultar confirmação':'Mostrar confirmação'} onClick={()=>setShowConfirm(v=>!v)}>{showConfirm?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></Field>
       <button className="primary" disabled={passwordBusy}>{passwordBusy?'Alterando…':'Alterar senha'}</button>
      </form>
     </section>
     <section className="settings-card">
      <div className="section-title"><h2>Sessão</h2></div>
      <p className="muted">Encerre o acesso neste dispositivo quando terminar de usar.</p>
      <button className="secondary" onClick={()=>void supabase?.auth.signOut()}><LogOut size={16}/>Sair da conta</button>
     </section>
     <section className="settings-card settings-danger-zone">
      <div className="section-title"><h2>Excluir conta</h2><span className="muted">Ação permanente.</span></div>
      <p className="muted">A exclusão permanente ainda não está liberada por autoatendimento. O FIO não vai fingir que apagou seus dados sem um fluxo seguro de confirmação e auditoria.</p>
      <button className="danger" type="button" onClick={()=>p.notify('A exclusão automática ainda não está disponível. Nenhum dado foi removido.')}>Excluir conta</button>
     </section>
    </>}
   </div>
  </div>
  <section className="settings-card settings-meta">
   <div><span>Barbearia</span><strong>{p.data.shop.name}</strong></div>
   <div><span>Plano FIO</span><strong>{p.data.plan}</strong></div>
   <div><span>Assistente</span><strong>{p.data.aiEnabled?'Incluído':'Indisponível'}</strong></div>
  </section>
 </>;
}
