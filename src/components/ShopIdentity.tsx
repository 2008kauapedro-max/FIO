import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Scissors} from 'lucide-react';
import {useI18n} from '../i18n';
export function ShopIdentity({slug}:{slug:string}){
 const {t}=useI18n();
 const [shop,setShop]=useState<{id?:string;name:string;public_title?:string;logo_url?:string}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();let active=true;setShop(null);
  fetch(`/api/public/shop/${encodeURIComponent(slug)}`,{signal:controller.signal,cache:'no-store'})
   .then(async r=>{if(!r.ok)throw Error();return r.json();})
   .then(data=>{
    if(!active)return;

    setShop(data.shop);

    const brand=data?.shop;

    if(
     brand?.id&&
     typeof window!=='undefined'
    ){
     try{
      const key='fio-loading-brands-v2';
      const lastKey='fio-loading-last-shop-v2';
      const previous=JSON.parse(
       localStorage.getItem(key)||'{}'
      );

      const next={
       ...previous,
       [String(brand.id)]:{
        shopId:String(brand.id),
        slug,
        name:String(
         brand.public_title||
         brand.name||
         ''
        ),
        logo:String(
         brand.logo_url||
         ''
        )
       }
      };

      localStorage.setItem(
       key,
       JSON.stringify(next)
      );

      localStorage.setItem(
       lastKey,
       String(brand.id)
      );

      window.dispatchEvent(
       new CustomEvent(
        'fio-loading-brand',
        {
         detail:next[String(brand.id)]
        }
       )
      );
     }catch{}
    }
   })
   .catch(()=>undefined);
  return()=>{active=false;controller.abort();};
 },[slug]);
 // O login do CLIENTE usa o ícone da loja do link atual, nunca a última loja visitada.
 useEffect(()=>{
  const icon=shop?.logo_url||'/icons/icon-192.png';
  for(const rel of ['icon','apple-touch-icon'] as const){
   const link=document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
   if(link)link.href=icon;
  }
  const title=shop?.public_title||shop?.name||'FIO';
  const appleTitle=document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if(appleTitle)appleTitle.content=title;
  document.title=title==='FIO'?'FIO · Sua barbearia, em sintonia':title;
 },[shop?.logo_url,shop?.public_title,shop?.name,slug]);
 return <Link className="client-auth-brand" to={`/${encodeURIComponent(slug)}`}>
  {shop?.logo_url?<img src={shop.logo_url} alt=""/>:<Scissors aria-hidden="true"/>}
  <span><strong>{shop?.public_title||shop?.name||t('shopIdentity.default')}</strong><small>{t('shopIdentity.clientArea')}</small></span>
 </Link>;
}
