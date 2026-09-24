import {useEffect,useRef,useState} from 'react';

type Turnstile={render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void;execute:(widgetId:string)=>void};
declare global {interface Window {turnstile?:Turnstile}}
export const captchaSiteKey=String(import.meta.env.VITE_TURNSTILE_SITE_KEY??'').trim();
let loading:Promise<Turnstile>|undefined;
function loadTurnstile(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(loading)return loading;
 loading=new Promise<Turnstile>((resolve,reject)=>{
  const script=document.createElement('script');
  const fail=()=>{script.remove();loading=undefined;reject(new Error('CAPTCHA_UNAVAILABLE'));};
  const timer=window.setTimeout(fail,15000);
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async=true;
  script.onload=()=>{clearTimeout(timer);if(window.turnstile)resolve(window.turnstile);else fail();};
  script.onerror=()=>{clearTimeout(timer);fail();};
  document.head.append(script);
 });
 return loading;
}

export function AuthCaptcha({onToken,attempt}:{onToken:(token:string)=>void;attempt:number}){
 const container=useRef<HTMLDivElement>(null);
 const widgetRef=useRef<string|undefined>(undefined);
 const apiRef=useRef<Turnstile|undefined>(undefined);
 const startedRef=useRef(false);
 const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 const [ready,setReady]=useState(false),[started,setStarted]=useState(false),[verified,setVerified]=useState(false);
 const [compact,setCompact]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 480px)').matches);
 useEffect(()=>{
  const media=window.matchMedia('(max-width: 480px)');
  const update=()=>setCompact(media.matches);
  update();media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  let active=true,widget:string|undefined,api:Turnstile|undefined;
  startedRef.current=false;widgetRef.current=undefined;apiRef.current=undefined;
  onToken('');setFailed(false);setReady(false);setStarted(false);setVerified(false);
  void loadTurnstile().then(turnstile=>{
   if(!active||!container.current)return;
   api=turnstile;
   widget=turnstile.render(container.current,{sitekey:captchaSiteKey,theme:'auto',size:compact?'compact':'flexible',execution:'execute',appearance:'always',retry:'never',refreshExpired:'manual',
    callback:(token:string)=>{if(active&&startedRef.current){setFailed(false);setVerified(true);setStarted(false);onToken(token);}},
    'expired-callback':()=>{if(active){onToken('');setVerified(false);setStarted(false);startedRef.current=false;}},
    'timeout-callback':()=>{if(active){onToken('');setVerified(false);setStarted(false);startedRef.current=false;setFailed(true);}},
    'error-callback':()=>{if(active){onToken('');setVerified(false);setStarted(false);startedRef.current=false;setFailed(true);}}
   });
   widgetRef.current=widget;apiRef.current=turnstile;setReady(true);
  }).catch(()=>{if(active)setFailed(true);});
  return()=>{active=false;widgetRef.current=undefined;apiRef.current=undefined;if(widget!==undefined)api?.remove(widget);};
 },[onToken,attempt,retry,compact]);
 const startVerification=()=>{
  const api=apiRef.current,widget=widgetRef.current;
  if(!api||!widget||startedRef.current||verified)return;
  startedRef.current=true;setStarted(true);setFailed(false);
  try{api.execute(widget);}catch{startedRef.current=false;setStarted(false);setFailed(true);}
 };
 return <div className="auth-captcha">
  <div className="auth-captcha-widget" ref={container}/>
  {!verified&&<button type="button" className="secondary full auth-captcha-start" disabled={!ready||started} onClick={startVerification}>
   {started?'Verificando…':failed?'Verificar novamente':'Verificar acesso'}
  </button>}
  {verified&&<p className="auth-captcha-status" role="status">Verificação concluída. Toque em Entrar para continuar.</p>}
  {failed&&<p role="alert" className="auth-captcha-error">Não foi possível concluir a verificação. Tente novamente.</p>}
  {!ready&&!failed&&<p className="auth-captcha-hint">Carregando verificação de segurança…</p>}
  {failed&&<button type="button" className="text-button auth-captcha-retry" onClick={()=>setRetry(v=>v+1)}>Recarregar verificação</button>}
 </div>;
}
