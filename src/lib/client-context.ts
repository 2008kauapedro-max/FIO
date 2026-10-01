// Contexto apenas de navegaÃ§Ã£o.
// O servidor continua validando a membership de verdade.

const contextKey='fio-client-shop-v1';

function validShop(value:string|null){
 return Boolean(value&&/^[a-z0-9-]{3,60}$/.test(value));
}

function storedClientShop(){
 try{
  if(typeof localStorage!=='undefined'){
   const value=localStorage.getItem(contextKey);
   if(validShop(value))return value!;
  }
 }catch{}

 try{
  if(typeof sessionStorage!=='undefined'){
   const value=sessionStorage.getItem(contextKey);
   if(validShop(value))return value!;
  }
 }catch{}

 return '';
}

export function clientContext(pathname:string,search:string){
 const q=new URLSearchParams(search);
 const audience=q.get('audience');

 if(
  (audience&&audience!=='client')||
  /^\/(owner|barber|platform|acesso)(\/|$)/.test(pathname)
 ) return '';

 const slug=q.get('shop')||'';

 if(validShop(slug))return slug;

 if(
  audience==='client'||
  /^\/client(\/|$)/.test(pathname)
 ) return storedClientShop();

 return '';
}

export function rememberClientShop(slug:string){
 if(!validShop(slug))return;

 try{
  if(typeof localStorage!=='undefined')
   localStorage.setItem(contextKey,slug);
 }catch{}

 try{
  if(typeof sessionStorage!=='undefined')
   sessionStorage.setItem(contextKey,slug);
 }catch{}
}