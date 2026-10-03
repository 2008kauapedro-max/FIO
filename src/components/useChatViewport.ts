import {useEffect} from 'react';

/** Mantém o chat sincronizado com a área realmente visível quando o teclado móvel abre. */
export function useChatViewport(){
 useEffect(()=>{
  const viewport=window.visualViewport;
  let frame=0;

  const update=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const height=viewport?.height??window.innerHeight;
    const top=viewport?.offsetTop??0;
    const keyboardInset=Math.max(0,window.innerHeight-(top+height));
    const keyboardOpen=keyboardInset>120;

    document.documentElement.style.setProperty('--chat-viewport-height',`${height}px`);
    document.documentElement.style.setProperty('--chat-viewport-top',`${top}px`);
    document.documentElement.style.setProperty('--chat-keyboard-inset',`${keyboardInset}px`);
    document.documentElement.classList.toggle('chat-keyboard-open',keyboardOpen);
   });
  };

  update();
  viewport?.addEventListener('resize',update);
  viewport?.addEventListener('scroll',update);
  window.addEventListener('resize',update);
  window.addEventListener('orientationchange',update);

  return()=>{
   cancelAnimationFrame(frame);
   viewport?.removeEventListener('resize',update);
   viewport?.removeEventListener('scroll',update);
   window.removeEventListener('resize',update);
   window.removeEventListener('orientationchange',update);
   document.documentElement.style.removeProperty('--chat-viewport-height');
   document.documentElement.style.removeProperty('--chat-viewport-top');
   document.documentElement.style.removeProperty('--chat-keyboard-inset');
   document.documentElement.classList.remove('chat-keyboard-open');
  };
 },[]);
}
