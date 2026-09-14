import { useEffect,useMemo,useState,type CSSProperties } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { CalendarDays,Download,Scissors,Users,ArrowRight,Clock3,X,Share2,SquarePlus } from 'lucide-react';
import { money } from '../../shared/domain';

type PublicShop={id:string;name:string;slug:string;public_title?:string|null;public_description?:string|null;logo_url?:string|null;cover_url?:string|null;background_url?:string|null;accent_color?:string|null};
type PublicData={shop:PublicShop;services:{id:string;name:string;duration_minutes:number;price_cents:number}[];team:{user_id:string;display_name:string;role:'OWNER'|'BARBER'}[]};
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};

export function PublicPortal(){
 const {slug=''}=useParams(),navigate=useNavigate();
 const [data,setData]=useState<PublicData|null>(null),[error,setError]=useState(''),[installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null),[installGuide,setInstallGuide]=useState(false),[installDismissed,setInstallDismissed]=useState(false);
 useEffect(()=>{
  const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const previous=manifest?.href;
  if(manifest&&slug)manifest.href=`/api/public/manifest/${slug}`;
  const listener=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);};
  window.addEventListener('beforeinstallprompt',listener);
  setInstallDismissed(localStorage.getItem(`fio-public-install:${slug}`)==='1');
  fetch(`/api/public/shop/${encodeURIComponent(slug)}`).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.message||'Não foi possível abrir esta barbearia.');return body as PublicData;}).then(setData).catch(e=>setError((e as Error).message));
  return()=>{window.removeEventListener('beforeinstallprompt',listener);if(manifest&&previous)manifest.href=previous;};
 },[slug]);
 const title=useMemo(()=>data?.shop.public_title||data?.shop.name||'FIO',[data]);
 const standalone=typeof window!=='undefined'&&(window.matchMedia?.('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
 const ios=typeof navigator!=='undefined'&&/iphone|ipad|ipod/i.test(navigator.userAgent);
 async function install(){if(installEvent){await installEvent.prompt();await installEvent.userChoice;setInstallEvent(null);return;}setInstallGuide(true);}
 function dismissInstall(){localStorage.setItem(`fio-public-install:${slug}`,'1');setInstallDismissed(true);}
 if(error)return <div className="public-portal centered-state"><img src="/branding/fio-mark.png" alt="FIO"/><h1>Não foi possível abrir.</h1><p>{error}</p></div>;
 if(!data)return <div className="public-portal centered-state"><img className="pulse-mark" src="/branding/fio-mark.png" alt="FIO"/><p>Preparando seu espaço…</p></div>;
 const accent=data.shop.accent_color||'#ffffff';
 const portalStyle={'--shop-accent':accent,backgroundImage:data.shop.background_url?`linear-gradient(#050505e8,#050505f3),url(${data.shop.background_url})`:undefined} as CSSProperties;
 return <div className="public-portal branded-portal" style={portalStyle}>
  <header className="public-hero" style={data.shop.cover_url?{backgroundImage:`linear-gradient(#0007,#000d),url(${data.shop.cover_url})`}:undefined}>
   <div className="public-brand">{data.shop.logo_url?<img src={data.shop.logo_url} alt={title}/>:<img src="/branding/fio-mark.png" alt="FIO"/>}</div>
   <div className="public-hero-copy"><span className="eyebrow">AGENDE SEU HORÁRIO</span><h1>{title}</h1><p>{data.shop.public_description||'Escolha o serviço, o profissional e o melhor horário.'}</p><button className="primary public-cta brand-button" onClick={()=>navigate(`/login?shop=${encodeURIComponent(slug)}&audience=client`)}><CalendarDays size={18}/> Agendar ou entrar <ArrowRight size={17}/></button></div>
  </header>
  <main className="public-content">
   {!standalone&&!installDismissed&&<section className="public-install-nudge"><div className="install-nudge-icon"><Download size={18}/></div><div><strong>Instale o app de {title}</strong><span>Abra sua agenda direto pela tela inicial.</span></div><button className="install-nudge-action brand-button" onClick={()=>void install()}>{installEvent?'Instalar':ios?'Como instalar':'Instalar app'}</button><button className="install-nudge-close" aria-label="Fechar" onClick={dismissInstall}><X size={16}/></button></section>}
   <section><div className="section-title"><h2><Scissors size={18}/> Serviços</h2></div><div className="public-service-list">{data.services.map(s=><article key={s.id}><div><strong>{s.name}</strong><span><Clock3 size={13}/>{s.duration_minutes} min</span></div><b>{money(s.price_cents)}</b></article>)}</div></section>
   <section><div className="section-title"><h2><Users size={18}/> Profissionais</h2></div><div className="public-team">{data.team.map(m=><div key={m.user_id}><span className="avatar">{m.display_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><strong>{m.display_name}</strong><small>{m.role==='OWNER'?'Responsável':'Barbeiro'}</small></div>)}</div></section>
  </main>
  <footer className="public-footer">Tecnologia FIO</footer>
  {installGuide&&<div className="install-guide-overlay" role="dialog" aria-modal="true"><div className="install-guide-card"><button className="install-guide-close" aria-label="Fechar" onClick={()=>setInstallGuide(false)}><X size={18}/></button><h2>{ios?'Adicionar à Tela de Início':'Instalar aplicativo'}</h2>{ios?<><div className="install-guide-step"><Share2 size={22}/><span><b>1.</b> Toque em <strong>Compartilhar</strong> no Safari.</span></div><div className="install-guide-step"><SquarePlus size={22}/><span><b>2.</b> Escolha <strong>Adicionar à Tela de Início</strong>.</span></div><p>Depois confirme em “Adicionar”. Ele abrirá como aplicativo, sem a barra do navegador.</p></>:<p>Abra o menu do navegador e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</p>}</div></div>}
 </div>;
}
