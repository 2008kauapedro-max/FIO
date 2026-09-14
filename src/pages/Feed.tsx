import { useEffect,useMemo,useRef,useState,type ChangeEvent,type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera,ImagePlus,Plus,Trash2,X } from 'lucide-react';
import type { FeedPost } from '../../shared/domain';
import { api,supabase } from '../lib/api';
import { Empty,Modal,PageTitle } from '../components/ui';
import type { WorkspaceProps } from './Workspace';

const MAX_IMAGE_BYTES=8*1024*1024;
const ALLOWED_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const relative=(iso:string)=>{
 const diff=Math.max(0,Date.now()-new Date(iso).getTime());
 const minutes=Math.floor(diff/60000);
 if(minutes<1)return 'agora';
 if(minutes<60)return `há ${minutes} min`;
 const hours=Math.floor(minutes/60);
 if(hours<24)return `há ${hours} h`;
 const days=Math.floor(hours/24);
 return days===1?'ontem':`há ${days} dias`;
};

export function Feed(p:WorkspaceProps){
 const {data}=p,canPost=data.membership.role==='OWNER'||data.membership.role==='BARBER',navigate=useNavigate();
 const [composer,setComposer]=useState(false),[urls,setUrls]=useState<Record<string,string>>({}),[removing,setRemoving]=useState<string|null>(null);
 useEffect(()=>{
  let alive=true;
  const local:Record<string,string>={};
  const run=async()=>{
   if(p.demo){for(const post of data.posts)local[post.id]=post.image_path;if(alive)setUrls(local);return;}
   const storageClient=supabase;
   if(!storageClient)return;
   await Promise.all(data.posts.map(async post=>{
    const {data:signed}=await storageClient.storage.from('feed-posts').createSignedUrl(post.image_path,3600);
    if(signed?.signedUrl)local[post.id]=signed.signedUrl;
   }));
   if(alive)setUrls(local);
  };
  void run();return()=>{alive=false;};
 },[data.posts,p.demo]);
 const featured=useMemo(()=>data.team.filter(member=>member.role==='BARBER').slice(0,8),[data.team]);
 async function remove(post:FeedPost){
  if(!confirm('Remover esta publicação do feed?'))return;
  setRemoving(post.id);
  try{
   if(p.demo){p.updateDemo(d=>({...d,posts:d.posts.filter(item=>item.id!==post.id)}));}
   else{
    await api(`/posts/${post.id}`,data.shop.id,undefined,'DELETE');
    await supabase?.storage.from('feed-posts').remove([post.image_path]);
    await p.refresh();
   }
   p.notify('Publicação removida.');
  }catch(e){p.notify((e as Error).message);}finally{setRemoving(null);}
 }
 return <>
  <PageTitle eyebrow="INSPIRAÇÃO DA CASA" title="Feed" description="Cortes, detalhes e trabalhos da equipe em um só lugar." action={canPost?<button className="primary" onClick={()=>setComposer(true)}><Plus size={18}/>Nova publicação</button>:undefined}/>
  {featured.length>0&&<section className="feed-team" aria-label="Profissionais"><div className="section-title"><h2>Profissionais</h2><span className="muted">Trabalhos recentes da equipe</span></div><div className="feed-team-scroll">{featured.map(member=><button className="feed-team-person feed-team-button" key={member.user_id} onClick={()=>navigate(`${p.base}/equipe`)}><span className="feed-team-avatar">{member.display_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><strong>{member.display_name.split(' ')[0]}</strong><small>Contato</small></button>)}</div></section>}
  {data.posts.length?<section className="feed-grid">{data.posts.map(post=>{
   const canDelete=canPost&&(data.membership.role==='OWNER'||post.author_id===data.membership.user_id);
   return <article className="feed-card" key={post.id}>
    <div className="feed-image-wrap">{urls[post.id]?<img src={urls[post.id]} alt={`Trabalho publicado por ${post.author_name}`}/>:<div className="feed-image-loading fio-pattern-dark"><Camera size={28}/></div>}{canDelete&&<button className="feed-delete" aria-label="Remover publicação" disabled={removing===post.id} onClick={()=>void remove(post)}><Trash2 size={16}/></button>}</div>
    <div className="feed-card-body"><div className="feed-author"><span className="avatar small">{post.author_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><strong>{post.author_name}</strong><small>{relative(post.created_at)}</small></div></div>{post.caption&&<p>{post.caption}</p>}</div>
   </article>;
  })}</section>:<Empty title="O primeiro corte ainda vai aparecer aqui">{canPost?'Publique uma foto do trabalho da equipe para inaugurar o feed.':'Quando a equipe publicar novos trabalhos, eles aparecem aqui.'}</Empty>}
  {composer&&<PostComposer {...p} onClose={()=>setComposer(false)}/>} 
 </>;
}

function PostComposer(p:WorkspaceProps&{onClose:()=>void}){
 const input=useRef<HTMLInputElement>(null),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[caption,setCaption]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>{if(preview.startsWith('blob:'))URL.revokeObjectURL(preview);},[preview]);
 function choose(e:ChangeEvent<HTMLInputElement>){
  const next=e.target.files?.[0]??null;setError('');
  if(!next)return;
  if(!ALLOWED_TYPES.has(next.type)){setError('Use uma imagem JPG, PNG ou WEBP.');return;}
  if(next.size>MAX_IMAGE_BYTES){setError('A imagem pode ter no máximo 8 MB.');return;}
  if(preview.startsWith('blob:'))URL.revokeObjectURL(preview);
  setFile(next);setPreview(URL.createObjectURL(next));
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(!file){setError('Escolha uma foto do corte.');return;}setBusy(true);setError('');
  let uploadedPath='';
  try{
   if(p.demo){
    p.updateDemo(d=>({...d,posts:[{id:crypto.randomUUID(),author_id:d.membership.user_id,author_name:d.membership.display_name,caption:caption.trim(),image_path:preview,created_at:new Date().toISOString()},...d.posts]}));
   }else{
    if(!supabase)throw new Error('Supabase ainda não foi configurado.');
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    uploadedPath=`${p.data.shop.id}/${p.data.membership.user_id}/${crypto.randomUUID()}.${ext}`;
    const upload=await supabase.storage.from('feed-posts').upload(uploadedPath,file,{cacheControl:'3600',contentType:file.type,upsert:false});
    if(upload.error)throw new Error('Não foi possível enviar a imagem.');
    try{await api('/posts',p.data.shop.id,{caption:caption.trim(),imagePath:uploadedPath});}
    catch(error){await supabase.storage.from('feed-posts').remove([uploadedPath]);throw error;}
    await p.refresh();
   }
   p.notify('Publicado no feed.');p.onClose();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <Modal title="Nova publicação" onClose={p.onClose}><form className="post-composer" onSubmit={submit}>
  <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={choose}/>
  <button type="button" className={`post-picker ${preview?'has-preview':'fio-pattern-dark'}`} onClick={()=>input.current?.click()}>{preview?<><img src={preview} alt="Prévia da publicação"/><span><ImagePlus size={18}/>Trocar foto</span></>:<><ImagePlus size={28}/><strong>Escolher foto do corte</strong><small>JPG, PNG ou WEBP · até 8 MB</small></>}</button>
  <label className="field">Legenda<textarea value={caption} maxLength={500} rows={4} onChange={e=>setCaption(e.target.value)} placeholder="Conte um pouco sobre o corte, técnica ou acabamento..."/><span className="field-counter">{caption.length}/500</span></label>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="modal-actions"><button type="button" className="ghost" onClick={p.onClose} disabled={busy}><X size={17}/>Cancelar</button><button className="primary" disabled={busy||!file}>{busy?'Publicando...':'Publicar no feed'}</button></div>
 </form></Modal>;
}
