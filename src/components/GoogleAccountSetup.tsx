import {useState,type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../lib/api';
import {Field} from './ui';
import {Eye,EyeOff} from 'lucide-react';

const strongPassword=(value:string)=>value.length>=8&&/[A-Z]/.test(value)&&/[a-z]/.test(value)&&/[^A-Za-z0-9]/.test(value);

/**
 * A conta Google já está autenticada e o email já foi validado pelo Google.
 * Esta etapa completa somente o perfil local e define uma senha na MESMA conta.
 * A proteção das rotas e das operações continua sendo feita pelo servidor/RLS.
 */
export function GoogleAccountSetup({session}:{session:Session}){
 const user=session.user;
 const [name,setName]=useState(String(user.user_metadata?.full_name??user.user_metadata?.name??''));
 const [phone,setPhone]=useState(String(user.user_metadata?.account_phone??''));
 const [password,setPassword]=useState('');
 const [repeat,setRepeat]=useState('');
 const [show,setShow]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const email=user.email??'';

 async function complete(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy)return;
  setError('');
  if(name.trim().length<2){setError('Informe seu nome.');return;}
  const digits=phone.replace(/\D/g,'');
  if(digits.length<10||digits.length>13){setError('Informe um telefone válido, com DDD.');return;}
  if(!strongPassword(password)){setError('Use ao menos 8 caracteres, com letra maiúscula, minúscula e símbolo.');return;}
  if(password!==repeat){setError('As senhas não coincidem.');return;}
  if(!supabase){setError('Conexão indisponível. Tente novamente.');return;}
  setBusy(true);
  try{
   const current=await supabase.auth.getUser();
   if(current.error||current.data.user?.id!==user.id){setError('Sua sessão mudou. Entre novamente com Google.');return;}
   const result=await supabase.auth.updateUser({
    password,
    data:{display_name:name.trim(),account_phone:phone.trim(),fio_google_setup_completed:true}
   });
   if(result.error){setError('Não foi possível definir a senha. Tente novamente.');return;}
   const audience=(()=>{try{return sessionStorage.getItem('fio-google-audience')||'owner';}catch{return 'owner';}})();
   const shop=(()=>{try{return sessionStorage.getItem('fio-google-shop')||'';}catch{return '';}})();
   const safeAudience=['owner','staff','client'].includes(audience)?audience:'owner';
   try{sessionStorage.removeItem('fio-google-audience');sessionStorage.removeItem('fio-google-shop');}catch{}
   await supabase.auth.signOut({scope:'local'});
   const params=new URLSearchParams({audience:safeAudience,email});
   if(safeAudience==='client'&&/^[a-z0-9-]{3,60}$/.test(shop))params.set('shop',shop);
   const loginRoute='/login';
   window.location.replace(`${loginRoute}?${params.toString()}`);
  }catch{
   setError('Não foi possível concluir o cadastro. Confira sua conexão e tente novamente.');
  }finally{setBusy(false);}
 }

 return <div className="auth-page auth-page--login">
  <span className="auth-logo"><img src="/FIOlogo+nome/Branco.png" alt="FIO"/></span>
  <div className="auth-card auth-card--login">
   <p className="eyebrow">CONTINUE SEU CADASTRO</p>
   <h1>Complete sua conta FIO</h1>
   <p className="muted">Seu e-mail já foi verificado pelo Google. Agora informe seus dados e crie uma senha para também entrar sem o Google.</p>
   <form onSubmit={complete}>
    <Field label="E-mail do Google"><input type="email" value={email} readOnly autoComplete="email"/></Field>
    <Field label="Seu nome"><input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></Field>
    <Field label="Telefone com DDD"><input required type="tel" inputMode="tel" autoComplete="tel" placeholder="(61) 99999-9999" value={phone} maxLength={24} onChange={e=>setPhone(e.target.value)}/></Field>
    <Field label="Crie sua senha"><div style={{position:'relative'}}><input required type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" minLength={8} style={{paddingRight:48}}/><button type="button" aria-label={show?'Ocultar senha':'Mostrar senha'} onClick={()=>setShow(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',display:'grid',placeItems:'center',width:32,height:32,padding:0,border:0,background:'transparent',color:'inherit',cursor:'pointer'}}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div><small>8 caracteres ou mais, com maiúscula, minúscula e símbolo.</small></Field>
    <Field label="Confirme sua senha"><input required type={show?'text':'password'} value={repeat} onChange={e=>setRepeat(e.target.value)} autoComplete="new-password" minLength={8}/></Field>
    {error&&<p className="notice" role="alert">{error}</p>}
    <button className="primary full" type="submit" disabled={busy}>{busy?'Concluindo...':'Concluir cadastro'}</button>
    <p className="muted">Depois, entre com seu e-mail e senha para configurar o perfil no FIO.</p>
   </form>
  </div>
 </div>;
}
