import { useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Role } from '../../shared/domain';
import './guided-tour.css';
import {useI18n} from '../i18n';

type Step={
 target:string;
 title:string;
 text:string;
 route?:string;
 menu?:boolean;
};

type Position={
 top:number;
 left:number;
};

export function GuidedTour({
 userId,
 shopId,
 role,
 base,
 openMenu
}:{
 userId:string;
 shopId:string;
 role:Role;
 base:string;
 openMenu:(open:boolean)=>void;
}){
 const {t}=useI18n();

 const key=`fio-tour:v3:${userId}:${shopId}:${role}`;
 const pendingKey=`fio-tour:new-account:${userId}`;

 const navigate=useNavigate();
 const dialog=useRef<HTMLDivElement>(null);

 const [index,setIndex]=useState<number|null>(null);
 const [rect,setRect]=useState<DOMRect|null>(null);
 const [position,setPosition]=useState<Position>({
  top:12,
  left:12
 });

 const steps=useMemo<Step[]>(()=>{
  const navigation:Step={
   target:'navigation',
   title:t('tour.navigationTitle'),
   text:t('tour.navigationText'),
   route:role==='CLIENT'
    ?`${base}/agenda`
    :base,
   menu:true
  };

  const agenda:Step={
   target:'agenda-page',
   title:t('tour.agendaTitle'),
   text:t('tour.agendaText'),
   route:`${base}/agenda`
  };

  const settings:Step={
   target:'settings-page',
   title:t('tour.settingsTitle'),
   text:t('tour.settingsText'),
   route:`${base}/configuracoes`
  };

  const support:Step={
   target:'support-page',
   title:t('tour.supportTitle'),
   text:t('tour.supportText'),
   route:`${base}/suporte`
  };

  const feedback:Step[]=[
   {
    target:'feedback',
    title:t('tour.feedbackTitle'),
    text:t('tour.feedbackText'),
    route:`${base}/suporte`
   },
   {
    target:'feedback-message',
    title:t('tour.messageTitle'),
    text:t('tour.messageText'),
    route:`${base}/suporte`
   },
   {
    target:'feedback-send',
    title:t('tour.sendTitle'),
    text:t('tour.sendText'),
    route:`${base}/suporte`
   }
  ];

  if(role==='CLIENT')
   return [
    agenda,
    navigation,
    settings,
    support,
    ...feedback
   ];

  return [
   {
    target:'overview',
    title:t('tour.overviewTitle'),
    text:role==='OWNER'
     ?t('tour.overviewOwner')
     :t('tour.overviewBarber'),
    route:base
   },
   navigation,
   agenda,
   settings,
   support,
   ...feedback
  ];
 },[role,base,t]);

 useEffect(()=>{
  const restart=()=>setIndex(0);

  window.addEventListener(
   'fio-tour-restart',
   restart
  );

  try{
   if(
    localStorage.getItem(pendingKey)==='pending'
   ){
    localStorage.removeItem(pendingKey);
    setIndex(0);
   }
  }catch{}

  return()=>{
   window.removeEventListener(
    'fio-tour-restart',
    restart
   );
  };
 },[pendingKey]);

 const step=index===null
  ?null
  :steps[index];

 useEffect(()=>{
  if(!step)return;

  setRect(null);
  openMenu(Boolean(step.menu));

  if(step.route)
   navigate(step.route);

  let scrolled=false;

  const locate=()=>{
   // A central de ajuda atual usa estados internos, nao rotas separadas.
   if(step.target==='support-page'||step.target==='feedback'||step.target==='feedback-message'||step.target==='feedback-send'){
    window.dispatchEvent(new CustomEvent('fio-tour-target',{detail:{target:step.target}}));
   }
   if(
    step.target==='support-page'
   ){
    document
     .querySelector<HTMLButtonElement>(
      '[data-tour="support-back"]'
     )
     ?.click();
   }

   if(
    step.target==='feedback'&&
    !document.querySelector(
     '[data-tour="feedback"]'
    )
   ){
    document
     .querySelector<HTMLButtonElement>(
      '[data-tour="support-back"]'
     )
     ?.click();
   }

   if(
    step.target==='feedback-message'&&
    !document.querySelector(
     '[data-tour="feedback-message"]'
    )
   ){
    document
     .querySelector<HTMLButtonElement>(
      '[data-tour="feedback"]'
     )
     ?.click();
   }

   const target=
    document.querySelector<HTMLElement>(
     `[data-tour="${step.target}"]`
    );

   if(!target)return;

   const next=target.getBoundingClientRect();

   if(!next.width||!next.height)return;

   setRect(current=>
    current&&
    Math.abs(current.top-next.top)<1&&
    Math.abs(current.left-next.left)<1&&
    Math.abs(current.width-next.width)<1&&
    Math.abs(current.height-next.height)<1
     ?current
     :next
   );

   if(!scrolled){
    target.scrollIntoView({
     block:'center',
     behavior:'instant'
    });

    scrolled=true;
   }
  };

  const timer=window.setInterval(
   locate,
   160
  );

  locate();
  dialog.current?.focus();

  return()=>window.clearInterval(timer);
 },[step,navigate,openMenu]);

 useLayoutEffect(()=>{
  if(!step||!dialog.current)return;

  const place=()=>{
   const card=dialog.current;

   if(!card)return;

   const margin=12;
   const gap=12;
   const vh=window.innerHeight;
   const vw=window.innerWidth;
   const cardBox=card.getBoundingClientRect();

   const left=rect
    ?Math.max(
     margin,
     Math.min(
      vw-cardBox.width-margin,
      rect.left+
       rect.width/2-
       cardBox.width/2
     )
    )
    :Math.max(
     margin,
     (vw-cardBox.width)/2
    );

   const below=rect
    ?rect.bottom+gap
    :margin;

   const above=rect
    ?rect.top-cardBox.height-gap
    :vh-cardBox.height-margin;

   const roomBelow=
    vh-below-margin;

   const roomAbove=
    rect?above:0;

   let top:number;

   if(!rect)
    top=margin;
   else if(
    roomBelow>=cardBox.height||
    roomBelow>=roomAbove
   )
    top=Math.max(
     margin,
     Math.min(
      vh-cardBox.height-margin,
      below
     )
    );
   else
    top=Math.max(
     margin,
     Math.min(
      vh-cardBox.height-margin,
      above
     )
    );

   setPosition(current=>
    current.top===top&&
    current.left===left
     ?current
     :{top,left}
   );
  };

  place();

  window.addEventListener(
   'resize',
   place
  );

  window.addEventListener(
   'scroll',
   place,
   true
  );

  return()=>{
   window.removeEventListener(
    'resize',
    place
   );

   window.removeEventListener(
    'scroll',
    place,
    true
   );
  };
 },[step,rect]);

 function finish(){
  try{
   localStorage.setItem(
    key,
    'done'
   );
  }catch{}

  setIndex(null);
  openMenu(false);

  navigate(base,{
   replace:true
  });

  window.setTimeout(
   ()=>window.scrollTo({
    top:0,
    behavior:'instant'
   }),
   0
  );
 }

 if(
  index===null||
  !step
 )
  return null;

 const left=rect
  ?Math.max(0,rect.left-4)
  :0;

 const top=rect
  ?Math.max(0,rect.top-4)
  :0;

 const width=rect
  ?Math.min(
   rect.width+8,
   window.innerWidth-left
  )
  :0;

 const height=rect
  ?Math.min(
   rect.height+8,
   window.innerHeight-top
  )
  :0;

 return <div className="fio-tour-layer">
  <svg
   className="fio-tour-shade"
   aria-hidden="true"
  >
   <defs>
    <mask id="fio-tour-hole">
     <rect
      width="100%"
      height="100%"
      fill="white"
     />

     {rect&&
      <rect
       x={left}
       y={top}
       width={width}
       height={height}
       rx="10"
       fill="black"
      />
     }
    </mask>
   </defs>

   <rect
    width="100%"
    height="100%"
    fill="rgba(0,0,0,.58)"
    mask="url(#fio-tour-hole)"
   />

   {rect&&
    <rect
     x={left}
     y={top}
     width={width}
     height={height}
     rx="10"
     fill="none"
     stroke="white"
     strokeWidth="2"
    />
   }
  </svg>

  <div
   ref={dialog}
   tabIndex={-1}
   className="fio-tour-card"
   role="dialog"
   aria-modal="true"
   aria-labelledby="fio-tour-title"
   style={{
    top:position.top,
    left:position.left
   }}
  >
   <small>
    {t('tour.kicker',{
     current:index+1,
     total:steps.length
    })}
   </small>

   <h2 id="fio-tour-title">
    {step.title}
   </h2>

   <p>{step.text}</p>

   <div className="fio-tour-actions">
    <button onClick={finish}>
     {t('tour.skip')}
    </button>

    <button
     disabled={index===0}
     onClick={()=>setIndex(index-1)}
    >
     {t('tour.previous')}
    </button>

    <button
     className="primary"
     onClick={()=>
      index===steps.length-1
       ?finish()
       :setIndex(index+1)
     }
    >
     {index===steps.length-1
      ?t('tour.finish')
      :t('tour.next')
     }
    </button>
   </div>
  </div>
 </div>;
}
