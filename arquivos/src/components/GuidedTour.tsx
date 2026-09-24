import { useEffect,useMemo,useRef,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Role } from '../../shared/domain';
import './guided-tour.css';
type Step={target:string;title:string;text:string;route?:string;menu?:boolean};
export function GuidedTour({userId,shopId,role,base,openMenu}:{userId:string;shopId:string;role:Role;base:string;openMenu:(open:boolean)=>void}){
 const key=`fio-tour:v1:${userId}:${shopId}:${role}`;
 const navigate=useNavigate(),dialog=useRef<HTMLDivElement>(null);
 const [index,setIndex]=useState<number|null>(null),[rect,setRect]=useState<DOMRect|null>(null);
 const steps=useMemo<Step[]>(()=>[
  {target:'overview',title:'Bem-vindo ao FIO',text:role==='OWNER'?'Aqui você acompanha os recebimentos registrados nesta semana. Em Ver detalhes, abra o financeiro e escolha o período que quer consultar.':'Aqui você encontra um resumo da sua agenda e dos próximos atendimentos.',route:base},
  {target:'nav-agenda',title:'Sua agenda',text:'Abra a agenda para consultar horários e detalhes dos atendimentos.',menu:true},
  ...(role==='OWNER'?[{target:'nav-plano-fio',title:'Seu plano FIO',text:'Compare FREE, PRO e PREMIUM. Confira o plano ativo, o teste grátis e suas cobranças antes de contratar.',menu:true}]:[]),
  {target:'profile',title:'Seu perfil é clicável',text:'Clique no seu nome ou na foto para abrir as configurações. Ali ficam seus dados, foto e segurança da conta.',menu:true},
  {target:'nav-suporte',title:'Ajude a melhorar o FIO',text:'Encontrou um erro ou sentiu falta de algo? Em Ajuda e suporte você fala com a equipe do FIO.',menu:true},
  {target:'feedback',title:'Sugestões, dúvidas e problemas',text:'Use Feedback e dúvidas para contar o que precisa melhorar. No próximo passo vamos abrir o formulário.',route:`${base}/suporte`},
  {target:'feedback-message',title:'Escreva com suas palavras',text:'Por exemplo: “Não consegui salvar minha foto” ou “Gostaria de uma opção para…”. Informe a tela e o que aconteceu. Não envie senhas ou códigos.',route:`${base}/suporte`},
  {target:'feedback-send',title:'Sua mensagem chega à equipe',text:'Depois de escrever, clique em Enviar mensagem. Você verá a confirmação quando ela for registrada para a equipe do FIO. Este tutorial não envia nada por você.',route:`${base}/suporte`}
 ],[role,base]);
 useEffect(()=>{
  let done=false;try{done=localStorage.getItem(key)==='done';}catch{}
  if(!done)setIndex(0);
  const restart=()=>setIndex(0);window.addEventListener('fio-tour-restart',restart);
  return()=>window.removeEventListener('fio-tour-restart',restart);
 },[key]);
 const step=index===null?null:steps[index];
 useEffect(()=>{
  if(!step)return;
  setRect(null);openMenu(Boolean(step.menu));
  if(step.route)navigate(step.route);
  let scrolled=false;
  const locate=()=>{
   if(step.target==='feedback'&&!document.querySelector('[data-tour="feedback"]'))document.querySelector<HTMLButtonElement>('[data-tour="support-back"]')?.click();
   if(step.target==='feedback-message'&&!document.querySelector('[data-tour="feedback-message"]'))document.querySelector<HTMLButtonElement>('[data-tour="feedback"]')?.click();
   const target=document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
   if(target){const r=target.getBoundingClientRect();if(r.width&&r.height){setRect(r);if(!scrolled){target.scrollIntoView({block:'center',behavior:'instant'});scrolled=true;}}}

  };
  const timer=window.setInterval(locate,200);locate();dialog.current?.focus();
  return()=>window.clearInterval(timer);
 },[step,navigate,openMenu]);
 function finish(){try{localStorage.setItem(key,'done');}catch{}setIndex(null);openMenu(false);}
 if(index===null||!step)return null;
 const left=rect?Math.max(8,rect.left-5):0,top=rect?Math.max(8,rect.top-5):0;
 const width=rect?Math.min(rect.width+10,window.innerWidth-left-8):0,height=rect?Math.min(rect.height+10,window.innerHeight-top-8):0;
 return <div className="fio-tour-layer">
  <svg className="fio-tour-shade" aria-hidden="true"><defs><mask id="fio-tour-hole"><rect width="100%" height="100%" fill="white"/>{rect&&<rect x={left} y={top} width={width} height={height} rx="12" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,.78)" mask="url(#fio-tour-hole)"/>{rect&&<rect x={left} y={top} width={width} height={height} rx="12" fill="none" stroke="white" strokeWidth="2"/>}</svg>
  <div ref={dialog} tabIndex={-1} className="fio-tour-card" role="dialog" aria-modal="true" aria-labelledby="fio-tour-title" style={rect&&rect.bottom<window.innerHeight-250?{top:Math.max(16,rect.bottom+20),bottom:'auto'}:{bottom:20}} onKeyDown={e=>{if(e.key==='Escape')finish();if(e.key==='Tab'){const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===e.currentTarget)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
   <small>CONHEÇA O FIO · {index+1} / {steps.length}</small><h2 id="fio-tour-title">{step.title}</h2><p>{step.text}</p>
   <div><button onClick={finish}>Pular tutorial</button><span/><button disabled={index===0} onClick={()=>setIndex(index-1)}>Voltar</button><button className="primary" onClick={()=>index===steps.length-1?finish():setIndex(index+1)}>{index===steps.length-1?'Concluir':'Próximo'}</button></div>
  </div>
 </div>;
}
