import {useEffect,useState} from 'react';
import {useI18n} from '../i18n';

// Barra fina que aparece sempre que o aparelho perde a internet.
// Usa os eventos online/offline do navegador (instantaneos) e, quando uma
// chamada falha por rede com o Wi-Fi ainda "conectado", confirma com /api/health.
type Status='online'|'offline'|'back';
const PROBE_MS=5000;

async function reachable(){
 try{
  const res=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(4000)});
  return res.ok||res.status===429;
 }catch{return false;}
}

function headerBottom(){
 // Encaixa logo abaixo do cabecalho fixo da tela, quando existir.
 for(const el of document.querySelectorAll<HTMLElement>('.topbar, header')){
  const style=getComputedStyle(el);
  if(style.position!=='sticky'&&style.position!=='fixed')continue;
  const rect=el.getBoundingClientRect();
  if(rect.height>0&&rect.top<=1&&rect.bottom>0&&rect.bottom<window.innerHeight/2)return Math.round(rect.bottom);
 }
 return 0;
}

export function OfflineBar(){
 const {t}=useI18n();
 const [status,setStatus]=useState<Status>(()=>typeof navigator!=='undefined'&&navigator.onLine===false?'offline':'online');
 const [top,setTop]=useState(0);

 useEffect(()=>{
  let probing:number|undefined;
  let hideBack:number|undefined;
  const stopProbe=()=>{if(probing!==undefined){window.clearInterval(probing);probing=undefined;}};
  const goOnline=()=>{
   stopProbe();
   setStatus(prev=>{
    if(prev!=='offline')return prev;
    window.clearTimeout(hideBack);
    hideBack=window.setTimeout(()=>setStatus('online'),2500);
    return 'back';
   });
  };
  const goOffline=()=>{
   window.clearTimeout(hideBack);
   setStatus('offline');
   if(probing===undefined)probing=window.setInterval(()=>{void reachable().then(ok=>{if(ok)goOnline();});},PROBE_MS);
  };
  const onOnline=()=>{void reachable().then(ok=>ok?goOnline():goOffline());};
  // Wi-Fi conectado sem internet: o navegador acha que esta online, mas os pedidos falham.
  const originalFetch=window.fetch;
  const patched:typeof fetch=async(...args)=>{
   try{return await originalFetch(...args);}
   catch(error){
    const aborted=error instanceof DOMException&&error.name==='AbortError';
    if(!aborted&&error instanceof TypeError)void reachable().then(ok=>{if(!ok)goOffline();});
    throw error;
   }
  };
  window.fetch=patched;
  window.addEventListener('offline',goOffline);
  window.addEventListener('online',onOnline);
  if(navigator.onLine===false)goOffline();
  return()=>{
   if(window.fetch===patched)window.fetch=originalFetch;
   window.removeEventListener('offline',goOffline);
   window.removeEventListener('online',onOnline);
   stopProbe();window.clearTimeout(hideBack);
  };
 },[]);

 useEffect(()=>{
  if(status==='online')return;
  const place=()=>setTop(headerBottom());
  place();
  window.addEventListener('resize',place);
  window.addEventListener('scroll',place,{passive:true});
  const timer=window.setInterval(place,1000);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place);window.clearInterval(timer);};
 },[status]);

 if(status==='online')return null;
 return <div className={'offline-bar'+(status==='back'?' is-back':'')} role="status" aria-live="polite" style={{top:top||undefined}}>
  {status==='back'?t('offline.back'):t('offline.bar')}
 </div>;
}
