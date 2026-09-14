import { useEffect,useMemo,useState } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { CalendarDays,Download,Scissors,Users,ArrowRight,Clock3 } from 'lucide-react';
import { money } from '../../shared/domain';

type PublicShop={id:string;name:string;slug:string;public_title?:string|null;public_description?:string|null;logo_url?:string|null;cover_url?:string|null};
type PublicData={shop:PublicShop;services:{id:string;name:string;duration_minutes:number;price_cents:number}[];team:{user_id:string;display_name:string}[]};
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};

export function PublicPortal(){
 const {slug=''}=useParams(),navigate=useNavigate();
 const [data,setData]=useState<PublicData|null>(null),[error,setError]=useState(''),[installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null);
 useEffect(()=>{
  const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const previous=manifest?.href;
  if(manifest&&slug)manifest.href=`/api/public/manifest/${slug}`;
  const listener=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);};
  window.addEventListener('beforeinstallprompt',listener);
  fetch(`/api/public/shop/${encodeURIComponent(slug)}`).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.message||'Não foi possível abrir esta barbearia.');return body as PublicData;}).then(setData).catch(e=>setError((e as Error).message));
  return()=>{window.removeEventListener('beforeinstallprompt',listener);if(manifest&&previous)manifest.href=previous;};
 },[slug]);
 const title=useMemo(()=>data?.shop.public_title||data?.shop.name||'FIO',[data]);
 async function install(){if(installEvent){await installEvent.prompt();await installEvent.userChoice;setInstallEvent(null);return;}alert('No navegador do celular, abra o menu e escolha “Instalar app” ou “Adicionar à tela inicial”.');}
 if(error)return <div className="public-portal centered-state"><img src="/branding/fio-mark.png" alt="FIO"/><h1>Não foi possível abrir.</h1><p>{error}</p></div>;
 if(!data)return <div className="public-portal centered-state"><img className="pulse-mark" src="/branding/fio-mark.png" alt="FIO"/><p>Preparando seu espaço…</p></div>;
 return <div className="public-portal">
  <header className="public-hero" style={data.shop.cover_url?{backgroundImage:`linear-gradient(#0009,#000d),url(${data.shop.cover_url})`}:undefined}>
   <div className="public-brand">{data.shop.logo_url?<img src={data.shop.logo_url} alt={title}/>:<img src="/branding/FIObranco.png" alt="FIO"/>}<button className="ghost-pill" onClick={install}><Download size={16}/> Instalar</button></div>
   <div className="public-hero-copy"><span className="eyebrow">AGENDE SEM COMPLICAÇÃO</span><h1>{title}</h1><p>{data.shop.public_description||'Escolha o serviço, o profissional e o melhor horário. O resto fica com a gente.'}</p><button className="primary public-cta" onClick={()=>navigate(`/login?shop=${encodeURIComponent(slug)}&audience=client`)}><CalendarDays size={18}/> Agendar ou entrar <ArrowRight size={17}/></button></div>
  </header>
  <main className="public-content">
   <section><div className="section-title"><h2><Scissors size={18}/> Serviços</h2></div><div className="public-service-list">{data.services.map(s=><article key={s.id}><div><strong>{s.name}</strong><span><Clock3 size={13}/>{s.duration_minutes} min</span></div><b>{money(s.price_cents)}</b></article>)}</div></section>
   <section><div className="section-title"><h2><Users size={18}/> Profissionais</h2></div><div className="public-team">{data.team.map(m=><div key={m.user_id}><span className="avatar">{m.display_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><strong>{m.display_name}</strong></div>)}</div></section>
   <section className="public-install-card"><img src="/branding/fio-mark.png" alt=""/><div><span className="eyebrow">NO SEU CELULAR</span><h2>Instale como aplicativo.</h2><p>Sem procurar link toda vez. Abra direto pela tela inicial.</p></div><button className="secondary" onClick={install}><Download size={17}/> Instalar app</button></section>
  </main>
  <footer className="public-footer">Tecnologia FIO · simples por fora, completa por dentro.</footer>
 </div>;
}
