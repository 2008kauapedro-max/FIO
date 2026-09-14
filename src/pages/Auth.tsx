import { useState,type FormEvent } from 'react';
import { Link,useLocation,useNavigate } from 'react-router-dom';
import { supabase,api } from '../lib/api';
import { Field } from '../components/ui';

export function AuthPage({reset=false}:{reset?:boolean}) {
 const location=useLocation(),navigate=useNavigate();
 const params=new URLSearchParams(location.search),shop=params.get('shop')??'',audience=params.get('audience');
 const [mode,setMode]=useState<'login'|'signup'|'forgot'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setMessage('');
  if(!supabase){setMessage('A conexão do Supabase precisa ser configurada para acessar sua conta.');return;}
  setBusy(true);
  try{
   const redirect=`${window.location.origin}/reset-password`;
   const result=reset?await supabase.auth.updateUser({password}):mode==='signup'?await supabase.auth.signUp({email,password,options:{emailRedirectTo:shop?`${window.location.origin}/?shop=${encodeURIComponent(shop)}`:window.location.origin}}):mode==='forgot'?await supabase.auth.resetPasswordForEmail(email,{redirectTo:redirect}):await supabase.auth.signInWithPassword({email,password});
   if(result.error)setMessage(mode==='login'?'Não foi possível entrar. Confira seu e-mail e senha.':'Não foi possível concluir. Confira os dados e tente novamente.');
   else if(reset)navigate('/');
   else if(mode==='login')navigate(shop?`/?shop=${encodeURIComponent(shop)}`:'/');
   else setMessage(mode==='signup'?'Confira seu e-mail para confirmar o cadastro.':'Se houver uma conta com este e-mail, você receberá as instruções.');
  }catch{setMessage('Sem conexão. Tente novamente.');}finally{setBusy(false);}
 }
 const heading=reset?'Uma nova senha.':mode==='signup'?'Seu próximo capítulo.':mode==='forgot'?'Vamos recuperar seu acesso.':audience==='client'?'Seu espaço está pronto.':'Tudo começa aqui.';
 return <div className="auth-page">
  <Link className="auth-logo" to="/"><img src="/branding/fio-mark.png" alt="FIO"/></Link>
  <div className="auth-card">
   <p className="eyebrow">{audience==='client'?'ACESSO DO CLIENTE':'BEM-VINDO AO FIO'}</p>
   <h1>{heading}</h1>
   <p className="muted">{audience==='client'?'Entre e cuide dos seus horários sem complicação.':'Sua barbearia. Seu tempo. Em sintonia.'}</p>
   <form onSubmit={submit}>
    {!reset&&<Field label="E-mail"><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></Field>}
    {(reset||mode!=='forgot')&&<Field label="Senha"><input type="password" minLength={8} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} required/></Field>}
    {message&&<p role="status" className="notice">{message}</p>}
    <button className="primary full" disabled={busy}>{busy?'Aguarde…':reset?'Salvar senha':mode==='signup'?'Criar conta':mode==='forgot'?'Enviar instruções':'Entrar'}</button>
   </form>
   {!reset&&<div className="auth-options"><button className="text-button" onClick={()=>{setMode(mode==='signup'?'login':'signup');setMessage('');}}>{mode==='signup'?'Já tenho uma conta':'Criar uma conta'}</button><button className="text-button" onClick={()=>{setMode('forgot');setMessage('');}}>Esqueci minha senha</button></div>}
  </div>
  <p className="auth-footer">MENOS RUÍDO. MAIS FIO.</p>
 </div>;
}

export function Onboarding({onDone}:{onDone:()=>void}) {
 const params=new URLSearchParams(window.location.search),token=params.get('invite'),presetShop=params.get('shop')??'';
 const [mode,setMode]=useState<'create'|'join'|'invite'>(token?'invite':presetShop?'join':'create');
 const [name,setName]=useState(''),[slug,setSlug]=useState(presetShop),[displayName,setDisplayName]=useState(''),[phone,setPhone]=useState(''),[invite,setInvite]=useState(token??''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const r=await api<{barbershopId:string}>('/onboarding',undefined,{mode,displayName,...(mode==='create'?{name,slug}:mode==='join'?{slug}:{token:invite})});
   sessionStorage.setItem('fio-shop',r.barbershopId);
   if(phone.trim())await api('/profile/contact',r.barbershopId,{phone:phone.trim()},'PATCH');
   onDone();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="auth-page">
  <span className="auth-logo"><img src="/branding/fio-mark.png" alt="FIO"/></span>
  <div className="auth-card">
   <p className="eyebrow">SEU ESPAÇO</p><h1>Vamos conectar os pontos.</h1>
   <div className="segmented">{([['create','Sou responsável'],['join','Sou cliente'],['invite','Tenho convite']] as const).map(([v,t])=><button type="button" className={mode===v?'selected':''} key={v} onClick={()=>setMode(v)}>{t}</button>)}</div>
   <form onSubmit={submit}>
    <Field label="Seu nome"><input minLength={2} maxLength={100} required value={displayName} onChange={e=>setDisplayName(e.target.value)}/></Field>
    <Field label="WhatsApp / telefone"><input type="tel" inputMode="tel" placeholder="(61) 99999-9999" minLength={8} maxLength={24} value={phone} onChange={e=>setPhone(e.target.value)}/></Field>
    {mode==='create'&&<Field label="Nome da barbearia"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field>}
    {mode!=='invite'?<Field label="Identificador da barbearia"><input required pattern="[a-z0-9-]{3,60}" placeholder="ex.: studio-011" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/></Field>:<Field label="Código do convite"><input required value={invite} onChange={e=>setInvite(e.target.value)}/></Field>}
    {error&&<p className="notice" role="alert">{error}</p>}
    <button className="primary full" disabled={busy}>{busy?'Conectando…':'Continuar'}</button>
   </form>
   <button className="text-button" onClick={()=>supabase?.auth.signOut()}>Sair da conta</button>
  </div>
 </div>;
}
