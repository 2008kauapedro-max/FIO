import {useState} from 'react';
import {detectInAppBrowser,dismissalKey,isDismissed,externalBrowserUrl,browserInstructions} from '../../shared/in-app-browser';
export function InAppBrowserBanner(){
 const browser=detectInAppBrowser(navigator.userAgent);
 const [closed,setClosed]=useState(()=>{try{return isDismissed(sessionStorage.getItem(dismissalKey));}catch{return false;}}),[help,setHelp]=useState(false);
 if(!browser||closed)return null;
 function close(){setClosed(true);try{sessionStorage.setItem(dismissalKey,String(Date.now()+12*3600000));}catch{/* Optional storage may be blocked in WebViews. */}}
 return <aside className="in-app-banner" aria-label="Abrir no navegador"><div><strong>Você está no navegador do {browser}.</strong><p>Abra no navegador para instalar o FIO e ter a melhor experiência.</p><a href={externalBrowserUrl(location.href)} target="_blank" rel="noopener noreferrer" onClick={()=>setHelp(true)}>Abrir no navegador</a>{help&&<p role="status">{browserInstructions(navigator.userAgent)}</p>}</div><button aria-label="Fechar aviso do navegador" onClick={close}>×</button></aside>;
}
