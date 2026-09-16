import React from 'react';
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

createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
