import { useEffect,useMemo,useState,type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight,CalendarDays,Clock3,Download,MapPin,MessageCircle,Scissors,Share2,SquarePlus,Users,X } from 'lucide-react';
import { money } from '../../shared/domain';
import { whatsappUrl } from '../../shared/phone';
import { mayOfferInstall } from '../../shared/in-app-browser';
import { InAppBrowserBanner } from '../components/InAppBrowserBanner';

type PublicShop={id:string;name:string;slug:string;public_title?:string|null;public_description?:string|null;logo_url?:string|null;cover_url?:string|null;background_url?:string|null;accent_color?:string|null;theme_mode?:'light'|'dark';palette_key?:string|null;custom_accent?:string|null;whatsapp?:string|null;instagram?:string|null;address?:string|null};
type PublicPalette={light_background:string;light_surface:string;light_text:string;light_text_muted:string;light_accent:string;dark_background:string;dark_surface:string;dark_text:string;dark_text_muted:string;dark_accent:string};
type PublicData={shop:PublicShop;palette?:PublicPalette|null;services:{id:string;name:string;description?:string|null;duration_minutes:number;price_cents:number}[];team:{user_id:string;display_name:string;role:'OWNER'|'BARBER';avatar_url?:string|null}[];subscriptionPlans:{id:string;name:string;description?:string|null;cuts:number;validity_days:number;price_cents:number;active:boolean}[]};
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};

function pathSlug(pathname:string){
 const parts=pathname.split('/').filter(Boolean);
 if(parts[0]==='barbearia'||parts[0]==='b')return parts[1]??'';
 return parts[0]??'';
}

export function PublicPortal(){
 const {pathname}=useLocation(),slug=pathSlug(pathname);
 const [data,setData]=useState<PublicData|null>(null),[error,setError]=useState(''),[installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null),[installGuide,setInstallGuide]=useState(false),[installDismissed,setInstallDismissed]=useState(false);
 useEffect(()=>{
  if(!slug){setError('Este endereço não identifica uma barbearia.');return;}
  const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const previous=manifest?.href;
  if(manifest)manifest.href=`/api/public/manifest/${slug}`;
  const listener=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);};
  window.addEventListener('beforeinstallprompt',listener);
  setInstallDismissed(localStorage.getItem(`fio-public-install:${slug}`)==='1');
  fetch(`/api/public/shop/${encodeURIComponent(slug)}`).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.message||'Não foi possível abrir esta barbearia.');return body as PublicData;}).then(setData).catch(()=>setError('Não foi possível abrir esta barbearia agora.'));
  return()=>{window.removeEventListener('beforeinstallprompt',listener);if(manifest&&previous)manifest.href=previous;};
 },[slug]);
 const title=useMemo(()=>data?.shop.public_title||data?.shop.name||'FIO',[data]);
 const standalone=typeof window!=='undefined'&&(window.matchMedia?.('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
 const ios=typeof navigator!=='undefined'&&/iphone|ipad|ipod/i.test(navigator.userAgent);
 async function install(){localStorage.setItem(`fio-public-install:${slug}`,'1');setInstallDismissed(true);if(installEvent){await installEvent.prompt();await installEvent.userChoice;setInstallEvent(null);return;}setInstallGuide(true);}
 function dismissInstall(){localStorage.setItem(`fio-public-install:${slug}`,'1');setInstallDismissed(true);}
 const goClient=()=>window.location.assign(`/login?shop=${encodeURIComponent(slug)}&audience=client`);
 if(error)return <div className="public-portal centered-state"><img src="/FIOlogo/FIObranco.png" alt="FIO"/><h1>Não foi possível abrir.</h1><p>{error}</p></div>;
 if(!data)return <div className="public-portal centered-state"><img className="pulse-mark" src="/FIOlogo/FIObranco.png" alt="FIO"/><p>Preparando seu espaço…</p></div>;
 const dark=data.shop.theme_mode!=='light',p=data.palette;const accent=data.shop.custom_accent||data.shop.accent_color||(dark?p?.dark_accent:p?.light_accent)||'#ffffff';
 const portalStyle={'--shop-accent':accent,'--public-bg':dark?p?.dark_background||'#050505':p?.light_background||'#f5f5f2','--public-surface':dark?p?.dark_surface||'#0d0d0d':p?.light_surface||'#fff','--public-text':dark?p?.dark_text||'#f4f4f4':p?.light_text||'#111','--public-muted':dark?p?.dark_text_muted||'#777':p?.light_text_muted||'#666',backgroundImage:data.shop.background_url?`linear-gradient(${dark?'#050505f0,#050505f7':'#f5f5f2e8,#f5f5f2f4'}),url(${data.shop.background_url})`:undefined} as CSSProperties;
 return <div className="public-portal branded-portal" style={portalStyle}>
  <InAppBrowserBanner/>
  <header className={`public-hero ${data.shop.cover_url?'has-cover':''}`} style={data.shop.cover_url?{backgroundImage:`linear-gradient(180deg,#0005 0%,#0008 40%,#050505 100%),url(${data.shop.cover_url})`}:undefined}>
   <div className="public-topline"><div className="public-brand">{data.shop.logo_url?<img src={data.shop.logo_url} alt={title}/>:<img src={dark?'/FIOlogo/FIObranco.png':'/FIOlogo/FIOpreto.png'} alt="FIO"/>}</div><button className="public-enter" onClick={goClient}>Área do cliente <ArrowRight size={15}/></button></div>
   <div className="public-hero-copy"><span className="eyebrow">SUA BARBEARIA, NO SEU TEMPO</span><h1>{title}</h1><p>{data.shop.public_description||'Serviços, profissionais e agendamentos em um só lugar.'}</p><div className="public-hero-actions"><button className="primary public-cta brand-button" onClick={goClient}><CalendarDays size={18}/>Agendar horário<ArrowRight size={17}/></button>{whatsappUrl(data.shop.whatsapp)&&<a className="public-secondary-cta" href={whatsappUrl(data.shop.whatsapp)!} target="_blank" rel="noreferrer"><MessageCircle size={17}/>WhatsApp</a>}</div></div>
  </header>
  <main className="public-content">
   {data.shop.logo_url&&mayOfferInstall(navigator.userAgent,standalone)&&!installDismissed&&<section className="public-install-nudge"><div className="install-nudge-icon"><Download size={18}/></div><div><strong>Tenha {title} na tela inicial</strong><span>Abra sua agenda como um aplicativo.</span></div><button className="install-nudge-action brand-button" onClick={()=>void install()}>{installEvent?'Instalar':ios?'Como instalar':'Instalar app'}</button><button className="install-nudge-close" aria-label="Fechar" onClick={dismissInstall}><X size={16}/></button></section>}

   <section className="public-section"><div className="public-section-head"><div><span className="eyebrow">ESCOLHA SEU CUIDADO</span><h2>Serviços</h2></div><span>{data.services.length} opç{data.services.length===1?'ão':'ões'}</span></div>{data.services.length?<div className="public-service-list">{data.services.map(s=><article key={s.id}><div className="public-service-copy"><strong>{s.name}</strong>{s.description&&<p>{s.description}</p>}<span><Clock3 size={13}/>{s.duration_minutes} min</span></div><div className="public-service-price"><b>{money(s.price_cents)}</b><button onClick={goClient} aria-label={`Agendar ${s.name}`}><ArrowRight size={16}/></button></div></article>)}</div>:<p className="public-empty">Os serviços serão publicados em breve.</p>}</section>

   <section className="public-section"><div className="public-section-head"><div><span className="eyebrow">QUEM VAI TE ATENDER</span><h2>Profissionais</h2></div></div><div className="public-team">{data.team.map(m=><div key={m.user_id}>{m.avatar_url?<span className="avatar public-avatar"><img src={m.avatar_url} alt={m.display_name}/></span>:<span className="avatar public-avatar">{m.display_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span>}<strong>{m.display_name}</strong><small>{m.role==='OWNER'?'Responsável':'Profissional'}</small></div>)}</div></section>

   {data.subscriptionPlans?.length>0&&<section className="public-section"><div className="public-section-head"><div><span className="eyebrow">PARA QUEM VOLTA SEMPRE</span><h2>Planos da barbearia</h2></div></div><div className="public-plan-grid">{data.subscriptionPlans.map(plan=><article key={plan.id} className="public-plan-card"><span className="public-plan-kicker">PLANO</span><strong>{plan.name}</strong><b>{money(plan.price_cents)}</b><span>{plan.cuts} corte{plan.cuts===1?'':'s'} · {plan.validity_days} dias</span>{plan.description&&<p>{plan.description}</p>}{whatsappUrl(data.shop.whatsapp)?<a className="brand-button" href={`${whatsappUrl(data.shop.whatsapp)}?text=${encodeURIComponent(`Olá! Quero saber mais sobre o plano ${plan.name}.`)}`} target="_blank" rel="noreferrer">Quero saber mais</a>:<button className="brand-button" onClick={goClient}>Entrar para ver</button>}</article>)}</div></section>}

   {(data.shop.address||data.shop.instagram||data.shop.whatsapp)&&<section className="public-contact-card"><div><span className="eyebrow">ENCONTRE A GENTE</span><h2>Contato</h2>{data.shop.address&&<p><MapPin size={15}/>{data.shop.address}</p>}{data.shop.instagram&&<p>@{String(data.shop.instagram).replace(/^@+/,'')}</p>}</div>{whatsappUrl(data.shop.whatsapp)&&<a className="brand-button" href={whatsappUrl(data.shop.whatsapp)!} target="_blank" rel="noreferrer"><MessageCircle size={17}/>Falar pelo WhatsApp</a>}</section>}
  </main>
  <footer className="public-footer"><span>Experiência organizada por</span><strong>FIO</strong></footer>
  {installGuide&&<div className="install-guide-overlay" role="dialog" aria-modal="true"><div className="install-guide-card"><button className="install-guide-close" aria-label="Fechar" onClick={()=>setInstallGuide(false)}><X size={18}/></button><h2>{ios?'Adicionar à Tela de Início':'Instalar aplicativo'}</h2>{ios?<><div className="install-guide-step"><Share2 size={22}/><span><b>1.</b> Toque em <strong>Compartilhar</strong> no Safari.</span></div><div className="install-guide-step"><SquarePlus size={22}/><span><b>2.</b> Escolha <strong>Adicionar à Tela de Início</strong>.</span></div><p>Depois confirme em “Adicionar”. Ele abrirá como aplicativo, sem a barra do navegador.</p></>:<p>Abra o menu do navegador e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</p>}</div></div>}
 </div>;
}
