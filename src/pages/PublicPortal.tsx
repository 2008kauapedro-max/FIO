import { useEffect,useMemo,useState,type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight,CalendarDays,Clock3,Download,ExternalLink,Info,MapPin,MessageCircle,Search,Scissors,Share2,Smartphone,SquarePlus,Users,X } from 'lucide-react';
import { money } from '../../shared/domain';
import { whatsappUrl } from '../../shared/phone';
import { InAppBrowserBanner } from '../components/InAppBrowserBanner';

type PublicShop={id:string;name:string;slug:string;operation_mode?:'SHOP'|'SOLO';public_title?:string|null;public_description?:string|null;logo_url?:string|null;cover_url?:string|null;background_url?:string|null;accent_color?:string|null;theme_mode?:'light'|'dark';palette_key?:string|null;custom_accent?:string|null;whatsapp?:string|null;instagram?:string|null;address?:string|null};
type PublicPalette={light_background:string;light_surface:string;light_text:string;light_text_muted:string;light_accent:string;dark_background:string;dark_surface:string;dark_text:string;dark_text_muted:string;dark_accent:string};
type PublicData={shop:PublicShop;palette?:PublicPalette|null;services:{id:string;name:string;description?:string|null;duration_minutes:number;price_cents:number}[];team:{user_id:string;display_name:string;role:'OWNER'|'BARBER';avatar_url?:string|null}[];subscriptionPlans:{id:string;name:string;description?:string|null;cuts:number;validity_days:number;price_cents:number;active:boolean}[]};
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
type PortalTab='services'|'details'|'team';

function pathSlug(pathname:string){
 const parts=pathname.split('/').filter(Boolean);
 if(parts[0]==='barbearia'||parts[0]==='b')return parts[1]??'';
 return parts[0]??'';
}

function standaloneMode(){
 return typeof window!=='undefined'&&(window.matchMedia?.('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
}

function accentContrast(hex:string){
 const value=hex.replace('#','');
 if(!/^[0-9a-f]{6}$/i.test(value))return '#080808';
 const r=parseInt(value.slice(0,2),16),g=parseInt(value.slice(2,4),16),b=parseInt(value.slice(4,6),16);
 return (r*299+g*587+b*114)/1000<145?'#ffffff':'#080808';
}

export function PublicPortal(){
 const {pathname}=useLocation(),slug=pathSlug(pathname);
 const [data,setData]=useState<PublicData|null>(null),[error,setError]=useState(''),[installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null),[installGuide,setInstallGuide]=useState(false),[installGate,setInstallGate]=useState(false),[installReason,setInstallReason]=useState(''),[installing,setInstalling]=useState(false),[tab,setTab]=useState<PortalTab>('services'),[query,setQuery]=useState('');
 const standalone=standaloneMode();
 const ios=typeof navigator!=='undefined'&&/iphone|ipad|ipod/i.test(navigator.userAgent);
 const android=typeof navigator!=='undefined'&&/android/i.test(navigator.userAgent);

 useEffect(()=>{
  if(!slug){setError('Este endereço não identifica uma barbearia.');return;}
  const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const previous=manifest?.href;
  if(manifest)manifest.href=`/api/public/manifest/${encodeURIComponent(slug)}?v=client-brand-v2`;
  const listener=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);};
  window.addEventListener('beforeinstallprompt',listener);
  let active=true;const controller=new AbortController();
  setData(null);setError('');
  fetch(`/api/public/shop/${encodeURIComponent(slug)}`,{signal:controller.signal,cache:'no-store'}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.message||'Não foi possível abrir este espaço.');return body as PublicData;}).then(result=>{if(active)setData(result);}).catch(()=>{if(active)setError('Não foi possível abrir este espaço agora.');});
  return()=>{active=false;controller.abort();window.removeEventListener('beforeinstallprompt',listener);if(manifest&&previous)manifest.href=previous;};
 },[slug]);

 const title=useMemo(()=>data?.shop.public_title||data?.shop.name||'FIO',[data]);
 useEffect(()=>{
  if(!data)return;
  const oldTitle=document.title;document.title=title;
  let apple=document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  const created=!apple;
  const oldHref=apple?.href;
  if(!apple){apple=document.createElement('link');apple.rel='apple-touch-icon';document.head.appendChild(apple);}
  let favicon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const faviconCreated=!favicon;
  const oldFavicon=favicon?.href;
  if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.appendChild(favicon);}
  if(data.shop.logo_url){apple.href=data.shop.logo_url;favicon.href=data.shop.logo_url;}
  return()=>{document.title=oldTitle;if(created)apple?.remove();else if(apple&&oldHref)apple.href=oldHref;if(faviconCreated)favicon?.remove();else if(favicon&&oldFavicon)favicon.href=oldFavicon;};
 },[data,title]);

 const filteredServices=useMemo(()=>{const q=query.trim().toLocaleLowerCase('pt-BR');return !q?data?.services??[]:(data?.services??[]).filter(service=>`${service.name} ${service.description??''}`.toLocaleLowerCase('pt-BR').includes(q));},[data?.services,query]);
 const goClient=()=>window.location.assign(`/login?shop=${encodeURIComponent(slug)}&audience=client`);
 function requireApp(reason:string){
  if(standalone){goClient();return;}
  setInstallReason(reason);setInstallGate(true);
 }
 async function installAndroid(){
  if(installing)return;
  if(!installEvent){setInstallGuide(true);return;}
  setInstalling(true);
  try{
   await installEvent.prompt();
   const choice=await installEvent.userChoice;
   setInstallEvent(null);
   if(choice.outcome==='accepted')setInstallGate(false);
  }finally{setInstalling(false);}
 }
 function installAction(){
  if(standalone){goClient();return;}
  if(ios){setInstallGuide(true);return;}
  void installAndroid();
 }

 if(error)return <div className="public-portal centered-state"><img src="/FIOlogo/FIObranco.png" alt="FIO"/><h1>Não foi possível abrir.</h1><p>{error}</p></div>;
 if(!data)return <div className="public-portal centered-state"><img className="pulse-mark" src="/FIOlogo/FIObranco.png" alt="FIO"/><p>Preparando seu espaço…</p></div>;

 const dark=data.shop.theme_mode!=='light',p=data.palette;const accent=data.shop.custom_accent||data.shop.accent_color||(dark?p?.dark_accent:p?.light_accent)||'#ff8a00';
 const portalStyle={'--shop-accent':accent,'--shop-accent-contrast':accentContrast(accent),'--public-bg':dark?p?.dark_background||'#080808':p?.light_background||'#f5f5f2','--public-surface':dark?p?.dark_surface||'#111111':p?.light_surface||'#ffffff','--public-text':dark?p?.dark_text||'#f5f5f5':p?.light_text||'#111111','--public-muted':dark?p?.dark_text_muted||'#8d8d8d':p?.light_text_muted||'#666666',backgroundImage:data.shop.background_url?`linear-gradient(${dark?'rgba(0,0,0,.82),rgba(0,0,0,.9)':'rgba(245,245,242,.88),rgba(245,245,242,.94)'}),url(${data.shop.background_url})`:undefined,backgroundSize:data.shop.background_url?'460px auto':undefined,backgroundAttachment:data.shop.background_url?'fixed':undefined} as CSSProperties;
 const providerLabel=data.shop.operation_mode==='SOLO'?'Profissional':'Barbearia';

 return <div className="public-portal branded-portal booking-showcase" style={portalStyle}>
  <InAppBrowserBanner/>
  <header className="booking-showcase-hero" style={data.shop.cover_url?{backgroundImage:`linear-gradient(180deg,rgba(0,0,0,.16),rgba(0,0,0,.84)),url(${data.shop.cover_url})`}:undefined}>
   <div className="booking-showcase-top">
    <span className="booking-showcase-badge">{providerLabel}</span>
    <button type="button" className="booking-install-top" onClick={installAction}><Download size={15}/>{standalone?'Abrir app':'Baixar app'}</button>
   </div>
   <div className="booking-showcase-identity">
    <div className="booking-showcase-logo">{data.shop.logo_url?<img src={data.shop.logo_url} alt={title}/>:<Scissors size={34}/>}</div>
    <div><h1>{title}</h1>{data.shop.address&&<p><MapPin size={13}/>{data.shop.address}</p>}<span>{data.shop.public_description||'Agende seu horário de forma simples.'}</span></div>
   </div>
  </header>

  <nav className="booking-showcase-tabs" aria-label="Informações do estabelecimento">
   <button className={tab==='services'?'active':''} onClick={()=>setTab('services')}><Scissors size={14}/>Serviços</button>
   <button className={tab==='details'?'active':''} onClick={()=>setTab('details')}><Info size={14}/>Detalhes</button>
   <button className={tab==='team'?'active':''} onClick={()=>setTab('team')}><Users size={14}/>Profissionais</button>
  </nav>

  <main className="booking-showcase-content">
   {!standalone&&<section className="booking-app-card">
    <span className="booking-app-icon">{data.shop.logo_url?<img src={data.shop.logo_url} alt=""/>:<Smartphone size={20}/>}</span>
    <div><strong>Tenha {title} no celular</strong><small>Para acessar sua área e agendar, instale o app desta {data.shop.operation_mode==='SOLO'?'agenda':'barbearia'}.</small></div>
    <button className="brand-button" onClick={installAction}>{ios?'Como instalar':'Baixar app'}</button>
   </section>}

   {tab==='services'&&<section className="booking-services-section">
    <label className="booking-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar serviço..." aria-label="Pesquisar serviço"/></label>
    <div className="booking-service-list">
     {filteredServices.map(service=><article key={service.id} className="booking-service-row">
      <span className="booking-service-icon"><Scissors size={18}/></span>
      <div className="booking-service-main"><strong>{service.name}</strong>{service.description&&<p>{service.description}</p>}<div><b>{money(service.price_cents)}</b><span><Clock3 size={12}/>{service.duration_minutes} min</span></div></div>
      <button className="booking-service-action" onClick={()=>requireApp(`Para agendar “${service.name}”, instale primeiro o app de ${title}.`)}>Agendar</button>
     </article>)}
     {!filteredServices.length&&<p className="public-empty">Nenhum serviço encontrado.</p>}
    </div>
   </section>}

   {tab==='details'&&<section className="booking-details-grid">
    <article><span><MapPin size={17}/></span><div><small>LOCAL</small><strong>{data.shop.address||'Endereço informado no atendimento'}</strong></div></article>
    {data.shop.instagram&&<article><span>@</span><div><small>INSTAGRAM</small><strong>@{String(data.shop.instagram).replace(/^@+/,'')}</strong></div></article>}
    {whatsappUrl(data.shop.whatsapp)&&<a href={whatsappUrl(data.shop.whatsapp)!} target="_blank" rel="noreferrer"><span><MessageCircle size={17}/></span><div><small>CONTATO</small><strong>Falar pelo WhatsApp</strong></div><ExternalLink size={15}/></a>}
    <article className="booking-details-about"><div><small>SOBRE</small><strong>{title}</strong><p>{data.shop.public_description||'Serviços e horários organizados para você agendar com poucos toques.'}</p></div></article>
   </section>}

   {tab==='team'&&<section className="booking-team-list">
    {data.team.map(member=><article key={member.user_id}><span className="booking-team-avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:member.display_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><strong>{member.display_name}</strong><small>{member.role==='OWNER'?(data.shop.operation_mode==='SOLO'?'Profissional':'Responsável'):'Barbeiro'}</small></div></article>)}
   </section>}

   {data.subscriptionPlans?.length>0&&tab==='details'&&<section className="booking-plans"><h2>Planos</h2>{data.subscriptionPlans.map(plan=><article key={plan.id}><div><strong>{plan.name}</strong><small>{plan.cuts} corte{plan.cuts===1?'':'s'} · {plan.validity_days} dias</small></div><b>{money(plan.price_cents)}</b></article>)}</section>}
  </main>

  <footer className="booking-powered">
   <div className="booking-powered-card">
    <span className="booking-powered-kicker">TECNOLOGIA POR FIO</span>
    <strong>Crie sua barbearia com o FIO.</strong>
    <p>Tenha seu próprio link, agenda online e app personalizado para seus clientes. Também funciona para barbeiro solo.</p>
    <a href="/login?audience=owner&mode=signup">Começar agora <ArrowRight size={15}/></a>
   </div>
  </footer>

  {installGate&&<div className="client-app-gate" role="dialog" aria-modal="true" aria-label="Instalar aplicativo"><div className="client-app-gate-card">
   <button className="client-app-gate-close" aria-label="Fechar" onClick={()=>setInstallGate(false)}><X size={18}/></button>
   <span className="client-app-gate-logo">{data.shop.logo_url?<img src={data.shop.logo_url} alt=""/>:<Download size={23}/>}</span>
   <p className="eyebrow">APP DO CLIENTE</p><h2>Baixe {title} para continuar.</h2><p>{installReason||'Sua conta, seus agendamentos e seus horários ficam no app desta barbearia.'}</p>
   <button className="primary brand-button" onClick={installAction}>{installing?'Abrindo instalação…':ios?'Ver tutorial no iPhone':installEvent?'Instalar agora':'Como instalar no Android'}</button>
   <small>O app usa o nome e a logo deste estabelecimento.</small>
  </div></div>}

  {installGuide&&<div className="install-guide-overlay" role="dialog" aria-modal="true"><div className="install-guide-card client-install-guide"><button className="install-guide-close" aria-label="Fechar" onClick={()=>setInstallGuide(false)}><X size={18}/></button>
   <span className="client-guide-logo">{data.shop.logo_url?<img src={data.shop.logo_url} alt=""/>:<Download size={23}/>}</span>
   <h2>{ios?'Instale no seu iPhone':android?'Instale no seu Android':'Adicione à tela inicial'}</h2>
   {ios?<><div className="install-guide-step"><Share2 size={20}/><span>1. No Safari, toque em <strong>Compartilhar</strong>.</span></div><div className="install-guide-step"><SquarePlus size={20}/><span>2. Escolha <strong>Adicionar à Tela de Início</strong>.</span></div><div className="install-guide-step"><Download size={20}/><span>3. Confirme em <strong>Adicionar</strong>. A logo de {title} aparecerá no celular.</span></div></>:<><div className="install-guide-step"><Download size={20}/><span>1. Abra esta página no Chrome.</span></div><div className="install-guide-step"><Smartphone size={20}/><span>2. Use <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong> no menu do navegador.</span></div><div className="install-guide-step"><CalendarDays size={20}/><span>3. Abra o novo ícone para acessar sua conta e agendar.</span></div></>}
   <p>O aplicativo instalado fica personalizado com o nome e a logo deste estabelecimento.</p>
  </div></div>}
 </div>;
}
