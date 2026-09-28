// Context is navigation intent only. The server still validates shop membership.
const contextKey='fio-client-shop-v1';
export function clientContext(pathname:string,search:string){
 const q=new URLSearchParams(search),audience=q.get('audience');
 if((audience&&audience!=='client')||/^\/(owner|barber|platform|acesso)(\/|$)/.test(pathname))return '';
 const slug=q.get('shop')||'';
 if(/^[a-z0-9-]{3,60}$/.test(slug))return slug;
 if(audience==='client'||/^\/client(\/|$)/.test(pathname)){
  try{return sessionStorage.getItem(contextKey)||'';}catch{return '';}
 }
 return '';
}
export function rememberClientShop(slug:string){
 if(!/^[a-z0-9-]{3,60}$/.test(slug))return;
 try{sessionStorage.setItem(contextKey,slug);}catch{}
}
