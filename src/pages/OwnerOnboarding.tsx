import { useEffect,useMemo,useState,type ChangeEvent } from 'react';
import { Check,ChevronLeft,ChevronRight,Copy,ExternalLink,ImagePlus,Plus,Share2,Trash2 } from 'lucide-react';
import { api,supabase } from '../lib/api';
import { optimizeImage } from '../lib/images';

type Service={id?:string;_key:string;name:string;description?:string|null;duration_minutes:number;price_cents:number;active:boolean;_durationInput?:string;_priceInput?:string};
type DaySchedule={weekday:number;enabled:boolean;opensAt:string;closesAt:string};
type Snapshot={
 progress:{current_step:number;completed_steps:number[];draft:Record<string,unknown>}|null;
 shop:{id:string;name:string;slug:string;onboarding_completed:boolean;onboarding_step:number;whatsapp:string|null;instagram:string|null;address:string|null;theme_mode:'light'|'dark';palette_key:string;custom_accent:string|null;logo_asset_path:string|null;cover_asset_path:string|null;background_asset_path:string|null};
 services:Omit<Service,'_key'>[];
 hours:{weekday:number;opens_at:string;closes_at:string}[];
 amenities:string[];
 palettes:Palette[];
 owner:{display_name:string;phone?:string|null};
};
type Palette={palette_key:string;label:string;light_background:string;light_surface:string;light_text:string;light_text_muted:string;light_accent:string;dark_background:string;dark_surface:string;dark_text:string;dark_text_muted:string;dark_accent:string};
type Props={onDone:()=>void;shopId?:string};

const amenityOptions=[['wifi','Wi‑Fi'],['parking','Estacionamento disponível'],['accessibility','Acesso para cadeirante'],['kids','Atende crianças'],['air-conditioning','Ambiente climatizado']];
const weekdays=[['1','SEG','Segunda'],['2','TER','Terça'],['3','QUA','Quarta'],['4','QUI','Quinta'],['5','SEX','Sexta'],['6','SÁB','Sábado'],['0','DOM','Domingo']] as const;
const suggestedServices=[['Corte',30,3500],['Barba',30,2500],['Corte + Barba',60,5500]] as const;
const slugify=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
const money=(c:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
const cleanInstagram=(value:string)=>value.trim().replace(/^@+/,'').replace(/\s+/g,'');
const host=()=>typeof window==='undefined'?'usefio.vercel.app':window.location.host;
const newKey=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
const serviceDefaults=():Service[]=>suggestedServices.map(([name,duration,price])=>({_key:newKey(),name,description:'',duration_minutes:duration,price_cents:price,active:true}));
const scheduleDefaults=():DaySchedule[]=>weekdays.map(([value])=>({weekday:Number(value),enabled:Number(value)!==0,opensAt:'09:00',closesAt:'19:00'}));
const assetUrl=(path:string|null)=>path&&import.meta.env.VITE_SUPABASE_URL?`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/branding-assets/${path}`:'';

function scheduleSummary(days:DaySchedule[]){
 const enabled=weekdays.map(([value,label])=>({label,day:days.find(d=>d.weekday===Number(value))})).filter(x=>x.day?.enabled&&x.day.opensAt<x.day.closesAt) as {label:string;day:DaySchedule}[];
 if(!enabled.length)return ['Nenhum horário configurado'];
 const groups:{from:string;to:string;opensAt:string;closesAt:string}[]=[];
 for(const item of enabled){
  const prev=groups.at(-1);
  if(prev&&prev.opensAt===item.day.opensAt&&prev.closesAt===item.day.closesAt){prev.to=item.label;}
  else groups.push({from:item.label,to:item.label,opensAt:item.day.opensAt,closesAt:item.day.closesAt});
 }
 return groups.map(g=>`${g.from===g.to?g.from:`${g.from}–${g.to}`} · ${g.opensAt}–${g.closesAt}`);
}

export function OwnerOnboarding({onDone,shopId:initialShopId}:Props){
 const [shopId,setShopId]=useState(initialShopId??''),[step,setStep]=useState(1),[completed,setCompleted]=useState<number[]>([]),[draft,setDraft]=useState<Record<string,unknown>>({}),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[loading,setLoading]=useState(Boolean(initialShopId)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[success,setSuccess]=useState(false);
 const [name,setName]=useState(''),[slug,setSlug]=useState(''),[slugTouched,setSlugTouched]=useState(false),[displayName,setDisplayName]=useState(''),[whatsapp,setWhatsapp]=useState(''),[instagram,setInstagram]=useState(''),[address,setAddress]=useState(''),[amenities,setAmenities]=useState<string[]>([]),[services,setServices]=useState<Service[]>(serviceDefaults),[schedules,setSchedules]=useState<DaySchedule[]>(scheduleDefaults),[hoursSaved,setHoursSaved]=useState(false),[paletteKey,setPaletteKey]=useState('fio-black'),[themeMode,setThemeMode]=useState<'light'|'dark'>('dark'),[customAccent,setCustomAccent]=useState('#ffffff'),[logoPath,setLogoPath]=useState<string|null>(null),[coverPath,setCoverPath]=useState<string|null>(null),[backgroundPath,setBackgroundPath]=useState<string|null>(null);
 const publicLink=shopId&&slug?`${window.location.origin}/${slug}`:'';

 useEffect(()=>{window.scrollTo({top:0,behavior:'auto'});},[step]);

 useEffect(()=>{
  if(!shopId)return;
  let active=true;
  setLoading(true);
  api<Snapshot>('/onboarding/progress',shopId).then(s=>{
   if(!active)return;
   setSnapshot(s);
   const d=s.progress?.draft??{};
   setStep(s.progress?.current_step??s.shop.onboarding_step??1);
   setCompleted(s.progress?.completed_steps??[]);
   setDraft(d);
   setName(s.shop.name);setSlug(s.shop.slug);setWhatsapp(s.shop.whatsapp??s.owner.phone??'');setInstagram(cleanInstagram(s.shop.instagram??''));setAddress(s.shop.address??'');setAmenities(s.amenities);
   setServices(s.services.length?s.services.map(service=>({...service,_key:service.id??newKey()})):serviceDefaults());
   const nextSchedules=scheduleDefaults();
   for(const hour of s.hours){const target=nextSchedules.find(x=>x.weekday===hour.weekday);if(target){target.enabled=true;target.opensAt=hour.opens_at.slice(0,5);target.closesAt=hour.closes_at.slice(0,5);}}
   if(s.hours.length){for(const day of nextSchedules)if(!s.hours.some(h=>h.weekday===day.weekday))day.enabled=false;}
   setSchedules(nextSchedules);setHoursSaved(s.hours.length>0);
   setPaletteKey(s.shop.palette_key);setThemeMode(s.shop.theme_mode);setCustomAccent(s.shop.custom_accent??'#ffffff');setLogoPath(s.shop.logo_asset_path);setCoverPath(s.shop.cover_asset_path);setBackgroundPath(s.shop.background_asset_path);setDisplayName(s.owner.display_name??'');setLoading(false);
  }).catch(e=>{if(active){setError((e as Error).message);setLoading(false);}});
  return()=>{active=false;};
 },[shopId]);

 const palettes=snapshot?.palettes??[];
 const selectedPalette=palettes.find(p=>p.palette_key===paletteKey);
 const previewStyle=useMemo(()=>{const p=selectedPalette;const dark=themeMode==='dark';return {'--ob-bg':customAccent&&paletteKey==='custom'?(dark?'#101010':'#f7f7f4'):(dark?p?.dark_background??'#080808':p?.light_background??'#f5f5f2'),'--ob-surface':dark?p?.dark_surface??'#111':p?.light_surface??'#fff','--ob-text':dark?p?.dark_text??'#fff':p?.light_text??'#111','--ob-muted':dark?p?.dark_text_muted??'#999':p?.light_text_muted??'#666','--ob-accent':paletteKey==='custom'?customAccent:(dark?p?.dark_accent??'#fff':p?.light_accent??'#111')} as React.CSSProperties;},[selectedPalette,paletteKey,themeMode,customAccent]);
 const logoPreview=assetUrl(logoPath);
 const validService=(s:Service)=>s.name.trim().length>=2&&s.duration_minutes>=10&&s.duration_minutes<=240&&s.price_cents>=0;
 const serviceDuration=(s:Service)=>s._durationInput??String(s.duration_minutes);
 const servicePrice=(s:Service)=>s._priceInput??(s.price_cents/100).toFixed(2);
 const updateDuration=(key:string,raw:string)=>setServices(xs=>xs.map(x=>x._key===key?{...x,_durationInput:raw,duration_minutes:raw===''?0:Number(raw)}:x));
 const updatePrice=(key:string,raw:string)=>setServices(xs=>xs.map(x=>x._key===key?{...x,_priceInput:raw,price_cents:raw===''?0:Math.round(Number(raw.replace(',','.'))*100)}:x));
 const validSchedules=schedules.filter(d=>d.enabled&&d.opensAt<d.closesAt);
 const savedActiveServices=services.filter(s=>s.id&&s.active&&validService(s));
 const missingRequirements=[!whatsapp.replace(/\D/g,'').match(/^\d{10,15}$/)?'WhatsApp válido':null,!savedActiveServices.length?'Pelo menos um serviço salvo':null,!hoursSaved||!validSchedules.length?'Pelo menos um dia com horário salvo':null,!logoPath?'Logo da barbearia':null].filter(Boolean) as string[];

 async function saveSetup(id:string,next:number,markComplete:boolean,extra:Record<string,unknown>={}){
  const nextCompleted=markComplete?Array.from(new Set([...completed,step])).sort():completed.filter(x=>x!==step);
  const nextDraft={...draft,...extra};
  await api('/onboarding/setup',id,{setup:{name:name.trim(),slug,whatsapp:whatsapp.trim(),instagram:cleanInstagram(instagram),address:address.trim(),themeMode,paletteKey,customAccent:paletteKey==='custom'?customAccent:null,amenities,logoAssetPath:logoPath,coverAssetPath:coverPath,backgroundAssetPath:backgroundPath},step:next,completedSteps:nextCompleted,draft:nextDraft});
  setCompleted(nextCompleted);setDraft(nextDraft);setStep(next);
 }

 async function createFirst(){
  setBusy(true);setError('');setNotice('');
  try{
   let ownerName=displayName.trim();
   if(!ownerName&&supabase){const current=await supabase.auth.getUser();const user=current.data.user;const meta=user?.user_metadata as Record<string,unknown>|undefined;const fromMeta=[meta?.display_name,meta?.full_name,meta?.name].find(v=>typeof v==='string'&&v.trim().length>=2);const fromEmail=user?.email?.split('@')[0]?.replace(/[._-]+/g,' ').trim();ownerName=typeof fromMeta==='string'?fromMeta.trim():(fromEmail&&fromEmail.length>=2?fromEmail:'Responsável');}
   if(!ownerName)ownerName='Responsável';setDisplayName(ownerName);
   const r=await api<{barbershopId:string}>('/onboarding',undefined,{mode:'create',name:name.trim(),slug,displayName:ownerName});
   setShopId(r.barbershopId);sessionStorage.setItem('fio-shop',r.barbershopId);return r.barbershopId;
  }catch(e){setError((e as Error).message);return '';}finally{setBusy(false);}
 }

 async function continueFromFirst(){
  const id=shopId||await createFirst();if(!id)return;
  setBusy(true);setError('');
  try{await saveSetup(id,2,true);setServices(list=>list.length?list:serviceDefaults());}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }

 async function persistServices(){
  if(!shopId)return false;
  const active=services.filter(s=>s.active);
  if(!active.length||active.some(s=>!validService(s))){setError('Confira nome, duração e preço dos serviços antes de continuar.');return false;}
  setBusy(true);setError('');
  try{
   const next:Service[]=[];
   for(const s of services){
    if(!validService(s)||(!s.id&&!s.active))continue;
    const r=await api<Omit<Service,'_key'>>('/onboarding/services',shopId,{id:s.id,name:s.name.trim(),description:s.description?.trim()??'',durationMinutes:s.duration_minutes,priceCents:s.price_cents,active:s.active});
    next.push({...r,_key:s._key});
   }
   setServices(next);return true;
  }catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}
 }

 async function persistHours(){
  if(!shopId)return false;
  if(!validSchedules.length){setError('Escolha pelo menos um dia e informe um horário válido.');return false;}
  setBusy(true);setError('');
  try{await api('/onboarding/hours',shopId,{days:schedules.map(d=>({weekday:d.weekday,enabled:d.enabled,opensAt:d.opensAt,closesAt:d.closesAt}))});setHoursSaved(true);return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}
 }

 async function nextStep(){
  setNotice('');setError('');
  if(step===1){await continueFromFirst();return;}
  if(!shopId)return;
  if(step===2){if(!await persistServices())return;await saveSetup(shopId,3,true);return;}
  if(step===3){if(!await persistHours())return;await saveSetup(shopId,4,true);return;}
  if(step===4){if(!logoPath){setError('Adicione a logo da barbearia para continuar. Ela será usada também no aplicativo dos clientes.');return;}await saveSetup(shopId,5,true);}
 }

 async function skipStep(){
  if(!shopId||step<2||step>4)return;
  setBusy(true);setError('');
  try{const skipped=Array.from(new Set([...(Array.isArray(draft.skippedSteps)?draft.skippedSteps as number[]:[]),step]));await saveSetup(shopId,step+1,false,{skippedSteps:skipped});setNotice('Etapa pulada. Antes de publicar, o FIO vai mostrar exatamente o que ainda falta. Depois, tudo continua editável nas Configurações.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }

 async function upload(e:ChangeEvent<HTMLInputElement>,kind:'logo'|'cover'|'background'){
  const file=e.target.files?.[0];if(!file||!shopId||!supabase)return;
  setBusy(true);setError('');
  try{
   const optimized=await optimizeImage(file,kind);
   const user=(await supabase.auth.getUser()).data.user;if(!user)throw Error('Entre novamente para enviar a imagem.');
   const path=`${shopId}/${user.id}/${kind}-${Date.now()}.webp`;
   const r=await supabase.storage.from('branding-assets').upload(path,optimized,{upsert:false,contentType:'image/webp',cacheControl:'31536000'});if(r.error)throw r.error;
   kind==='logo'?setLogoPath(path):kind==='cover'?setCoverPath(path):setBackgroundPath(path);
  }catch(e){setError((e as Error).message||'Não foi possível preparar esta imagem. Tente outra foto.');}finally{setBusy(false);}
 }

 async function activate(){
  if(!shopId)return;
  if(missingRequirements.length){setError(`Antes de publicar, conclua: ${missingRequirements.join(', ')}.`);return;}
  setBusy(true);setError('');
  try{await saveSetup(shopId,5,true);await api('/onboarding/activate',shopId,{});setSuccess(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }

 const copy=async()=>{if(publicLink)await navigator.clipboard?.writeText(publicLink);};
 const share=async()=>{if(publicLink&&navigator.share)await navigator.share({title:name,text:`Agora você pode agendar seu horário comigo pelo link: ${publicLink}`,url:publicLink});else await copy();};
 const canContinue=step===1?Boolean(name.trim().length>=2&&/^[a-z0-9-]{3,60}$/.test(slug)&&whatsapp.replace(/\D/g,'').length>=10):step===2?services.some(s=>s.active&&validService(s)):step===3?validSchedules.length>0:step===4?Boolean(paletteKey&&logoPath):true;

 if(loading)return <div className="owner-onboarding ob-loading">Carregando seu progresso…</div>;
 if(success)return <div className="owner-onboarding ob-success"><span className="ob-success-mark"><Check/></span><p className="eyebrow">TUDO PRONTO</p><h1>Sua barbearia está pronta.</h1><p className="ob-muted">O espaço já está disponível para seus clientes.</p><div className="ob-success-actions"><a href={`/${slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16}/>Ver página do cliente</a><button onClick={()=>void copy()}><Copy size={16}/>Copiar link</button><button onClick={()=>void share()}><Share2 size={16}/>Compartilhar</button><button onClick={onDone}>Entrar no FIO Gestão</button></div><div className="ob-qr"><img src={`https://quickchart.io/qr?size=180&text=${encodeURIComponent(publicLink)}`} alt="QR Code da página pública"/><a download="fio-link.png" href={`https://quickchart.io/qr?size=800&text=${encodeURIComponent(publicLink)}`}>Baixar QR Code</a></div></div>;
 if(!shopId&&step!==1)return null;

 return <main className="owner-onboarding" style={previewStyle}>
  <header className="ob-header"><img className="ob-fio-logo" src={themeMode==='dark'?'/FIOlogo+nome/Branco.png':'/FIOlogo+nome/Preto.png'} alt="FIO"/><button className="ob-exit" onClick={()=>void supabase?.auth.signOut()}>Sair</button></header>
  <section className="ob-progress"><div><span>Passo {step} de 5</span><strong>{['Sua barbearia','Serviços','Horários','Identidade','Revisar'][step-1]}</strong></div><div className="ob-progress-track"><i style={{width:`${step/5*100}%`}}/></div></section>
  <section className="ob-content">
   {notice&&<p className="ob-notice" role="status">{notice}</p>}
   {step===1&&<>
    <p className="ob-eyebrow">SUA BARBEARIA</p><h1>Qual é o nome do seu espaço?</h1><p className="ob-muted">Começamos pelo essencial. Você pode ajustar o restante depois.</p>
    <label>Nome da barbearia<input autoFocus value={name} maxLength={100} placeholder="Barbearia Oliveira" onChange={e=>{const next=e.target.value;setName(next);if(!shopId&&!slugTouched)setSlug(slugify(next));}}/></label>
    <label>WhatsApp<input value={whatsapp} inputMode="tel" type="tel" placeholder="(11) 99999-9999" onChange={e=>setWhatsapp(e.target.value)}/></label>
    <label>Instagram <small>opcional · pode digitar sem @</small><div className="ob-instagram-field"><span>@</span><input value={instagram} autoCapitalize="none" autoCorrect="off" placeholder="sua_barbearia" onChange={e=>setInstagram(cleanInstagram(e.target.value))}/></div></label>
    <label>Endereço <small>opcional</small><input value={address} placeholder="Rua, número e bairro" onChange={e=>setAddress(e.target.value)}/></label>
    <label>Link do seu site<div className="ob-public-link-field"><span>{host()}/</span><input className="ob-slug" value={slug} maxLength={60} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="nome-da-barbearia" onChange={e=>{setSlugTouched(true);setSlug(slugify(e.target.value));}}/></div><small className="ob-link-preview">Seu link: <b>{host()}/{slug||'nome-da-barbearia'}</b></small></label>
    <div className="ob-amenities"><span>Comodidades <small>opcional · marque apenas o que sua barbearia oferece</small></span><div>{amenityOptions.map(([key,label])=><button type="button" className={amenities.includes(key)?'selected':''} key={key} onClick={()=>setAmenities(a=>a.includes(key)?a.filter(x=>x!==key):[...a,key])}>{amenities.includes(key)?<Check size={14}/>:null}{label}</button>)}</div></div>
   </>}

   {step===2&&<>
    <p className="ob-eyebrow">SERVIÇOS</p><h1>O que você oferece?</h1><p className="ob-muted">Deixamos três exemplos prontos. Se eles servirem para você, não precisa mexer em nada: é só continuar.</p>
    <div className="ob-service-list">{services.map((s,index)=><article className="ob-service-card" key={s.id??s._key}>
     <div className="ob-service-card-head"><strong>Serviço {index+1}</strong><button type="button" className={s.active?'ob-service-status is-active':'ob-service-status'} onClick={()=>setServices(xs=>xs.map(x=>x._key===s._key?{...x,active:!x.active}:x))}>{s.active?'Ativo':'Inativo'}</button></div>
     <label>Nome do serviço<input value={s.name} placeholder="Ex.: Corte" onChange={e=>setServices(xs=>xs.map(x=>x._key===s._key?{...x,name:e.target.value}:x))}/></label>
     <label>Descrição <small>opcional</small><textarea value={s.description??''} maxLength={500} rows={2} placeholder="Ex.: Corte social com acabamento e finalização." onChange={e=>setServices(xs=>xs.map(x=>x._key===s._key?{...x,description:e.target.value}:x))}/></label>
     <div className="ob-service-fields"><label>Duração <span className="ob-input-suffix"><input inputMode="numeric" min="10" max="240" step="5" value={serviceDuration(s)} onFocus={e=>e.currentTarget.select()} onChange={e=>updateDuration(s._key,e.target.value.replace(/\D/g,'').slice(0,3))} onBlur={()=>setServices(xs=>xs.map(x=>x._key===s._key?{...x,_durationInput:undefined}:x))}/><small>min</small></span></label><label>Preço <span className="ob-input-prefix"><small>R$</small><input inputMode="decimal" value={servicePrice(s)} onFocus={e=>e.currentTarget.select()} onChange={e=>updatePrice(s._key,e.target.value.replace(/[^0-9,.]/g,'').replace(/([,.].*)[,.]/g,'$1').slice(0,9))} onBlur={()=>setServices(xs=>xs.map(x=>x._key===s._key?{...x,_priceInput:undefined}:x))}/></span></label></div>
     {!s.id&&services.length>1&&<button type="button" className="ob-remove-service" onClick={()=>setServices(xs=>xs.filter(x=>x._key!==s._key))}><Trash2 size={15}/>Remover</button>}
    </article>)}</div>
    <button type="button" className="ob-add" onClick={()=>setServices(xs=>[...xs,{_key:newKey(),name:'',description:'',duration_minutes:30,price_cents:0,active:true}])}><Plus size={16}/>Adicionar outro serviço</button>
   </>}

   {step===3&&<>
    <p className="ob-eyebrow">HORÁRIOS</p><h1>Quando sua barbearia abre?</h1><p className="ob-muted">Defina cada dia. Você pode deixar fechado ou usar horários diferentes no sábado e domingo.</p>
    <div className="ob-owner"><span className="ob-avatar">{(displayName||snapshot?.owner.display_name||'Você').split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><strong>{displayName||snapshot?.owner.display_name||'Você'}</strong><small>Responsável</small></div></div>
    <div className="ob-schedule-list">{weekdays.map(([value,label,longLabel])=>{const day=schedules.find(d=>d.weekday===Number(value))!;return <article className={`ob-schedule-row ${day.enabled?'is-open':''}`} key={value}><button type="button" className="ob-day-toggle" onClick={()=>{setHoursSaved(false);setSchedules(xs=>xs.map(x=>x.weekday===day.weekday?{...x,enabled:!x.enabled}:x));}}><span><strong>{label}</strong><small>{longLabel}</small></span><b>{day.enabled?'Aberto':'Fechado'}</b></button>{day.enabled&&<div className="ob-day-times"><label>Abre às<input type="time" value={day.opensAt} onChange={e=>{setHoursSaved(false);setSchedules(xs=>xs.map(x=>x.weekday===day.weekday?{...x,opensAt:e.target.value}:x));}}/></label><label>Fecha às<input type="time" value={day.closesAt} onChange={e=>{setHoursSaved(false);setSchedules(xs=>xs.map(x=>x.weekday===day.weekday?{...x,closesAt:e.target.value}:x));}}/></label></div>}</article>;})}</div>
    <p className="ob-muted ob-small">Depois você pode alterar os horários normalmente pelo FIO Gestão.</p>
   </>}

   {step===4&&<>
    <p className="ob-eyebrow">IDENTIDADE</p><h1>Como seus clientes vão ver sua barbearia?</h1><p className="ob-muted">Escolha a aparência do seu espaço. A prévia abaixo mostra como a identidade começa a aparecer para o cliente.</p>
    <div className="ob-palette-grid">{palettes.map(p=><button type="button" className={paletteKey===p.palette_key?'selected':''} key={p.palette_key} onClick={()=>setPaletteKey(p.palette_key)} style={{'--swatch':themeMode==='dark'?p.dark_accent:p.light_accent} as React.CSSProperties}><i/><span>{p.label}</span></button>)}<button type="button" className={paletteKey==='custom'?'selected':''} onClick={()=>setPaletteKey('custom')}><i style={{background:customAccent}}/><span>Personalizado</span></button></div>
    {paletteKey==='custom'&&<label>Cor principal<input type="color" value={customAccent} onChange={e=>setCustomAccent(e.target.value)}/></label>}
    <div className="ob-theme"><button type="button" className={themeMode==='dark'?'selected':''} onClick={()=>setThemeMode('dark')}>Escuro</button><button type="button" className={themeMode==='light'?'selected':''} onClick={()=>setThemeMode('light')}>Claro</button></div>
    <div className="ob-upload-grid"><label><span><ImagePlus size={17}/>Logo <small>obrigatória</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload(e,'logo')}/>{logoPath?<small>Enviada · será usada no app dos clientes</small>:<small>Escolha a logo da barbearia</small>}</label><label><span><ImagePlus size={17}/>Capa <small>opcional</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload(e,'cover')}/>{coverPath&&<small>Enviada</small>}</label><label><span><ImagePlus size={17}/>Fundo <small>opcional</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload(e,'background')}/>{backgroundPath&&<small>Enviada</small>}</label></div>
    <div className="ob-preview"><div className="ob-preview-logo">{logoPreview?<img src={logoPreview} alt="Prévia da logo"/>:<span>LOGO</span>}</div><div><small>PRÉVIA DO CLIENTE</small><strong>{name||'Sua barbearia'}</strong><span>{services.find(s=>s.active)?.name||'Corte'} · {money(services.find(s=>s.active)?.price_cents??3500)}</span></div><button type="button" style={{background:'var(--ob-accent)'}}>Agendar</button></div>
   </>}

   {step===5&&<>
    <p className="ob-eyebrow">REVISAR</p><h1>Confira antes de publicar.</h1><p className="ob-muted">Aqui não tem nada para preencher. Se algo estiver pendente, toque em Voltar e conclua a etapa indicada.</p>
    <div className="ob-review"><div><strong>{name||'Sua barbearia'}</strong><span>{savedActiveServices.length} serviço{savedActiveServices.length===1?'':'s'} salvo{savedActiveServices.length===1?'':'s'}</span>{scheduleSummary(schedules).map(line=><span key={line}>{line}</span>)}<span>{whatsapp?'WhatsApp configurado':'WhatsApp pendente'}</span><span>{logoPath?'Logo pronta para o aplicativo':'Logo pendente'}</span></div><div className="ob-review-preview" style={previewStyle}><strong>{name||'Sua barbearia'}</strong><small>{selectedPalette?.label??'Personalizado'} · tema {themeMode==='dark'?'escuro':'claro'}</small></div></div>
    {missingRequirements.length?<div className="ob-required"><strong>Falta concluir</strong>{missingRequirements.map(item=><span key={item}>• {item}</span>)}</div>:<div className="ob-ready"><Check size={17}/><span>Tudo certo para publicar.</span></div>}
   </>}
   {error&&<p className="ob-error" role="alert">{error}</p>}
  </section>
  <footer className="ob-footer">
   <button type="button" className="ob-secondary" disabled={step===1||busy} onClick={()=>{setError('');setNotice('');setStep(s=>Math.max(1,s-1));}}><ChevronLeft size={17}/>Voltar</button>
   {step>=2&&step<=4&&<button type="button" className="ob-skip" disabled={busy} onClick={()=>void skipStep()}>Pular por agora</button>}
   {step<5?<button type="button" className="ob-primary" disabled={!canContinue||busy} onClick={()=>void nextStep()}>{busy?'Salvando…':'Continuar'}<ChevronRight size={17}/></button>:<button type="button" className="ob-primary" disabled={busy||missingRequirements.length>0} onClick={()=>void activate()}>{busy?'Ativando…':'Ativar minha barbearia'}<Check size={17}/></button>}
  </footer>
 </main>;
}
