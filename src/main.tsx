import React,{useEffect,useState} from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

if(import.meta.env.PROD&&'serviceWorker' in navigator){
 const hadController=Boolean(navigator.serviceWorker.controller);
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('/sw.js').then(registration=>{
   void registration.update();
   let reloaded=false;
   navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(hadController&&!reloaded){reloaded=true;window.location.reload();}
   });
  }).catch(()=>undefined);
 });
}

function Root(){
 const [booting,setBooting]=useState(true);
 useEffect(()=>{const timer=window.setTimeout(()=>setBooting(false),720);return()=>window.clearTimeout(timer);},[]);
 return <>
  {booting&&<div className="boot-splash" aria-label="Abrindo FIO"><img src="/branding/fio-mark.png" alt="FIO"/></div>}
  <BrowserRouter><App/></BrowserRouter>
 </>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
