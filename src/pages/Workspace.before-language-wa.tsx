import {StaffSchedule} from '../components/StaffSchedule';
import {AppointmentPeriod} from '../components/AppointmentPeriod';
import {PushSettings} from '../components/PushSettings';
import {BookingFlow as BookingModal} from '../components/BookingFlow';
import { useState,useEffect,type FormEvent,type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight,ArrowLeft,ChevronLeft,ChevronRight,Plus,Scissors,Clock3,Users,CalendarDays,Check,Search,Copy,SlidersHorizontal,MessageCircle,Star,Link as LinkIcon,Download,X,Share2,SquarePlus,UserRound,Store,ShieldCheck,KeyRound,LogOut,Palette,Eye,EyeOff,Info,Crown,CircleHelp,FileText,Shield,MessageSquareText,Bug,Send,ImagePlus,RefreshCw } from 'lucide-react';
import type { Bootstrap,Appointment,Service } from '../../shared/domain';
import { money } from '../../shared/domain';
import { api,supabase } from '../lib/api';
import { optimizeImage } from '../lib/images';
import { planAllows } from '../../shared/entitlements';
import { Empty,Field,Modal,PageTitle,ArrowLink } from '../components/ui';
export interface WorkspaceProps {data:Bootstrap;demo:boolean;base:string;refresh:()=>Promise<void>;notify:(text:string)=>void;updateDemo:(fn:(d:Bootstrap)=>Bootstrap)=>void;canInstall?:boolean;installApp?:()=>Promise<void>}
const statusLabels={scheduled:'Agendado',confirmed:'Confirmado',in_service:'Em atendimento',completed:'Concluído',cancelled:'Cancelado',no_show:'Falta'};
const statusHelp={
 scheduled:'Este horário já está reservado na agenda.',
 confirmed:'Este horário está reservado automaticamente na agenda.',
 in_service:'O atendimento está em andamento.',
 completed:'Atendimento concluído e salvo no histórico.',
 cancelled:'Este horário foi cancelado e saiu da agenda ativa.',
 no_show:'O cliente não compareceu e a falta foi registrada.'
};
const time=(date:string,zone:string)=>new Date(date).toLocaleTimeString('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
const whats=(phone?:string|null)=>{const digits=(phone??'').replace(/\D/g,'');if(!digits)return '';return `https://wa.me/${digits.startsWith('55')?digits:`55${digits}`}`;};
const accentContrast=(hex:string)=>{const value=hex.replace('#','');if(!/^[0-9a-f]{6}$/i.test(value))return '#050505';const r=parseInt(value.slice(0,2),16),g=parseInt(value.slice(2,4),16),b=parseInt(value.slice(4,6),16);return (r*299+g*587+b*114)/1000<145?'#ffffff':'#050505';};
export const dayKey=(date:string,zone:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
function MemberAvatar({member,className=''}:{member:{display_name:string;avatar_url?:string|null};className?:string}){return <span className={`avatar ${className}`}>{member.avatar_url?<img src={member.avatar_url} alt=""/>:member.display_name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>;}

type Customer=Bootstrap['customers'][number];

const firstName=(name?:string|null)=>
 (name??'Cliente').trim().split(/\s+/)[0]||'Cliente';

function CustomerAvatar({
 customer,
 data,
 className=''
}:{
 customer?:Customer|null;
 data:Bootstrap;
 className?:string
}){
 const membership=
  customer?.user_id
   ?data.team.find(member=>member.user_id===customer.user_id)
   :undefined;

 const name=customer?.name??'Cliente';

 return <span className={`avatar customer-avatar ${className}`}>
  {membership?.avatar_url
   ?<img src={membership.avatar_url} alt=""/>
   :name.split(' ').map(n=>n[0]).slice(0,2).join('')}
 </span>;
}

type HomeSlide={eyebrow:string;title:string;text:string;action:string;kind:'route'|'public'|'install'|'info';to?:string};
function HomeCarousel(p:WorkspaceProps){
 const navigate=useNavigate(),role=p.data.membership.role;
 const shopName=p.data.shop.public_title||p.data.shop.name;
 const slides:HomeSlide[]=role==='CLIENT'
  ?[
    {eyebrow:'SEU HORÁRIO',title:`Agende na ${shopName} sem complicação.`,text:'Escolha serviço, profissional e horário disponível direto pelo FIO.',action:'Agendar agora',kind:'route',to:`${p.base}/agenda?novo=1`},
    {eyebrow:'NO SEU APARELHO',title:`Tenha ${shopName} sempre por perto.`,text:'Instale o app personalizado e abra sua barbearia direto pela tela inicial.',action:'Instalar app',kind:'install'},
    {eyebrow:'TUDO ORGANIZADO',title:'Seus próximos horários ficam em um só lugar.',text:'Consulte, acompanhe e gerencie seus agendamentos sem precisar procurar mensagens antigas.',action:'Ver agenda',kind:'route',to:`${p.base}/agenda`}
   ]
  :role==='OWNER'
   ?[
     {eyebrow:'SEU MINI SITE',title:'Sua barbearia pronta para receber clientes.',text:'Compartilhe seu link público com serviços, identidade, contatos e acesso ao app personalizado da sua marca.',action:'Abrir mini site',kind:'public'},
     {eyebrow:'AGENDA AO VIVO',title:'Novos agendamentos aparecem sem você atualizar a página.',text:'O FIO acompanha mudanças em tempo real e também sincroniza quando o celular volta do bloqueio ou a internet retorna.',action:'Ver agenda',kind:'route',to:`${p.base}/agenda`},
     {eyebrow:'IDENTIDADE',title:'Sua marca sempre com a sua cara.',text:'Atualize logo, capa, fundo, cores e informações do mini site sempre que quiser.',action:'Personalizar',kind:'route',to:`${p.base}/configuracoes`},
     {eyebrow:'EM BREVE • FIO NFC',title:'Sua marca também no mundo físico.',text:'Uma ideia futura do FIO: chaveiros 3D com a logo da sua barbearia e NFC. Você poderá escolher se o toque abre Instagram, mini site ou outro link.',action:'Em breve',kind:'info'}
    ]
   :[
     {eyebrow:'AGENDA AO VIVO',title:'Seus próximos atendimentos atualizam automaticamente.',text:'Novos horários aparecem sem F5 e a agenda sincroniza quando você volta ao aplicativo.',action:'Ver agenda',kind:'route',to:`${p.base}/agenda`},
     {eyebrow:'ACESSO RÁPIDO',title:'Tenha o FIO na tela inicial.',text:'Instale o app para abrir sua agenda sem procurar o link no navegador.',action:'Instalar app',kind:'install'},
     {eyebrow:'EM BREVE • FIO NFC',title:'Uma nova forma de levar a barbearia até o cliente.',text:'O FIO estuda chaveiros 3D personalizados com NFC para abrir Instagram, mini site ou outro link com uma aproximação.',action:'Em breve',kind:'info'}
    ];
 const [index,setIndex]=useState(0);
 useEffect(()=>{setIndex(0);},[role,p.data.shop.id]);
 useEffect(()=>{if(slides.length<2)return;const timer=window.setInterval(()=>setIndex(current=>(current+1)%slides.length),6500);return()=>window.clearInterval(timer);},[role,p.data.shop.id,slides.length]);
 const run=async(slide:HomeSlide)=>{
  if(slide.kind==='route'&&slide.to){navigate(slide.to);return;}
  if(slide.kind==='public'){window.open(`/${p.data.shop.slug}`,'_blank','noopener,noreferrer');return;}
  if(slide.kind==='install'){
   if(p.canInstall)await p.installApp?.();
   else p.notify('Abra este acesso no Chrome ou Edge para instalar o app.');
  }
 };
 return <section className="home-carousel home-carousel-featured" aria-label="Destaques do FIO">
  <div className="home-carousel-track">{slides.map((slide,i)=><article key={`${slide.eyebrow}-${i}`} className={`home-carousel-slide ${i===index?'active':''}`} aria-hidden={i!==index}>
   <div className="home-carousel-copy"><p className="eyebrow">{slide.eyebrow}</p><h2>{slide.title}</h2><p>{slide.text}</p></div>
   <button type="button" className={`secondary home-carousel-action ${slide.kind==='info'?'future':''}`} disabled={slide.kind==='info'} tabIndex={i===index?0:-1} onClick={()=>void run(slide)}>{slide.action}{slide.kind!=='info'&&<ArrowUpRight size={16}/>}</button>
  </article>)}</div>
  <div className="home-carousel-footer">
   <div className="home-carousel-dots">{slides.map((slide,i)=><button type="button" key={slide.eyebrow} className={`home-carousel-dot ${i===index?'active':''}`} aria-label={`Mostrar destaque ${i+1}`} onClick={()=>setIndex(i)}/>)}</div>
   <div className="home-carousel-nav"><button type="button" aria-label="Destaque anterior" onClick={()=>setIndex(current=>(current-1+slides.length)%slides.length)}><ChevronLeft size={16}/></button><button type="button" aria-label="Próximo destaque" onClick={()=>setIndex(current=>(current+1)%slides.length)}><ChevronRight size={16}/></button></div>
  </div>
 </section>;
}
function StaffHome(p:WorkspaceProps){
 const navigate=useNavigate();
 const role=p.data.membership.role;
 const shopName=p.data.shop.public_title||p.data.shop.name;
 const now=Date.now();

 const openPublic=()=>
  window.open(
   `/${p.data.shop.slug}`,
   '_blank',
   'noopener,noreferrer'
  );

 const next=p.data.appointments
  .filter(a=>
   ['scheduled','confirmed','in_service'].includes(a.status)&&
   Date.parse(a.ends_at)>now&&
   (
    role!=='BARBER'||
    a.barber_id===p.data.membership.user_id
   )
  )
  .sort(
   (a,b)=>
    Date.parse(a.starts_at)-
    Date.parse(b.starts_at)
  )[0];

 const customer=
  next
   ?p.data.customers.find(c=>c.id===next.client_id)
   :undefined;

 const service=
  next
   ?p.data.services.find(s=>s.id===next.service_id)
   :undefined;

 const professional=
  next
   ?p.data.team.find(t=>t.user_id===next.barber_id)
   :undefined;

 const happening=Boolean(
  next&&
  Date.parse(next.starts_at)<=now&&
  Date.parse(next.ends_at)>now
 );

 return <>

  <section className="home-hub-intro">

   <div>
    <span className="eyebrow">VISÃO GERAL</span>
    <h1>{shopName}</h1>
    <p>
     {role==='OWNER'
      ?'Acompanhe a rotina da barbearia e veja rapidamente quem é o próximo cliente.'
      :'Veja rapidamente seu próximo cliente e mantenha os atendimentos organizados.'}
    </p>
   </div>

   {role==='OWNER'&&
    <button
     type="button"
     className="secondary"
     onClick={openPublic}
    >
     <LinkIcon size={17}/>
     Abrir mini site
    </button>
   }

  </section>

  {next&&
   <button
    type="button"
    className={
     `next-appointment-card ${happening?'is-now':''}`
    }
    onClick={()=>
     navigate(
      `${p.base}/agenda?appointment=${next.id}`
     )
    }
   >

    <div className="next-appointment-time">

     <span className="eyebrow">
      {happening
       ?'ATENDIMENTO AGORA'
       :'PRÓXIMO ATENDIMENTO'}
     </span>

     <strong>
      {time(
       next.starts_at,
       p.data.shop.timezone
      )}
     </strong>

     <small>
      {new Date(next.starts_at)
       .toLocaleDateString(
        'pt-BR',
        {
         timeZone:p.data.shop.timezone,
         weekday:'long',
         day:'2-digit',
         month:'short'
        }
       )}
     </small>

    </div>

    <CustomerAvatar
     customer={customer}
     data={p.data}
    />

    <div className="next-appointment-person">

     <strong>
      {firstName(customer?.name)}
     </strong>

     <span>
      {service?.name??'Serviço'}
     </span>

     {role==='OWNER'&&
      <small>
       com {professional?.display_name??'Profissional'}
      </small>
     }

    </div>

    <span className={`status ${next.status}`}>
     {happening
      ?'Agora'
      :statusLabels[next.status]}
    </span>

    <ArrowUpRight size={19}/>

   </button>
  }

  <HomeCarousel {...p}/>

  <section
   className="home-quick-section"
   aria-label="Atalhos"
  >

   <div className="home-section-heading">
    <div>
     <span className="eyebrow">ATALHOS</span>
     <h2>
      Acesse o que você usa no dia a dia.
     </h2>
    </div>
   </div>

   <div className="home-quick-grid">

    <button
     type="button"
     onClick={()=>navigate(`${p.base}/agenda`)}
    >
     <span><CalendarDays size={19}/></span>
     <div>
      <strong>Agenda</strong>
      <small>
       Horários e atendimentos em tempo real.
      </small>
     </div>
     <ArrowUpRight size={17}/>
    </button>

    {role==='OWNER'&&
     <button
      type="button"
      onClick={()=>navigate(`${p.base}/clientes`)}
     >
      <span><Users size={19}/></span>
      <div>
       <strong>Clientes</strong>
       <small>
        Cadastros e histórico da sua barbearia.
       </small>
      </div>
      <ArrowUpRight size={17}/>
     </button>
    }

    <button
     type="button"
     onClick={()=>navigate(`${p.base}/servicos`)}
    >
     <span><Scissors size={19}/></span>
     <div>
      <strong>Serviços</strong>
      <small>
       Preços, duração e opções disponíveis.
      </small>
     </div>
     <ArrowUpRight size={17}/>
    </button>

    <button
     type="button"
     onClick={()=>navigate(`${p.base}/configuracoes`)}
    >
     <span><Palette size={19}/></span>
     <div>
      <strong>
       {role==='OWNER'
        ?'Personalização'
        :'Configurações'}
      </strong>
      <small>
       {role==='OWNER'
        ?'Logo, cores e informações do seu espaço.'
        :'Perfil, acesso e preferências do aplicativo.'}
      </small>
     </div>
     <ArrowUpRight size={17}/>
    </button>

   </div>

  </section>

  <InstallNudge {...p}/>

 </>;
}
export function Dashboard(p:WorkspaceProps){
 const {data,base}=p,role=data.membership.role,navigate=useNavigate(),today=dayKey(new Date().toISOString(),data.shop.timezone);
 if(role!=='CLIENT')return <StaffHome {...p}/>;
 const next=data.appointments.filter(a=>['scheduled','confirmed','in_service'].includes(a.status)&&new Date(a.ends_at)>new Date()).slice(0,4);
 return <><PageTitle eyebrow={new Date().toLocaleDateString('pt-BR',{timeZone:data.shop.timezone,weekday:'long',day:'numeric',month:'long'})} title="Agende seu horário" action={<button className="primary" onClick={()=>navigate(`${base}/agenda?novo=1`)}><Plus size={18}/>Agendar horário</button>}/><HomeCarousel {...p}/><section className="client-welcome">{data.shop.cover_url&&<img className="client-cover" src={data.shop.cover_url} alt=""/>}<div><h2>{data.shop.public_title||data.shop.name}</h2><p>{data.shop.public_description||'Escolha o profissional, o serviço e um horário disponível.'}</p><div className="page-actions"><button className="secondary" onClick={()=>navigate(`${base}/profissionais`)}>Profissionais</button><button className="secondary" onClick={()=>navigate(`${base}/servicos`)}>Serviços</button>{data.shop.whatsapp&&<a className="secondary" href={whats(data.shop.whatsapp)} target="_blank" rel="noreferrer">Contato</a>}</div></div></section><section><div className="section-title"><h2>Seus próximos horários</h2><ArrowLink onClick={()=>navigate(`${base}/agenda`)}>Ver agenda</ArrowLink></div>{next.length?<div className="appointment-list">{next.map(a=><AppointmentRow key={a.id} appointment={a} data={data} onClick={()=>navigate(`${base}/agenda?appointment=${a.id}`)}/>)}</div>:<Empty title="Nenhum horário marcado">Seus próximos agendamentos aparecem aqui.</Empty>}</section><ReviewPrompt {...p}/><InstallNudge {...p}/></>;
}
function InstallNudge(p:WorkspaceProps){
 const key=`fio-install-dismissed:${p.data.shop.id}:${p.data.membership.user_id}`;
 const standalone=typeof window!=='undefined'&&(window.matchMedia?.('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
 const [visible,setVisible]=useState(()=>!standalone&&localStorage.getItem(key)!=='1'),[guide,setGuide]=useState<'menu'|'ios'|'mac'|null>(null);
 if((!visible&&!guide)||standalone)return null;
 const remember=()=>{localStorage.setItem(key,'1');setVisible(false);};
 const direct=async()=>{remember();if(p.canInstall)await p.installApp?.();else setGuide('menu');};
 const appName=p.data.membership.role==='BARBER'?'FIO Equipe':`o app de ${p.data.shop.public_title||p.data.shop.name}`;
 return <><section className="install-nudge"><div className="install-nudge-icon"><Download size={18}/></div><div><strong>Instale {appName}</strong><span>Acesso rápido pela tela inicial. Depois, a opção continua nas Configurações.</span></div><button className="install-nudge-action" onClick={()=>setGuide('menu')}>Baixar</button><button className="install-nudge-close" aria-label="Fechar" onClick={remember}><X size={16}/></button></section>{guide&&<Modal title="Instalar FIO" onClose={()=>setGuide(null)}><div className="install-platforms">{guide==='menu'?<><p className="muted">Escolha onde você está usando o FIO.</p><button className="secondary" onClick={()=>void direct()}>Android</button><button className="secondary" onClick={()=>void direct()}>Windows</button><button className="secondary" onClick={()=>setGuide('mac')}>Mac</button><button className="secondary" onClick={()=>setGuide('ios')}>iPhone / iPad</button><small className="muted">Se fechar este aviso, você pode instalar depois em Configurações.</small></>:guide==='ios'?<div className="install-guide"><div><Share2 size={22}/><span><b>1.</b> No Safari, toque em <strong>Compartilhar</strong>.</span></div><div><SquarePlus size={22}/><span><b>2.</b> Toque em <strong>Adicionar à Tela de Início</strong> e confirme.</span></div></div>:<div className="install-guide"><p>No Safari, abra o menu <strong>Arquivo</strong> e escolha <strong>Adicionar ao Dock</strong>. Em navegadores compatíveis, use a opção <strong>Instalar aplicativo</strong>.</p></div>}</div></Modal>}</>;
}
function ReviewPrompt(p:WorkspaceProps){
 const completed=p.data.appointments.filter(a=>a.status==='completed'&&!p.data.reviews.some(r=>r.appointment_id===a.id));
 const [appointment,setAppointment]=useState<Appointment|null>(null),[rating,setRating]=useState(5),[comment,setComment]=useState(''),[busy,setBusy]=useState(false);
 const pending=completed[0];if(!pending)return null;
 const barber=p.data.team.find(t=>t.user_id===pending.barber_id)?.display_name??'seu profissional';
 async function submit(){if(!appointment)return;setBusy(true);try{if(p.demo){p.updateDemo(d=>({...d,reviews:[...d.reviews,{id:crypto.randomUUID(),appointment_id:appointment.id,client_id:appointment.client_id,barber_id:appointment.barber_id,rating,comment,created_at:new Date().toISOString()}]}));}else{await api('/reviews',p.data.shop.id,{appointmentId:appointment.id,rating,comment});await p.refresh();}setAppointment(null);setComment('');setRating(5);p.notify('Obrigado pela avaliação.');}catch(e){p.notify((e as Error).message);}finally{setBusy(false);}}
 return <><button className="review-prompt" onClick={()=>setAppointment(pending)}><div><span className="eyebrow">COMO FOI?</span><strong>Avalie seu atendimento com {barber.split(' ')[0]}</strong><small>Leva menos de 20 segundos.</small></div><div className="review-stars">★★★★★</div><ArrowUpRight size={18}/></button>{appointment&&<Modal title="Avalie seu atendimento" onClose={()=>setAppointment(null)}><div className="review-modal"><p className="muted">Sua avaliação vai para {barber} e ajuda a barbearia a melhorar.</p><div className="star-picker" aria-label="Nota">{[1,2,3,4,5].map(n=><button type="button" aria-label={`${n} estrela${n>1?'s':''}`} className={n<=rating?'selected':''} key={n} onClick={()=>setRating(n)}><Star size={30} fill={n<=rating?'currentColor':'none'}/></button>)}</div><Field label="Comentário (opcional)"><textarea maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Conte como foi sua experiência."/></Field><button className="primary full" disabled={busy} onClick={submit}>{busy?'Enviando…':'Enviar avaliação'}</button></div></Modal>}</>;
}
function AppointmentRow({appointment:a,data,onClick}:{appointment:Appointment;data:Bootstrap;onClick:()=>void}){
 const customer=
  data.customers.find(c=>c.id===a.client_id);

 return <button
  className="appointment-row"
  onClick={onClick}
 >

  <div className="appointment-time">
   {time(a.starts_at,data.shop.timezone)}
   <small>
    {time(a.ends_at,data.shop.timezone)}
   </small>
  </div>

  <CustomerAvatar
   customer={customer}
   data={data}
  />

  <div className="appointment-info">

   <strong>
    {firstName(customer?.name)}
   </strong>

   <span>
    {data.services.find(
     s=>s.id===a.service_id
    )?.name??'Serviço'}

    {' · '}

    {data.team.find(
     t=>t.user_id===a.barber_id
    )?.display_name}
   </span>

  </div>

  <span className={`status ${a.status}`}>
   {statusLabels[a.status]}
  </span>

  <ArrowUpRight size={16}/>

 </button>;
}
function ClientAppointmentRow({appointment:a,data,onClick}:{appointment:Appointment;data:Bootstrap;onClick:()=>void}){
 const zone=data.shop.timezone,start=new Date(a.starts_at);
 const professional=data.team.find(t=>t.user_id===a.barber_id)?.display_name??'Profissional';
 const service=data.services.find(s=>s.id===a.service_id)?.name??'Serviço';
 return <button className="client-booking-card" onClick={onClick}>
  <span className="client-booking-date"><strong>{start.toLocaleDateString('pt-BR',{timeZone:zone,day:'2-digit'})}</strong><small>{start.toLocaleDateString('pt-BR',{timeZone:zone,month:'short'}).replace('.','')}</small></span>
  <span className="client-booking-info"><span className="eyebrow">{statusLabels[a.status]}</span><strong>{service}</strong><small>{start.toLocaleDateString('pt-BR',{timeZone:zone,weekday:'long'})} · {time(a.starts_at,zone)} · {professional}</small></span>
  <span className={`status ${a.status}`}>{statusLabels[a.status]}</span>
  <ArrowUpRight size={17}/>
 </button>;
}

function ClientAgenda(p:WorkspaceProps){
 const {data}=p,zone=data.shop.timezone;

 const [booking,setBooking]=useState(
  new URLSearchParams(location.search).has('novo')
 );

 const [selected,setSelected]=useState<Appointment|null>(null);
 const [reschedule,setReschedule]=useState<Appointment|null>(null);
 const [busy,setBusy]=useState(false);
 const [linkOpened,setLinkOpened]=useState(false);

 useEffect(()=>{

  const id=new URLSearchParams(location.search)
   .get('appointment');

  if(!id||linkOpened)return;

  let alive=true;

  const known=data.appointments.find(a=>a.id===id);

  const request=known
   ?Promise.resolve(known)
   :api<Appointment>(`/appointments/${id}`,data.shop.id);

  void request
   .then(found=>{
    if(alive){
     setSelected(found);
     setLinkOpened(true);
    }
   })
   .catch(e=>{
    if(alive){
     p.notify(e.message);
     setLinkOpened(true);
    }
   });

  return()=>{alive=false};

 },[
  data.appointments,
  data.shop.id,
  linkOpened
 ]);

 const upcoming=data.appointments
  .filter(a=>
   ['scheduled','confirmed','in_service'].includes(a.status)&&
   Date.parse(a.ends_at)>Date.now()
  )
  .sort((a,b)=>
   Date.parse(a.starts_at)-Date.parse(b.starts_at)
  );

 const recentChanges=data.appointments
  .filter(a=>
   ['cancelled','no_show'].includes(a.status)&&
   Date.parse(a.starts_at)>Date.now()-30*86400000
  )
  .sort((a,b)=>
   Date.parse(b.starts_at)-Date.parse(a.starts_at)
  )
  .slice(0,5);

 const latestNotice=data.notifications.find(n=>
  n.appointment_id&&
  /(confirmado|cancelado|remarcado)/i.test(n.body)
 );

 async function cancel(){

  if(!selected||busy)return;

  if(!window.confirm(
   'Cancelar este agendamento? Ele sairá dos próximos horários, mas continuará no histórico.'
  ))return;

  setBusy(true);

  try{

   if(p.demo){

    p.updateDemo(d=>({
     ...d,
     appointments:d.appointments.map(a=>
      a.id===selected.id
       ?{...a,status:'cancelled'}
       :a
     )
    }));

   }else{

    await api(
     `/appointments/${selected.id}`,
     data.shop.id,
     {status:'cancelled',confirmed:true},
     'PATCH'
    );

    await p.refresh();

   }

   setSelected(null);

   p.notify(
    'Agendamento cancelado. A barbearia recebeu a atualização no FIO.'
   );

  }catch(e){

   p.notify((e as Error).message);

  }finally{

   setBusy(false);

  }
 }

 return <>

  <PageTitle
   eyebrow="SEUS HORÁRIOS"
   title="Seus agendamentos"
   description="Acompanhe cada etapa do seu horário e agende novamente quando quiser."
   action={
    <button
     className="primary"
     onClick={()=>setBooking(true)}
    >
     <Plus size={18}/>
     Agendar horário
    </button>
   }
  />

  {latestNotice&&
   <section className="client-agenda-notice">

    <span className="client-agenda-notice-icon">
     <Info size={17}/>
    </span>

    <div>
     <strong>{latestNotice.body}</strong>
     <small>
      {new Date(latestNotice.created_at)
       .toLocaleString('pt-BR',{timeZone:zone})}
     </small>
    </div>

   </section>
  }

  <section className="client-agenda-panel">

   <div className="client-agenda-heading">

    <div>
     <span className="eyebrow">PRÓXIMOS</span>
     <h2>Horários marcados</h2>
    </div>

    <span className="muted">
     {upcoming.length} agendamento
     {upcoming.length===1?'':'s'}
    </span>

   </div>

   {upcoming.length?

    <div className="client-agenda-list">

     {upcoming.map(a=>
      <ClientAppointmentRow
       key={a.id}
       appointment={a}
       data={data}
       onClick={()=>setSelected(a)}
      />
     )}

    </div>

    :

    <Empty title="Nenhum horário marcado">
     Toque em “Agendar horário” para escolher
     profissional, serviço, dia e horário.
    </Empty>

   }

  </section>

  {recentChanges.length>0&&

   <details className="client-history">

    <summary>
     Alterações recentes
     <span>{recentChanges.length}</span>
    </summary>

    <div className="client-agenda-list">

     {recentChanges.map(a=>
      <ClientAppointmentRow
       key={a.id}
       appointment={a}
       data={data}
       onClick={()=>setSelected(a)}
      />
     )}

    </div>

   </details>

  }

  {booking&&
   <BookingModal
    {...p}
    onClose={()=>setBooking(false)}
   />
  }

  {reschedule&&
   <BookingModal
    {...p}
    appointment={reschedule}
    onClose={()=>setReschedule(null)}
   />
  }

  {selected&&
   <Modal
    title="Seu agendamento"
    onClose={()=>setSelected(null)}
   >

    <div className="appointment-detail-status">

     <span className={`status ${selected.status}`}>
      {statusLabels[selected.status]}
     </span>

     <small>{statusHelp[selected.status]}</small>

    </div>

    <div className="appointment-detail-grid">

     <div>
      <span>Serviço</span>
      <strong>
       {data.services.find(
        s=>s.id===selected.service_id
       )?.name??'Serviço'}
      </strong>
      <small>
       {data.services.find(
        s=>s.id===selected.service_id
       )?.duration_minutes??'—'} minutos
      </small>
     </div>

     <div>
      <span>Profissional</span>
      <strong>
       {data.team.find(
        t=>t.user_id===selected.barber_id
       )?.display_name??'Profissional'}
      </strong>
     </div>

     <div>
      <span>Data</span>
      <strong>
       {new Date(selected.starts_at)
        .toLocaleDateString(
         'pt-BR',
         {timeZone:zone,dateStyle:'long'}
        )}
      </strong>
     </div>

     <div>
      <span>Horário</span>
      <strong>
       {time(selected.starts_at,zone)}
       {' — '}
       {time(selected.ends_at,zone)}
      </strong>
     </div>

     <div>
      <span>Valor</span>
      <strong>
       {selected.subscription_id
        ?'Coberto por assinatura'
        :money(selected.price_cents)}
      </strong>
     </div>

    </div>

    <div className="modal-actions">

     {['scheduled','confirmed']
      .includes(selected.status)&&
      <button
       className="secondary"
       disabled={busy}
       onClick={()=>{
        setReschedule(selected);
        setSelected(null);
       }}
      >
       Remarcar
      </button>
     }

     {['scheduled','confirmed']
      .includes(selected.status)&&
      <button
       className="danger"
       disabled={busy}
       onClick={()=>void cancel()}
      >
       Cancelar
      </button>
     }

     {['cancelled','no_show']
      .includes(selected.status)&&
      <button
       className="primary"
       onClick={()=>{
        setSelected(null);
        setBooking(true);
       }}
      >
       Agendar outro horário
      </button>
     }

    </div>

   </Modal>
  }

 </>;
}
function StaffAgenda(p:WorkspaceProps){

 const {data}=p;
 const zone=data.shop.timezone;
 const solo=data.shop.operation_mode==='SOLO';

 const owner=data.membership.role==='OWNER';

 const initialProfessional=
  data.membership.role==='BARBER'||solo
   ?data.membership.user_id
   :'';

 const providers=data.team.filter(t=>
  t.active&&
  (
   t.role==='BARBER'||
   (solo&&t.role==='OWNER')
  )
 );

 const [date,setDate]=useState(
  dayKey(new Date().toISOString(),zone)
 );

 const [booking,setBooking]=useState(
  new URLSearchParams(location.search).has('novo')
 );

 const [selected,setSelected]=useState<Appointment|null>(null);
 const [profileCustomer,setProfileCustomer]=useState<Customer|null>(null);
 const [linkOpened,setLinkOpened]=useState(false);
 const [busy,setBusy]=useState(false);

 const [professional,setProfessional]=
  useState(initialProfessional);

 const [reschedule,setReschedule]=
  useState<Appointment|null>(null);

 const [daily,setDaily]=useState<Appointment[]>([]);
 const [dailyError,setDailyError]=useState('');
 const [dailyLoading,setDailyLoading]=useState(true);
 const [manualRefreshing,setManualRefreshing]=useState(false);
 const [reloadKey,setReloadKey]=useState(0);

 useEffect(()=>{

  let alive=true;

  setDailyLoading(true);
  setDailyError('');

  const request=p.demo
   ?Promise.resolve({
     items:data.appointments.filter(a=>
      dayKey(a.starts_at,zone)===date&&
      (!professional||a.barber_id===professional)
     )
    })
   :api<{items:Appointment[]}>(
     `/appointments/period?from=${date}&to=${date}`+
     `${professional?`&barberId=${professional}`:''}`,
     data.shop.id
    );

  void request
   .then(v=>{
    if(alive)setDaily(v.items);
   })
   .catch(e=>{
    if(alive)setDailyError(e.message);
   })
   .finally(()=>{
    if(alive)setDailyLoading(false);
   });

  return()=>{alive=false};

 },[
  date,
  professional,
  data.appointments,
  data.shop.id,
  p.demo,
  zone,
  reloadKey
 ]);

 useEffect(()=>{

  const id=
   new URLSearchParams(location.search)
    .get('appointment');

  if(!id||linkOpened)return;

  let alive=true;

  const known=
   data.appointments.find(a=>a.id===id);

  const request=
   known
    ?Promise.resolve(known)
    :api<Appointment>(
      `/appointments/${id}`,
      data.shop.id
     );

  void request
   .then(found=>{
    if(alive){
     setSelected(found);
     setLinkOpened(true);
    }
   })
   .catch(e=>{
    if(alive){
     p.notify(e.message);
     setLinkOpened(true);
    }
   });

  return()=>{alive=false};

 },[
  data.appointments,
  data.shop.id,
  linkOpened
 ]);

 const activeAppointments=daily.filter(a=>
  ['scheduled','confirmed','in_service']
   .includes(a.status)
 );

 const archivedAppointments=daily.filter(a=>
  ['completed','cancelled','no_show']
   .includes(a.status)
 );

 function changeDay(delta:number){

  const d=new Date(date+'T12:00:00Z');

  d.setUTCDate(d.getUTCDate()+delta);

  setDate(d.toISOString().slice(0,10));

 }

 async function manualRefresh(){

  if(manualRefreshing)return;

  setManualRefreshing(true);

  try{

   await p.refresh();

   setReloadKey(key=>key+1);

   p.notify('Agenda atualizada.');

  }catch(e){

   p.notify(
    (e as Error).message||
    'Não foi possível atualizar agora.'
   );

  }finally{

   setManualRefreshing(false);

  }
 }

 async function transition(
  status:
   'confirmed'|
   'in_service'|
   'completed'|
   'cancelled'|
   'no_show'
 ){

  if(!selected)return;

  if(
   status==='cancelled'&&
   !window.confirm(
    'Cancelar este atendimento? Ele sairá da agenda ativa e o cliente receberá um aviso no FIO.'
   )
  )return;

  setBusy(true);

  try{

   if(p.demo){

    p.updateDemo(d=>({
     ...d,
     appointments:d.appointments.map(a=>
      a.id===selected.id
       ?{...a,status}
       :a
     )
    }));

   }else{

    await api(
     `/appointments/${selected.id}`,
     data.shop.id,
     {status,confirmed:true},
     'PATCH'
    );

    await p.refresh();

   }

   setSelected(null);

   p.notify({
    confirmed:
     'Horário confirmado. O cliente recebeu um aviso no FIO.',
    in_service:
     'Atendimento iniciado.',
    completed:
     'Atendimento concluído e salvo no histórico.',
    cancelled:
     'Agendamento cancelado. O cliente recebeu um aviso no FIO.',
    no_show:
     'Falta registrada no histórico.'
   }[status]);

  }catch(e){

   p.notify((e as Error).message);

  }finally{

   setBusy(false);

  }
 }

 const customer=
  selected
   ?data.customers.find(
     c=>c.id===selected.client_id
    )
   :null;

 const service=
  selected
   ?data.services.find(
     s=>s.id===selected.service_id
    )
   :null;

 const selectedProfessional=
  selected
   ?data.team.find(
     t=>t.user_id===selected.barber_id
    )
   :null;

 const profileAppointments=
  profileCustomer
   ?data.appointments.filter(
     a=>a.client_id===profileCustomer.id
    )
   :[];

 const profileCompleted=
  profileAppointments.filter(
   a=>a.status==='completed'
  );

 const profileUpcoming=
  profileAppointments.filter(a=>
   ['scheduled','confirmed','in_service']
    .includes(a.status)&&
   Date.parse(a.ends_at)>Date.now()
  );

 const profileLast=
  [...profileCompleted]
   .sort(
    (a,b)=>
     Date.parse(b.starts_at)-
     Date.parse(a.starts_at)
   )[0];

 return <>

  <PageTitle
   eyebrow={owner?'GESTÃO DA AGENDA':'SEUS ATENDIMENTOS'}
   title={
    owner
     ?solo?'Minha agenda':'Agenda da barbearia'
     :'Minha agenda'
   }
   description={
    owner
     ?'Acompanhe equipe e atendimentos sem misturar o histórico com a agenda ativa.'
     :'Aqui aparecem somente os atendimentos atribuídos a você.'
   }
   action={
    <div className="page-actions">

     <button
      className="secondary agenda-refresh-button"
      disabled={manualRefreshing}
      onClick={()=>void manualRefresh()}
     >
      <RefreshCw
       className={manualRefreshing?'spin':''}
       size={18}
      />
      <span>Atualizar agenda</span>
     </button>

     <button
      className="primary"
      onClick={()=>setBooking(true)}
     >
      <Plus size={18}/>
      {owner?'Novo agendamento':'Agendar cliente'}
     </button>

    </div>
   }
  />

  <div className="agenda-controls">

   <div className="agenda-day">

    <button
     className="icon-button"
     onClick={()=>changeDay(-1)}
    >
     <ChevronLeft/>
    </button>

    <Field label="Dia da agenda">
     <input
      type="date"
      value={date}
      onChange={e=>setDate(e.target.value)}
     />
    </Field>

    <button
     className="icon-button"
     onClick={()=>changeDay(1)}
    >
     <ChevronRight/>
    </button>

    <button
     className="secondary"
     onClick={()=>
      setDate(
       dayKey(new Date().toISOString(),zone)
      )
     }
    >
     Hoje
    </button>

   </div>

   {owner&&!solo&&
    <Field label="Filtrar profissional">
     <select
      value={professional}
      onChange={e=>setProfessional(e.target.value)}
     >
      <option value="">Toda a equipe</option>

      {providers.map(t=>
       <option
        key={t.user_id}
        value={t.user_id}
       >
        {t.display_name}
       </option>
      )}

     </select>
    </Field>
   }

   <span className="muted">
    {activeAppointments.length} ativo
    {activeAppointments.length===1?'':'s'}
   </span>

   <span className="agenda-live-status">
    <i/>
    Atualização automática
   </span>

  </div>

  <AppointmentPeriod
   {...p}
   professional={professional}
   onSelect={setSelected}
  />

  <section className="staff-day-agenda">

   <div className="section-title">

    <h2>Atendimentos do dia</h2>

    <span className="muted">
     {activeAppointments.length} ativo
     {activeAppointments.length===1?'':'s'}
    </span>

   </div>

   {dailyLoading?

    <p role="status">Carregando agenda…</p>

    :dailyError?

    <p role="alert" className="notice">
     {dailyError}
    </p>

    :activeAppointments.length?

    <div className="appointment-list">

     {activeAppointments.map(a=>
      <AppointmentRow
       key={a.id}
       appointment={a}
       data={data}
       onClick={()=>setSelected(a)}
      />
     )}

    </div>

    :

    <Empty title="Nenhum atendimento ativo neste dia">
     Escolha outra data ou crie um agendamento.
    </Empty>

   }

   {archivedAppointments.length>0&&

    <details className="staff-archive">

     <summary>
      Histórico do dia
      <span>{archivedAppointments.length}</span>
     </summary>

     <div className="appointment-list">

      {archivedAppointments.map(a=>
       <AppointmentRow
        key={a.id}
        appointment={a}
        data={data}
        onClick={()=>setSelected(a)}
       />
      )}

     </div>

    </details>

   }

  </section>

  {reschedule&&
   <BookingModal
    {...p}
    appointment={reschedule}
    onClose={()=>setReschedule(null)}
   />
  }

  {booking&&
   <BookingModal
    {...p}
    onClose={()=>setBooking(false)}
   />
  }

  {selected&&
   <Modal
    title="Detalhes do atendimento"
    onClose={()=>setSelected(null)}
   >

    <div className="appointment-detail-status">

     <span className={`status ${selected.status}`}>
      {statusLabels[selected.status]}
     </span>

     <small>{statusHelp[selected.status]}</small>

    </div>

    {customer&&
     <div className="appointment-client-card">

      <CustomerAvatar
       customer={customer}
       data={data}
       className="appointment-client-avatar"
      />

      <div>
       <span>CLIENTE</span>
       <strong>
        {firstName(customer.name)}
       </strong>
       <small>
        Perfil, contato e histórico.
       </small>
      </div>

      <button
       type="button"
       className="secondary client-profile-button"
       onClick={()=>setProfileCustomer(customer)}
      >
       Perfil
      </button>

     </div>
    }

    <div className="appointment-detail-grid">

     <div>
      <span>Serviço</span>
      <strong>{service?.name??'Serviço'}</strong>
      <small>
       {service?.duration_minutes??'—'} minutos
      </small>
     </div>

     <div>
      <span>Profissional</span>
      <strong>
       {selectedProfessional?.display_name??'Profissional'}
      </strong>
     </div>

     <div>
      <span>Data</span>
      <strong>
       {new Date(selected.starts_at)
        .toLocaleDateString(
         'pt-BR',
         {timeZone:zone,dateStyle:'long'}
        )}
      </strong>
     </div>

     <div>
      <span>Horário</span>
      <strong>
       {time(selected.starts_at,zone)}
       {' — '}
       {time(selected.ends_at,zone)}
      </strong>
     </div>

     <div>
      <span>Valor</span>
      <strong>
       {selected.subscription_id
        ?'Coberto por assinatura'
        :money(selected.price_cents)}
      </strong>
     </div>

    </div>

    <div className="modal-actions">

     {['scheduled','confirmed']
      .includes(selected.status)&&
      <button
       className="secondary"
       onClick={()=>{
        setReschedule(selected);
        setSelected(null);
       }}
      >
       Remarcar
      </button>
     }

     {['scheduled','confirmed']
      .includes(selected.status)&&
      <button
       className="danger"
       disabled={busy}
       onClick={()=>void transition('cancelled')}
      >
       Cancelar
      </button>
     }

     {['scheduled','confirmed','in_service']
      .includes(selected.status)&&
      new Date(selected.starts_at)<=new Date()&&
      <button
       className="primary"
       disabled={busy}
       onClick={()=>void transition('completed')}
      >
       Finalizar atendimento
      </button>
     }

     {['scheduled','confirmed'].includes(selected.status)&&
      new Date(selected.starts_at)<=new Date()&&
      <button
       className="secondary"
       disabled={busy}
       onClick={()=>void transition('no_show')}
      >
       Registrar falta
      </button>
     }

    </div>

   </Modal>
  }


  {profileCustomer&&
   <Modal
    title="Perfil do cliente"
    onClose={()=>setProfileCustomer(null)}
   >

    <div className="customer-profile-modal">

     <CustomerAvatar
      customer={profileCustomer}
      data={data}
      className="profile-avatar"
     />

     <h3>
      {profileCustomer.name}
     </h3>

     <p className="muted">
      {profileCustomer.phone||
       'Telefone ainda não cadastrado.'}
     </p>

     <small className="customer-profile-origin">
      {profileCustomer.user_id
       ?'Conta conectada ao FIO'
       :'Cadastro da barbearia'}
     </small>

     <div className="profile-stats">

      <div>
       <strong>
        {profileCompleted.length}
       </strong>
       <span>
        concluídos recentes
       </span>
      </div>

      <div>
       <strong>
        {profileUpcoming.length}
       </strong>
       <span>
        próximos horários
       </span>
      </div>

     </div>

     {profileLast&&
      <div className="customer-last-visit">

       <span>
        Último atendimento
       </span>

       <strong>
        {data.services.find(
         s=>s.id===profileLast.service_id
        )?.name??'Serviço'}
       </strong>

       <small>
        {new Date(profileLast.starts_at)
         .toLocaleDateString(
          'pt-BR',
          {timeZone:zone}
         )}
       </small>

      </div>
     }

     {profileCustomer.phone&&
      <a
       className="primary full whatsapp-button"
       href={whats(profileCustomer.phone)}
       target="_blank"
       rel="noreferrer"
      >
       <MessageCircle size={18}/>
       Chamar no WhatsApp
      </a>
     }

    </div>

   </Modal>
  }

 </>;
}
export function Agenda(p:WorkspaceProps){
 return p.data.membership.role==='CLIENT'?<ClientAgenda {...p}/>:<StaffAgenda {...p}/>;
}

export function Services(p:WorkspaceProps){
 const {data}=p,[modal,setModal]=useState(false),[editing,setEditing]=useState<Service|null>(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[price,setPrice]=useState('65'),[duration,setDuration]=useState('45'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');const values={name,description:description.trim(),duration_minutes:Number(duration),price_cents:Math.round(Number(price)*100)};try{if(p.demo){p.updateDemo(d=>({...d,services:editing?d.services.map(s=>s.id===editing.id?{...s,...values}:s):[...d.services,{...values,id:crypto.randomUUID(),active:true}]}));}else{await api(editing?`/services/${editing.id}`:'/services',data.shop.id,values,editing?'PATCH':'POST');await p.refresh();}setModal(false);p.notify('Serviço salvo com sucesso.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function open(service?:Service){setEditing(service??null);setName(service?.name??'');setDescription(service?.description??'');setPrice(service?String(service.price_cents/100):'65');setDuration(service?String(service.duration_minutes):'45');setError('');setModal(true);}
 return <><PageTitle eyebrow="CATÁLOGO" title="Serviços" description="Nome, descrição, valor e duração para o cliente saber exatamente o que está escolhendo." action={data.membership.role==='OWNER'&&<button className="primary" onClick={()=>open()}><Plus size={18}/>Novo serviço</button>}/>{data.services.length?<div className="service-list">{data.services.filter(s=>s.active).map((s,i)=><div className="service-row" key={s.id}><span className="service-number">{String(i+1).padStart(2,'0')}</span><div className="service-name"><h2>{s.name}</h2>{s.description&&<p className="service-description">{s.description}</p>}<span><Clock3 size={14}/>{s.duration_minutes} minutos</span></div><strong>{money(s.price_cents)}</strong>{data.membership.role==='OWNER'&&<button className="icon-button" aria-label={`Editar ${s.name}`} onClick={()=>open(s)}><SlidersHorizontal size={18}/></button>}</div>)}</div>:<Empty title="Seu catálogo começa aqui">Adicione o primeiro serviço.</Empty>}{modal&&<Modal title={editing?'Editar serviço':'Novo serviço'} onClose={()=>setModal(false)}><form onSubmit={submit}><Field label="Nome"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Descrição para o cliente"><textarea maxLength={500} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: corte social com acabamento e barba alinhada na navalha."/><span className="field-counter">{description.length}/500</span></Field><div className="form-grid"><Field label="Valor (R$)"><input required type="number" min="0" max="10000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></Field><Field label="Duração (minutos)"><input required type="number" min="10" max="240" value={duration} onChange={e=>setDuration(e.target.value)}/></Field></div>{error&&<p className="notice" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Salvando…':'Salvar serviço'}</button></form></Modal>}</>;
}
export function Customers(p:WorkspaceProps){
 const [search,setSearch]=useState(''),[modal,setModal]=useState(false),[selected,setSelected]=useState<(typeof p.data.customers)[number]|null>(null),[name,setName]=useState(''),[phone,setPhone]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{if(p.demo)p.updateDemo(d=>({...d,customers:[...d.customers,{id:crypto.randomUUID(),name,phone,user_id:null}]}));else{await api('/customers',p.data.shop.id,{name,phone:phone||undefined});await p.refresh();}setModal(false);setName('');setPhone('');p.notify('Cliente cadastrado.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const customers=p.data.customers.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||(c.phone??'').includes(search));
 return <><PageTitle eyebrow="CADASTRO" title={p.data.membership.role==='OWNER'?'Clientes':'Meus clientes'} description="Contatos, atendimentos e assinaturas em um só lugar." action={p.data.membership.role==='OWNER'&&<button className="primary" onClick={()=>setModal(true)}><Plus size={18}/>Novo cliente</button>}/><label className="search-input"><Search size={18}/><input aria-label="Buscar cliente" placeholder="Buscar por nome ou telefone" value={search} onChange={e=>setSearch(e.target.value)}/></label>{customers.length?<div className="people-list">{customers.map(c=><button key={c.id} className="person-row person-button" onClick={()=>setSelected(c)}><span className="avatar">{c.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><h3>{c.name}</h3><p>{c.phone|| (c.user_id?'Conta conectada':'Cadastro da barbearia')}</p></div><span className="muted">{p.data.appointments.filter(a=>a.client_id===c.id&&a.status==='completed').length} atendimentos</span></button>)}</div>:<Empty title="Nenhum cliente encontrado">{search?'Tente outro nome.':'Seus clientes aparecerão aqui.'}</Empty>}{selected&&<Modal title="Perfil do cliente" onClose={()=>setSelected(null)}><div className="profile-detail"><span className="avatar profile-avatar">{selected.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><h3>{selected.name}</h3><p className="muted">{selected.phone||'Telefone ainda não cadastrado.'}</p><div className="profile-stats"><div><strong>{p.data.appointments.filter(a=>a.client_id===selected.id&&a.status==='completed').length}</strong><span>atendimentos</span></div><div><strong>{p.data.subscriptions.find(x=>x.client_id===selected.id&&x.status==='active')?.remaining_cuts??0}</strong><span>cortes no plano</span></div></div>{selected.phone&&<a className="primary full whatsapp-button" href={whats(selected.phone)} target="_blank" rel="noreferrer"><MessageCircle size={18}/>Chamar no WhatsApp</a>}</div></Modal>}{modal&&<Modal title="Novo cliente" onClose={()=>setModal(false)}><form onSubmit={submit}><Field label="Nome do cliente"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="WhatsApp / telefone"><input type="tel" inputMode="tel" minLength={8} maxLength={24} placeholder="(61) 99999-9999" value={phone} onChange={e=>setPhone(e.target.value)}/></Field>{error&&<p role="alert" className="notice">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Salvando…':'Salvar cliente'}</button></form></Modal>}</>;
}
export function Team(p:WorkspaceProps){
 const owner=p.data.membership.role==='OWNER';
 const [modal,setModal]=useState(false),[selected,setSelected]=useState<(typeof p.data.team)[number]|null>(null),[name,setName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function createStaff(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('/staff',p.data.shop.id,{name,email,phone,temporaryPassword:password});await p.refresh();setModal(false);setName('');setEmail('');setPhone('');setPassword('');p.notify('Acesso do profissional criado.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const [staffEmail,setStaffEmail]=useState(''),[accessError,setAccessError]=useState('');
 useEffect(()=>{let active=true;setStaffEmail('');setAccessError('');if(owner&&selected?.role==='BARBER')void api<{email:string}>(`/staff/${selected.user_id}/access`,p.data.shop.id).then(r=>{if(active)setStaffEmail(r.email);}).catch(e=>{if(active)setAccessError(e.message);});return()=>{active=false;};},[selected?.user_id,owner,p.data.shop.id]);
 const people=p.data.team.filter(m=>m.role!=='CLIENT');
 return <><PageTitle eyebrow="PROFISSIONAIS" title={p.data.membership.role==='CLIENT'?'Quem cuida de você':'Equipe'} description={p.data.membership.role==='CLIENT'?'Veja os profissionais e fale com a barbearia quando precisar.':'Contatos e desempenho da equipe.'} action={owner?<button className="primary" onClick={()=>setModal(true)}><Plus size={18}/>Adicionar profissional</button>:undefined}/><div className="people-list">{people.map(m=>{const reviews=p.data.reviews.filter(r=>r.barber_id===m.user_id),avg=reviews.length?reviews.reduce((a,b)=>a+b.rating,0)/reviews.length:0;return <button className="person-row person-button" key={m.user_id} onClick={()=>setSelected(m)}><MemberAvatar member={m}/><div><h3>{m.display_name}</h3><p>{m.role==='OWNER'?'Responsável pela barbearia':m.phone||'Profissional'}</p></div>{m.role==='BARBER'&&reviews.length>0?<span className="rating-chip"><Star size={14} fill="currentColor"/>{avg.toFixed(1)} · {reviews.length}</span>:<span className="status">{m.role==='OWNER'?'Responsável':'Ativo'}</span>}</button>})}</div>{selected&&<Modal title="Contato" onClose={()=>setSelected(null)}><div className="profile-detail"><MemberAvatar member={selected} className="profile-avatar"/><h3>{selected.display_name}</h3><p className="muted">{selected.role==='OWNER'?'Responsável pela barbearia':'Profissional da equipe'}</p><p>{selected.phone||'Telefone ainda não cadastrado.'}</p>{owner&&selected.role==='BARBER'&&<div className="settings-readonly"><span>E-mail de acesso</span><strong>{staffEmail||accessError||'Consultando…'}</strong><p>A senha não pode ser consultada. O profissional recupera o acesso pelo próprio e-mail.</p>{staffEmail&&<button className="secondary" onClick={()=>void navigator.clipboard.writeText(`${window.location.origin}/login?audience=staff&mode=forgot&email=${encodeURIComponent(staffEmail)}`).then(()=>p.notify('Link de recuperação copiado para enviar ao profissional.')).catch(()=>p.notify('Não foi possível copiar. Oriente o profissional a usar Esqueci minha senha.'))}>Copiar link de recuperação</button>}</div>}{selected.phone&&<a className="primary full whatsapp-button" href={whats(selected.phone)} target="_blank" rel="noreferrer"><MessageCircle size={18}/>Chamar no WhatsApp</a>}</div></Modal>}{owner&&modal&&<Modal title="Novo profissional" onClose={()=>setModal(false)}><form onSubmit={createStaff}><p className="muted compact-copy">Crie o acesso e entregue ao profissional. A senha não fica salva pelo FIO.</p><Field label="Nome"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="E-mail"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="WhatsApp / telefone"><input type="tel" inputMode="tel" required minLength={8} maxLength={24} value={phone} onChange={e=>setPhone(e.target.value)}/></Field><Field label="Senha inicial"><input type="password" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></Field>{error&&<p role="alert" className="notice">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Criando acesso…':'Criar acesso'}</button></form></Modal>}</>;
}
export function Subscriptions(p:WorkspaceProps){
 const owner=p.data.membership.role==='OWNER',canManagePlans=owner&&planAllows(p.data.plan,'client_plans');
 const [planModal,setPlanModal]=useState(false),[assignModal,setAssignModal]=useState(false),[clientId,setClientId]=useState(p.data.customers[0]?.id??''),[planId,setPlanId]=useState(p.data.subscriptionPlans[0]?.id??''),[name,setName]=useState(''),[planDescription,setPlanDescription]=useState(''),[cuts,setCuts]=useState('4'),[days,setDays]=useState('30'),[price,setPrice]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function createPlan(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('/subscription-plans',p.data.shop.id,{name,description:planDescription,cuts:Number(cuts),validityDays:Number(days),priceCents:Math.round(Number(price.replace(',','.'))*100)});await p.refresh();setPlanModal(false);setName('');setPlanDescription('');setPrice('');p.notify('Plano publicado para os clientes.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function assign(e:FormEvent){e.preventDefault();if(!clientId||!planId)return;setBusy(true);setError('');try{await api('/subscriptions/from-plan',p.data.shop.id,{clientId,planId,confirmed:true});await p.refresh();setAssignModal(false);p.notify('Assinatura adicionada ao cliente.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const active=p.data.subscriptions.filter(s=>s.status==='active'&&new Date(s.expires_at)>new Date());
 const visiblePlans=owner||planAllows(p.data.plan,'client_plans')?p.data.subscriptionPlans.filter(x=>x.active):[];
 return <><PageTitle eyebrow="PLANOS DA BARBEARIA" title={owner?'Assinaturas':'Minha assinatura'} description={owner?'Organize pacotes, validade e cortes restantes. Pagamentos são combinados diretamente com a barbearia.':'Acompanhe seus cortes e a validade do pacote. O FIO não cobra pelos serviços da barbearia.'} action={canManagePlans?<div className="page-actions"><button className="secondary" onClick={()=>setAssignModal(true)}><UserRound size={17}/>Adicionar a cliente</button><button className="primary" onClick={()=>setPlanModal(true)}><Plus size={17}/>Novo plano</button></div>:undefined}/>{owner&&!canManagePlans&&<section className="feature-upgrade-note"><Crown size={18}/><div><strong>Planos para clientes entram no FIO PRO.</strong><p>Os cadastros existentes continuam preservados; novas ofertas ficam disponíveis quando a barbearia estiver em PRO ou PREMIUM.</p></div></section>}<div className="section-title"><h2>Planos disponíveis</h2><span className="muted">{visiblePlans.length} publicado{visiblePlans.length===1?'':'s'}</span></div>{visiblePlans.length?<div className="subscription-grid">{visiblePlans.map(plan=><article key={plan.id} className="subscription-card plan-catalog-card"><span className="eyebrow">PLANO</span><h2>{plan.name}</h2><strong>{money(plan.price_cents)}</strong><p>{plan.cuts} corte{plan.cuts===1?'':'s'} · {plan.validity_days} dias de validade</p>{plan.description&&<p className="plan-description">{plan.description}</p>}{!owner&&p.data.shop.whatsapp&&<a className="primary full whatsapp-button" target="_blank" rel="noreferrer" href={`${whats(p.data.shop.whatsapp)}?text=${encodeURIComponent(`Olá! Quero assinar o plano ${plan.name} pelo FIO.`)}`}><MessageCircle size={17}/>Quero assinar</a>}</article>)}</div>:<Empty title="Nenhum plano disponível">{owner?(canManagePlans?'Crie o primeiro plano para ele aparecer aos clientes.':'Seu plano FIO atual não inclui novas ofertas para clientes.'):'A barbearia ainda não publicou planos para o seu acesso.'}</Empty>}<div className="section-title subscriptions-active-title"><h2>{owner?'Clientes com assinatura':'Sua assinatura ativa'}</h2><span className="muted">{active.length} ativa{active.length===1?'':'s'}</span></div>{active.length?<div className="subscription-grid">{active.map(s=><article key={s.id} className="subscription-card"><span className="eyebrow">ASSINATURA ATIVA</span><h2>{s.name}</h2>{owner&&s.client_id&&<p>{p.data.customers.find(c=>c.id===s.client_id)?.name??'Cliente'}</p>}<strong>{s.remaining_cuts}<span> cortes restantes</span></strong><p>Até {new Date(s.expires_at).toLocaleDateString('pt-BR',{timeZone:p.data.shop.timezone})}</p></article>)}</div>:<Empty title={owner?'Nenhum cliente com assinatura ativa':'Você não tem assinatura ativa'}/>} {canManagePlans&&planModal&&<Modal title="Novo plano para clientes" onClose={()=>setPlanModal(false)}><form onSubmit={createPlan}><Field label="Nome do plano"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Descrição do plano"><textarea rows={4} maxLength={700} value={planDescription} onChange={e=>setPlanDescription(e.target.value)} placeholder="Explique o que está incluso, para quem é o plano e como ele funciona."/><span className="field-counter">{planDescription.length}/700</span></Field><div className="form-grid"><Field label="Cortes"><input inputMode="numeric" required value={cuts} onChange={e=>setCuts(e.target.value.replace(/\D/g,''))}/></Field><Field label="Validade (dias)"><input inputMode="numeric" required value={days} onChange={e=>setDays(e.target.value.replace(/\D/g,''))}/></Field></div><Field label="Preço (R$)"><input inputMode="decimal" required value={price} onChange={e=>setPrice(e.target.value.replace(/[^0-9,.]/g,''))}/></Field>{error&&<p className="notice" role="alert">{error}</p>}<button className="primary full" disabled={busy}>Publicar plano</button></form></Modal>} {canManagePlans&&assignModal&&<Modal title="Adicionar assinatura ao cliente" onClose={()=>setAssignModal(false)}><form onSubmit={assign}><Field label="Cliente"><select required value={clientId} onChange={e=>setClientId(e.target.value)}>{p.data.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Plano"><select required value={planId} onChange={e=>setPlanId(e.target.value)}>{p.data.subscriptionPlans.filter(x=>x.active).map(plan=><option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price_cents)}</option>)}</select></Field>{error&&<p className="notice" role="alert">{error}</p>}<button className="primary full" disabled={busy||!clientId||!planId}>Confirmar assinatura</button></form></Modal>}</>;
}
export function Communication(p:WorkspaceProps){
 const [modal,setModal]=useState(false),[title,setTitle]=useState(''),[body,setBody]=useState(''),[audience,setAudience]=useState<'CLIENT'|'BARBER'|'ALL'>('CLIENT'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function create(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{if(p.demo){p.notify('Campanha criada na demonstração.');setModal(false);return;}await api('/campaigns',p.data.shop.id,{title,body,audience});await p.refresh();setModal(false);setTitle('');setBody('');p.notify('Rascunho criado.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function publish(id:string){if(!confirm('Publicar esta comunicação agora para o público selecionado?'))return;setBusy(true);try{if(p.demo){p.notify('Publicação simulada na demonstração.');return;}await api(`/campaigns/${id}/publish`,p.data.shop.id,{confirmed:true});await p.refresh();p.notify('Comunicação publicada e notificações internas criadas.');}catch(e){p.notify((e as Error).message);}finally{setBusy(false);}}
 return <><PageTitle eyebrow="PERTO DE QUEM IMPORTA" title="Comunicação" description="Avisos internos para clientes e equipe. WhatsApp/e-mail entram depois via provedor." action={<button className="primary" onClick={()=>setModal(true)}><Plus size={18}/>Nova comunicação</button>}/>{p.data.campaigns.length?<div className="people-list">{p.data.campaigns.map(c=><div className="person-row" key={c.id}><div><h3>{c.title}</h3><p>{c.body}</p><small className="muted">Público: {c.audience} · {c.status==='published'?'Publicado':'Rascunho'}</small></div>{c.status==='draft'&&<button className="secondary" disabled={busy} onClick={()=>publish(c.id)}>Publicar</button>}</div>)}</div>:<Empty title="Nenhuma comunicação criada">Crie avisos para aparecerem como notificações dentro do FIO.</Empty>}{modal&&<Modal title="Nova comunicação" onClose={()=>setModal(false)}><form onSubmit={create}><Field label="Título"><input required minLength={2} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Mensagem"><textarea required maxLength={1000} rows={5} value={body} onChange={e=>setBody(e.target.value)}/></Field><Field label="Público"><select value={audience} onChange={e=>setAudience(e.target.value as 'CLIENT'|'BARBER'|'ALL')}><option value="CLIENT">Clientes</option><option value="BARBER">Equipe</option><option value="ALL">Todos</option></select></Field>{error&&<p className="notice" role="alert">{error}</p>}<button className="primary full" disabled={busy}>Salvar rascunho</button></form></Modal>}</>;
}
export function Support(p:WorkspaceProps){
 const [section,setSection]=useState<'home'|'terms'|'privacy'|'feedback'>('home');
 const [category,setCategory]=useState<'feedback'|'problem'|'question'>('feedback');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const owner=p.data.team.find(member=>member.role==='OWNER');
 const contact=p.data.shop.whatsapp||owner?.phone||'';
 async function sendFeedback(e:FormEvent){
  e.preventDefault();
  const text=message.trim();
  if(text.length<3)return;
  setBusy(true);setError('');
  try{
   await api('/support/feedback',p.data.shop.id,{category,message:text});
   setMessage('');setSection('home');p.notify('Mensagem enviada. Obrigado por ajudar a melhorar o FIO.');
  }catch{setError('Não foi possível enviar agora. Tente novamente em instantes.');}
  finally{setBusy(false);}
 }
 if(section==='terms')return <><button className="settings-back" data-tour="support-back" type="button" onClick={()=>setSection('home')}><ArrowLeft size={16}/>Voltar para ajuda</button><PageTitle eyebrow="AJUDA E SUPORTE" title="Termos de uso" description="Um resumo claro das regras para usar o FIO."/><section className="support-document"><h2>Uso da conta</h2><p>Cada pessoa deve usar a própria conta e manter seus dados de acesso protegidos. O responsável pela barbearia administra equipe, serviços e configurações do espaço.</p><h2>Agendamentos e informações</h2><p>O FIO organiza informações fornecidas pela barbearia e pelos usuários. Preços, horários, serviços e regras comerciais são definidos pela própria barbearia.</p><h2>Planos e recursos</h2><p>Alguns recursos dependem do plano FIO ativo da barbearia. Quando um recurso não faz parte do plano atual, ele pode deixar de aparecer até que o acesso esteja disponível novamente.</p><h2>Uso responsável</h2><p>Não é permitido tentar acessar contas, dados ou áreas para as quais você não recebeu autorização, nem usar o serviço para fraude, abuso ou atividades ilegais.</p><div className="support-legal-note"><Info size={17}/><span>Este texto é uma versão inicial para uso dentro do produto. Antes de uma operação comercial maior, vale revisar os termos com orientação jurídica.</span></div></section></>;
 if(section==='privacy')return <><button className="settings-back" data-tour="support-back" type="button" onClick={()=>setSection('home')}><ArrowLeft size={16}/>Voltar para ajuda</button><PageTitle eyebrow="AJUDA E SUPORTE" title="Privacidade" description="Como os dados do seu espaço são usados no FIO."/><section className="support-document"><h2>Dados necessários</h2><p>O FIO usa os dados necessários para autenticação, perfil, agendamentos, serviços, equipe, assinaturas e recursos escolhidos pela barbearia.</p><h2>Fotos e arquivos</h2><p>Imagens de perfil, identidade visual e feed são reduzidas e convertidas para um formato otimizado antes do envio, diminuindo armazenamento e tráfego sem precisar guardar a foto original em alta resolução.</p><h2>Separação entre barbearias</h2><p>O acesso é vinculado à barbearia e ao papel de cada usuário. Recursos do servidor e regras do banco reforçam essa separação além do que aparece na interface.</p><h2>Controle</h2><p>Você pode atualizar seus dados de perfil e encerrar sua sessão a qualquer momento. Pedidos que exigem exclusão permanente precisam passar por um fluxo seguro de confirmação.</p><div className="support-legal-note"><Shield size={17}/><span>Nunca compartilhe senha, código de confirmação ou dados de pagamento por mensagens de suporte.</span></div></section></>;
 if(section==='feedback')return <><button className="settings-back" data-tour="support-back" type="button" onClick={()=>setSection('home')}><ArrowLeft size={16}/>Voltar para ajuda</button><PageTitle eyebrow="AJUDA E SUPORTE" title="Fale com o FIO" description="Conte uma ideia, dúvida ou problema sem precisar explicar detalhes técnicos."/><section className="settings-card support-feedback-card"><form onSubmit={sendFeedback}><Field label="Assunto"><select value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option value="feedback">Sugestão / feedback</option><option value="problem">Reportar um problema</option><option value="question">Dúvida sobre o FIO</option></select></Field><Field label="Mensagem"><textarea data-tour="feedback-message" rows={6} minLength={3} maxLength={1500} required value={message} onChange={e=>setMessage(e.target.value)} placeholder="Explique com suas palavras o que aconteceu ou o que você gostaria de melhorar."/><span className="field-counter">{message.length}/1500</span></Field>{error&&<p className="notice" role="alert">{error}</p>}<button data-tour="feedback-send" className="primary full" disabled={busy||message.trim().length<3}><Send size={17}/>{busy?'Enviando…':'Enviar mensagem'}</button></form></section></>;
 return <><PageTitle eyebrow="CENTRAL DE AJUDA" title="Ajuda e suporte" description="Tudo que você precisa para usar o FIO com mais segurança e clareza."/><button className="secondary" onClick={()=>window.dispatchEvent(new Event('fio-tour-restart'))}>Rever tutorial do FIO</button><div className="support-grid"><button className="support-card" onClick={()=>setSection('terms')}><span><FileText size={20}/></span><div><strong>Termos de uso</strong><p>Entenda as regras gerais para usar sua conta e os recursos do FIO.</p></div><ArrowUpRight size={18}/></button><button className="support-card" onClick={()=>setSection('privacy')}><span><Shield size={20}/></span><div><strong>Privacidade</strong><p>Veja como perfis, imagens, agendamentos e informações são tratados.</p></div><ArrowUpRight size={18}/></button><button className="support-card" data-tour="feedback" onClick={()=>setSection('feedback')}><span><MessageSquareText size={20}/></span><div><strong>Feedback e dúvidas</strong><p>Envie uma ideia ou pergunta para ajudar a melhorar o produto.</p></div><ArrowUpRight size={18}/></button><button className="support-card" onClick={()=>{setCategory('problem');setSection('feedback');}}><span><Bug size={20}/></span><div><strong>Reportar problema</strong><p>Conte o que não funcionou. Você não precisa saber o nome técnico do erro.</p></div><ArrowUpRight size={18}/></button></div>{contact&&<section className="support-contact"><div><span className="eyebrow">BARBEARIA</span><h2>Falar com {owner?.display_name||p.data.shop.name}</h2><p>Dúvidas sobre horários, serviços, preços ou atendimento devem ser tratadas diretamente com a barbearia.</p></div><a className="primary" href={whats(contact)} target="_blank" rel="noreferrer"><MessageCircle size={17}/>Abrir WhatsApp</a></section>}<section className="support-about"><CircleHelp size={18}/><div><strong>Sobre o FIO</strong><p>O FIO organiza a experiência entre barbearia, equipe e clientes. Para assuntos da barbearia, fale com o responsável; para o produto, use o formulário acima.</p></div></section></>;
}

export function Settings(p:WorkspaceProps){
 const owner=p.data.membership.role==='OWNER',solo=p.data.shop.operation_mode==='SOLO',navigate=useNavigate();
 const [section,setSection]=useState<'home'|'profile'|'barbershop'|'plan'|'access'|'account'|'notifications'|'schedule'>('home');
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[section]);
 const [displayName,setDisplayName]=useState(p.data.membership.display_name);
 const [phone,setPhone]=useState(p.data.membership.phone??'');
 const [avatarUrl,setAvatarUrl]=useState(p.data.membership.avatar_url??'');
 const [avatarPath,setAvatarPath]=useState(p.data.membership.avatar_asset_path??'');
 const [title,setTitle]=useState(p.data.shop.public_title??p.data.shop.name);
 const [description,setDescription]=useState(p.data.shop.public_description??'');
 const [logoUrl,setLogoUrl]=useState(p.data.shop.logo_url??'');
 const [coverUrl,setCoverUrl]=useState(p.data.shop.cover_url??'');
 const [backgroundUrl,setBackgroundUrl]=useState(p.data.shop.background_url??'');
 const [accentColor,setAccentColor]=useState(p.data.shop.custom_accent??p.data.shop.accent_color??'#ffffff');
 const [busy,setBusy]=useState(false),[accountEmail,setAccountEmail]=useState('');
 const origin=typeof window==='undefined'?'':window.location.origin;
 const links={gestao:`${origin}/acesso/gestao`,equipe:`${origin}/acesso/equipe`,clientes:`${origin}/${p.data.shop.slug}`};

 useEffect(()=>{let active=true;if(!supabase)return;void supabase.auth.getUser().then(({data})=>{if(active)setAccountEmail(data.user?.email??'');});return()=>{active=false;};},[]);

 async function saveContact(){
  setBusy(true);
  try{await api('/profile/contact',p.data.shop.id,{displayName,phone},'PATCH');await p.refresh();p.notify('Seu perfil foi atualizado.');}
  catch(e){p.notify((e as Error).message);}
  finally{setBusy(false);}
 }
 async function uploadAvatar(file:File|undefined){
  if(!file||!supabase)return;setBusy(true);
  try{
   const optimized=await optimizeImage(file,'avatar');
   const user=(await supabase.auth.getUser()).data.user;if(!user)throw Error('Entre novamente para atualizar a foto.');
   const path=`${p.data.shop.id}/${user.id}/avatar-${Date.now()}.webp`;
   const up=await supabase.storage.from('profile-avatars').upload(path,optimized,{contentType:'image/webp',cacheControl:'31536000',upsert:false});if(up.error)throw up.error;
   const url=supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl;
   await api('/profile/avatar',p.data.shop.id,{avatarUrl:url,avatarPath:path},'PATCH');
   if(avatarPath&&avatarPath!==path)await supabase.storage.from('profile-avatars').remove([avatarPath]);
   setAvatarUrl(url);setAvatarPath(path);await p.refresh();p.notify('Foto de perfil atualizada.');
  }catch{p.notify('Não foi possível atualizar a foto agora. Tente novamente.');}finally{setBusy(false);}
 }
 async function saveBrand(){
  setBusy(true);
  try{await api('/shop/branding',p.data.shop.id,{title,description,logoUrl,coverUrl,backgroundUrl,accentColor},'PATCH');await p.refresh();p.notify('Visual dos clientes atualizado.');}
  catch(e){p.notify((e as Error).message);}
  finally{setBusy(false);}
 }
 async function uploadBrand(file:File|undefined,kind:'logo'|'cover'|'background'){
  if(!file||!supabase)return;setBusy(true);
  try{const optimized=await optimizeImage(file,kind);const user=(await supabase.auth.getUser()).data.user;if(!user)throw Error('Entre novamente para enviar a imagem.');const path=`${p.data.shop.id}/${user.id}/settings-${kind}-${Date.now()}.webp`;const up=await supabase.storage.from('branding-assets').upload(path,optimized,{contentType:'image/webp',cacheControl:'31536000',upsert:false});if(up.error)throw up.error;const url=supabase.storage.from('branding-assets').getPublicUrl(path).data.publicUrl;if(kind==='logo')setLogoUrl(url);if(kind==='cover')setCoverUrl(url);if(kind==='background')setBackgroundUrl(url);p.notify('Imagem otimizada e pronta. Toque em Salvar identidade para publicar.');}catch{p.notify('Não foi possível preparar esta imagem. Tente outra foto.');}finally{setBusy(false);}
 }
 async function copy(value:string){
  try{await navigator.clipboard.writeText(value);p.notify('Link copiado.');}
  catch{p.notify('Não foi possível copiar automaticamente.');}
 }


 const sections=[
  ['profile','Meu perfil',UserRound],
  ...(owner?[[ 'barbershop',solo?'Perfil profissional':'Barbearia',Store] as const,['plan','Plano FIO',Crown] as const]:[]),
  ...(p.data.membership.role!=='CLIENT'?[['access','Acessos e app',ShieldCheck] as const]:[]),
  ['account','Conta e segurança',KeyRound],
  ['notifications','Notificações',MessageCircle],
  ...(owner&&!solo?[['schedule','Equipe e horários',CalendarDays] as const]:[]),
 ] as const;

 return <>
  <button className="settings-back" type="button" onClick={()=>section==='home'?navigate(p.base):setSection('home')}><ArrowLeft size={16}/>Voltar</button>
  <PageTitle eyebrow="CONFIGURAÇÕES" title="Configurações" description="Cuide da sua conta e personalize seu espaço."/>
  <div className={`settings-workspace category-settings ${section==='home'?'at-home':'in-category'}`}>
   <nav className="settings-nav" aria-label="Seções das configurações">
    {sections.map(([key,label,Icon])=><button key={key} type="button" className={section===key?'active':''} onClick={()=>setSection(key)}><Icon size={17}/><span>{label}</span></button>)}
   </nav>

   <div className="settings-content">{section==='schedule'&&owner&&<StaffSchedule {...p}/>} {section==='notifications'&&<PushSettings {...p}/>}<div className="settings-shortcuts">{owner&&!solo&&<button className="secondary" onClick={()=>navigate(p.base+'/equipe')}><Users size={17}/>Equipe</button>}<button className="secondary" onClick={()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';window.dispatchEvent(new CustomEvent('fio-theme-change',{detail:next}));}}><Palette size={17}/>Alternar aparência</button><button className="secondary" onClick={()=>navigate(p.base+'/suporte')}><CircleHelp size={17}/>Ajuda</button></div>
    {section==='profile'&&<>
     <section className="settings-card settings-profile-card">
      <div className="settings-profile-head">
       <span className="avatar settings-avatar">{avatarUrl?<img src={avatarUrl} alt="Foto de perfil"/>:p.data.membership.display_name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>
       <div><h2>{p.data.membership.display_name}</h2><p className="muted">{owner?(solo?'Barbeiro solo':'Responsável pela barbearia'):p.data.membership.role==='BARBER'?'Profissional da equipe':'Cliente'}</p></div>
      </div>
      <label className="profile-photo-action"><ImagePlus size={16}/><span>Alterar foto de perfil</span><input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadAvatar(e.target.files?.[0])}/></label>
      {accountEmail&&<div className="settings-readonly"><span>E-mail da conta</span><strong>{accountEmail}</strong></div>}
      <Field label="Seu nome"><input minLength={2} maxLength={100} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></Field>
      <Field label="WhatsApp / telefone"><input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(61) 99999-9999"/></Field>
      <button className="primary" disabled={busy||displayName.trim().length<2} onClick={saveContact}>{busy?'Salvando…':'Salvar meu perfil'}</button>
     </section>
     <section className="settings-card">
      <div className="section-title"><h2>Aplicativo</h2><span className="muted">{owner?'FIO Gestão':p.data.membership.role==='BARBER'?'FIO Equipe':'App da barbearia'}</span></div>
      <p className="muted">Instale o FIO para abrir direto pela tela inicial sem depender de procurar o link novamente.</p>
      <button className="secondary" onClick={()=>void p.installApp?.()}><Download size={16}/>{p.canInstall?'Instalar aplicativo':'Como instalar'}</button>
     </section>
    </>}

    {section==='barbershop'&&owner&&<>
     <section className="settings-card branding-card">
      <div className="section-title"><h2>{solo?'Identidade profissional':'Identidade da barbearia'}</h2><span className="muted">O que o cliente vê.</span></div>
      <Field label="Nome exibido"><input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></Field>
      <Field label="Descrição"><textarea maxLength={280} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Uma frase curta sobre a barbearia."/></Field>
      <div className="branding-upload-grid">
       <label className="branding-upload"><span>Logo</span>{logoUrl&&<img className="branding-thumbnail" src={logoUrl} alt="Prévia: Logo"/>}<small>{logoUrl?'Imagem selecionada':'Escolher da galeria'}</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadBrand(e.target.files?.[0],'logo')}/></label>
       <label className="branding-upload"><span>Capa</span>{coverUrl&&<img className="branding-thumbnail" src={coverUrl} alt="Prévia: Capa"/>}<small>{coverUrl?'Imagem selecionada':'Escolher da galeria'}</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadBrand(e.target.files?.[0],'cover')}/></label>
       <label className="branding-upload"><span>Fundo</span>{backgroundUrl&&<img className="branding-thumbnail" src={backgroundUrl} alt="Prévia: Fundo"/>}<small>{backgroundUrl?'Imagem selecionada':'Escolher da galeria'}</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadBrand(e.target.files?.[0],'background')}/></label>
      </div>
      <Field label="Cor principal"><div className="color-field"><input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)}/><input value={accentColor} maxLength={7} pattern="#[0-9A-Fa-f]{6}" onChange={e=>setAccentColor(e.target.value)}/></div></Field>
      <div className="branding-preview" style={{'--preview-accent':accentColor,'--preview-accent-contrast':accentContrast(accentColor),backgroundImage:backgroundUrl?`linear-gradient(#0009,#000b),url(${backgroundUrl})`:undefined} as CSSProperties}>
       <span style={{backgroundImage:logoUrl?`url(${logoUrl})`:undefined}}>{!logoUrl?'LOGO':''}</span>
       <div><strong>{title||p.data.shop.name}</strong><small>{description||'Prévia da experiência do cliente.'}</small></div>
       <button type="button">Agendar</button>
      </div>
      <button className="primary" disabled={busy} onClick={saveBrand}><Palette size={16}/>{busy?'Salvando…':'Salvar identidade'}</button>
     </section>
     <section className="settings-card">
      <div className="section-title"><h2>Site e app dos clientes</h2><span className="muted">Links separados para divulgar e acessar.</span></div>
      <div className="share-links">
       <button onClick={()=>copy(links.clientes)}><LinkIcon size={17}/><div><span>Site público / link da bio</span><small>{links.clientes}</small></div><Copy size={16}/></button>
      </div>
      <p className="muted settings-help">A logo da barbearia identifica a experiência instalada pelos clientes.</p>
     </section>
    </>}

    {section==='plan'&&owner&&<>
     <section className="settings-card">
      <div className="section-title"><h2>Assinatura FIO</h2><span className="muted">{p.data.plan}</span></div>
      <div className="settings-plan-summary"><span className="settings-plan-icon"><Crown size={20}/></span><div><strong>FIO {p.data.plan}</strong><small>{p.data.fioSubscription.status==='trialing'&&p.data.fioSubscription.trial_ends_at?`Teste grátis até ${new Date(p.data.fioSubscription.trial_ends_at).toLocaleDateString('pt-BR')}`:p.data.fioSubscription.current_period_end?`Período atual até ${new Date(p.data.fioSubscription.current_period_end).toLocaleDateString('pt-BR')}`:'Plano atual da barbearia'}</small></div></div>
      <p className="muted">Compare FREE, PRO e PREMIUM, escolha entre mensal ou anual e acompanhe o período ativo.</p>
      <button className="primary" onClick={()=>navigate(`${p.base}/plano-fio`)}><Crown size={16}/>Ver planos do FIO</button>
     </section>
    </>}

    {section==='access'&&p.data.membership.role!=='CLIENT'&&<>
     <section className="settings-card">
      <div className="section-title"><h2>Links de acesso</h2><span className="muted">Prontos para enviar.</span></div>
      <div className="share-links">
       {owner&&<button onClick={()=>copy(links.gestao)}><LinkIcon size={17}/><div><span>FIO Gestão</span><small>{links.gestao}</small></div><Copy size={16}/></button>}
       {owner&&!solo&&<button onClick={()=>copy(links.equipe)}><LinkIcon size={17}/><div><span>FIO Equipe</span><small>{links.equipe}</small></div><Copy size={16}/></button>}
       <button onClick={()=>copy(links.clientes)}><LinkIcon size={17}/><div><span>Site público / link dos clientes</span><small>{links.clientes}</small></div><Copy size={16}/></button>
      </div>
     </section>
     {owner&&!solo&&<section className="settings-card">
      <div className="section-title"><h2>Equipe e permissões</h2><span className="muted">Controle quem trabalha no espaço.</span></div>
      <p className="muted">Os acessos da equipe continuam separados do acesso do responsável. Adicione e consulte profissionais na área Equipe.</p>
      <button className="secondary" onClick={()=>navigate(`${p.base}/equipe`)}><Users size={16}/>Abrir equipe</button>
     </section>}
    </>}

    {section==='account'&&<>
     <section className="settings-card">
      <div className="section-title"><h2>Alterar senha</h2><span className="muted">Proteja sua conta.</span></div>
      <p>Para escolher outra senha, confirme o acesso ao e-mail da sua conta. Vamos abrir a recuperação segura.</p>
      <a className="primary" href={`/login?mode=forgot&audience=${owner?'owner':p.data.membership.role==='BARBER'?'staff':'client'}&email=${encodeURIComponent(accountEmail)}&shop=${encodeURIComponent(p.data.shop.slug)}`}>Receber link para alterar senha</a>
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
   <div><span>{solo?'Perfil':'Barbearia'}</span><strong>{p.data.shop.name}</strong></div>
   <div><span>Plano FIO</span><strong>{p.data.plan}</strong></div>
   <div><span>Assistente</span><strong>{p.data.aiEnabled?'Incluído':'Indisponível'}</strong></div>
  </section>
 </>;
}







