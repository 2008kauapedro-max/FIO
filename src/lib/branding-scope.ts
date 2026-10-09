/** Regras de identidade do FIO. Só caminhos explícitos de cliente recebem logo da loja. */
const reserved=new Set([
 'login','owner','barber','client','platform','api','acesso','b','barbearia',
 'termos','privacidade','cancelamento-e-reembolso','condicoes-de-pagamento',
 'pix-automatico','cartao-e-parcelamento','direitos-do-cliente',
 'reset-password','confirm-email','manifest.webmanifest'
]);
const slugPattern=/^[a-z0-9-]{3,60}$/;

export function explicitClientSlug(pathname:string,search:string):string|null{
 const params=new URLSearchParams(search);
 const parts=pathname.split('/').filter(Boolean);
 if((parts[0]==='b'||parts[0]==='barbearia')&&parts.length===2){
  const slug=parts[1];
  return slugPattern.test(slug)&&!reserved.has(slug)?slug:null;
 }
 if(parts.length===1&&slugPattern.test(parts[0])&&!reserved.has(parts[0]))return parts[0];
 if(pathname==='/login'&&params.get('audience')==='client'){
  const slug=params.get('shop')??'';
  return slugPattern.test(slug)&&!reserved.has(slug)?slug:null;
 }
 return null;
}

export function isManagementPath(pathname:string,search:string):boolean{
 const audience=new URLSearchParams(search).get('audience');
 return /^\/(owner|barber)(\/|$)/.test(pathname)||
  (pathname==='/login'&&audience!=='client');
}
