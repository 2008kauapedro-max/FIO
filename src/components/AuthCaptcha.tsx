import {useEffect,useRef,useState} from 'react';

type Turnstile={render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
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
 const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true,widget:string|undefined,api:Turnstile|undefined;
  onToken('');setFailed(false);
  void loadTurnstile().then(turnstile=>{
   if(!active||!container.current)return;
   api=turnstile;
   widget=turnstile.render(container.current,{sitekey:captchaSiteKey,theme:'auto',size:'flexible',
    callback:(token:string)=>{if(active){setFailed(false);onToken(token);}},
    'expired-callback':()=>{if(active)onToken('');},
    'error-callback':()=>{if(active){onToken('');setFailed(true);}}
   });
  }).catch(()=>{if(active)setFailed(true);});
  return()=>{active=false;if(widget!==undefined)api?.remove(widget);};
 },[onToken,attempt,retry]);
 return <div className="auth-captcha">
  <div ref={container}/>
  {failed&&<p role="alert">Não foi possível verificar seu acesso. <button type="button" className="text-button" onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></p>}
 </div>;
}
