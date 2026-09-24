import {AuthCaptcha,captchaSiteKey} from '../components/AuthCaptcha';
import { useEffect,useState,type FormEvent } from 'react';
import { Link,useLocation,useNavigate } from 'react-router-dom';
import { supabase,api,getRememberSession,setRememberSession } from '../lib/api';
import { Field } from '../components/ui';
import { CheckCircle2,Eye,EyeOff,LoaderCircle } from 'lucide-react';
import { OwnerOnboarding } from './OwnerOnboarding';

type AuthMode='login'|'signup'|'forgot';

export function AuthPage({reset=false}:{reset?:boolean}) {
 const location=useLocation(),navigate=useNavigate();
 const params=new URLSearchParams(location.search);
 const shop=params.get('shop')??'';
 const audience=params.get('audience')??'';
 const requestedMode=params.get('mode');
 const initialMode:AuthMode=requestedMode==='forgot'?'forgot':requestedMode==='signup'?'signup':'login';

 const [mode,setMode]=useState<AuthMode>(initialMode);
 const [email,setEmail]=useState(params.get('email')??'');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [resetReady,setResetReady]=useState(!reset);
 const [resetInvalid,setResetInvalid]=useState(false);
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirmPassword,setShowConfirmPassword]=useState(false);
 const [remember,setRemember]=useState(()=>getRememberSession());
 const [captchaToken,setCaptchaToken]=useState(''),[captchaAttempt,setCaptchaAttempt]=useState(0);
 useEffect(()=>{const restore=()=>setBusy(false);window.addEventListener('pageshow',restore);return()=>window.removeEventListener('pageshow',restore);},[]);
 const needsCaptcha=Boolean(captchaSiteKey)&&!reset;
 useEffect(()=>{setCaptchaToken('');setCaptchaAttempt(v=>v+1);},[mode,reset]);

 useEffect(()=>{
  if(!reset||!supabase)return;
  const authClient=supabase;
  let active=true;

  const check=async()=>{
   const {data:{session}}=await authClient.auth.getSession();
   if(!active)return;
   if(session){
    setResetReady(true);
    setResetInvalid(false);
   }else{
    window.setTimeout(async()=>{
     const {data:{session:lateSession}}=await authClient.auth.getSession();
     if(!active)return;
     setResetReady(Boolean(lateSession));
     setResetInvalid(!lateSession);
    },900);
   }
  };

  void check();

  const {data:{subscription}}=authClient.auth.onAuthStateChange((event,session)=>{
   if(!active)return;
   if(event==='PASSWORD_RECOVERY'||session){
    setResetReady(true);
    setResetInvalid(false);
   }
  });

  return()=>{
   active=false;
   subscription.unsubscribe();
  };
 },[reset]);

 useEffect(()=>{
  if(reset||mode!=='login'||!supabase)return;
  let active=true;
  let redirected=false;
  const goToAccount=(sessionExists:boolean)=>{
   if(!active||!sessionExists||redirected)return;
   redirected=true;
   if(audience==='platform')navigate('/platform',{replace:true});
   else if(audience==='owner')navigate('/owner',{replace:true});
   else if(audience==='staff')navigate('/barber',{replace:true});
   else if(audience==='client')navigate(shop?`/?shop=${encodeURIComponent(shop)}&audience=client`:'/client',{replace:true});
   else navigate('/',{replace:true});
  };
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>goToAccount(Boolean(session)));
  void supabase.auth.getSession().then(({data:{session}})=>goToAccount(Boolean(session)));
  return()=>{active=false;subscription.unsubscribe();};
 },[reset,mode,audience,shop,navigate]);

 useEffect(()=>{
  if(reset)return;
  const callbackParams=new URLSearchParams(location.search);
  const fragmentParams=new URLSearchParams(location.hash.replace(/^#/,'').replace(/^\?/,'') );
  const oauthError=callbackParams.get('error_description')||callbackParams.get('error')||callbackParams.get('error_code')||fragmentParams.get('error_description')||fragmentParams.get('error')||fragmentParams.get('error_code');
  if(!oauthError)return;
  setMessage(oauthError==='access_denied'?'O acesso pelo Google foi cancelado. Você pode tentar novamente.':'O Google não conseguiu concluir o acesso. Confira a configuração do login Google e tente novamente.');
  for(const params of [callbackParams,fragmentParams]){params.delete('error');params.delete('error_description');params.delete('error_code');}
  const cleanSearch=callbackParams.toString();
  const cleanHash=fragmentParams.toString();
  navigate({pathname:location.pathname,search:cleanSearch?`?${cleanSearch}`:'',hash:cleanHash?`#${cleanHash}`:''},{replace:true});
 },[location.pathname,location.search,location.hash,navigate,reset]);

 const destination=()=>{
  if(audience==='platform')return '/acesso/plataforma';
  if(audience==='owner')return '/acesso/gestao';
  if(audience==='staff')return '/acesso/equipe';
  if(audience==='client'&&shop)return `/login?shop=${encodeURIComponent(shop)}&audience=client`;
  return '/login';
 };

 async function signInWithGoogle(){
  setMessage('');
  if(!supabase){setMessage('Não foi possível abrir o login agora. Tente novamente.');return;}
  setRememberSession(remember);setBusy(true);
  try{
   const query=new URLSearchParams();
   query.set('audience',audience||'owner');
   if(shop)query.set('shop',shop);
   const redirectTo=`${window.location.origin}/login${query.toString()?`?${query.toString()}`:''}`;
   try{localStorage.setItem('fio-tour:google-signup-started',String(Date.now()));}catch{}
   const result=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});
   if(result.error)throw result.error;
  }catch{setMessage('Não foi possível abrir o Google agora. Tente novamente.');setBusy(false);}
 }

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const form=new FormData(e.currentTarget);
  const submittedPassword=String(form.get('password')??password);
  const submittedConfirmPassword=String(form.get('confirmPassword')??confirmPassword);
  setMessage('');

  if(!supabase){
   setMessage('O acesso está temporariamente indisponível. Tente novamente mais tarde.');
   return;
  }

  if(reset){
   if(!resetReady){
    setMessage('Este link de recuperação é inválido ou expirou. Solicite um novo link.');
    return;
   }
   if(submittedPassword.length<8){
    setMessage('A nova senha precisa ter pelo menos 8 caracteres.');
    return;
   }
   if(submittedPassword!==submittedConfirmPassword){
    setMessage('As senhas não são iguais. Confira e tente novamente.');
    return;
   }
  }

  if(needsCaptcha&&!captchaToken){setMessage('Conclua a verificação de segurança para continuar.');return;}
  setBusy(true);

  try{
   if(reset){
    const result=await supabase.auth.updateUser({password:submittedPassword});
    if(result.error){
     setMessage('Não foi possível alterar a senha. O link pode ter expirado. Solicite um novo link.');
     return;
    }
    setMessage('Senha alterada com sucesso.');
    window.setTimeout(()=>navigate(destination(),{replace:true}),700);
    return;
   }

   if(mode==='forgot'){
    const query=new URLSearchParams();
    if(audience)query.set('audience',audience);
    if(shop)query.set('shop',shop);
    const suffix=query.toString()?`?${query.toString()}`:'';
    const redirect=`${window.location.origin}/reset-password${suffix}`;
    const result=await supabase.auth.resetPasswordForEmail(email,{redirectTo:redirect,captchaToken:captchaToken||undefined});

    if(result.error){
     setMessage('Não foi possível enviar o link agora. Confira o e-mail e tente novamente.');
     return;
    }

    setMessage('Pronto. Se existir uma conta com este e-mail, você receberá um link para criar uma nova senha.');
    return;
   }

   if(mode==='signup'){
    setRememberSession(remember);
    const confirmationAudience=audience||'owner';
    const query=new URLSearchParams({audience:confirmationAudience,email:email.trim()});
    if(shop)query.set('shop',shop);
    const result=await supabase.auth.signUp({
     email,
     password,
     options:{captchaToken:captchaToken||undefined,emailRedirectTo:`${window.location.origin}/confirm-email?${query.toString()}`}
    });

    if(result.error){
     setMessage('Não foi possível criar a conta. Confira os dados e tente novamente.');
     return;
    }

    // Só a conta criada nesta etapa recebe o tutorial de boas-vindas.
    // Usuários que já existiam e apenas fizerem login não verão a abertura automática.
    if(result.data.user?.identities?.length){
     try{localStorage.setItem(`fio-tour:new-account:${result.data.user.id}`,'pending');}catch{}
    }

    setMessage('Confira seu e-mail para confirmar o cadastro.');
    return;
   }

   setRememberSession(remember);
   const result=await supabase.auth.signInWithPassword({email,password:submittedPassword,options:{captchaToken:captchaToken||undefined}});
   if(result.error){
    setMessage('Não foi possível entrar. Confira seu e-mail e senha.');
    return;
   }

   if(audience==='platform')navigate('/platform',{replace:true});
   else if(audience==='owner')navigate('/owner',{replace:true});
   else if(audience==='staff')navigate('/barber',{replace:true});
   else if(audience==='client')navigate(shop?`/?shop=${encodeURIComponent(shop)}&audience=client`:'/client',{replace:true});
   else navigate('/',{replace:true});
  }catch{
   setMessage('Sem conexão. Tente novamente.');
  }finally{
   setBusy(false);
   setCaptchaToken('');setCaptchaAttempt(v=>v+1);
  }
 }

 const heading=reset
  ?'Crie sua nova senha.'
  :mode==='signup'
   ?'Seu próximo capítulo.'
   :mode==='forgot'
    ?'Recupere seu acesso.'
    :audience==='client'
     ?'Seu espaço está pronto.'
     :'Tudo começa aqui.';

 const description=reset
  ?'Digite a nova senha duas vezes para confirmar.'
  :mode==='forgot'
   ?'Informe seu e-mail e enviaremos um link seguro para você criar uma nova senha.'
   :audience==='client'
    ?'Entre e cuide dos seus horários sem complicação.'
    :'Sua barbearia. Seu tempo. Em sintonia.';

 if(reset&&!supabase){
  return <div className="auth-page">
   <Link className="auth-logo" to="/"><img src="/FIOlogo/FIObranco.png" alt="FIO"/></Link>
   <div className="auth-card">
    <p className="eyebrow">RECUPERAÇÃO DE SENHA</p>
    <h1>Não foi possível abrir.</h1>
    <p className="notice">O acesso está temporariamente indisponível.</p>
   </div>
  </div>;
 }

 if(reset&&!resetReady&&!resetInvalid){
  return <div className="auth-page">
   <span className="auth-logo"><img src="/FIOlogo/FIObranco.png" alt="FIO"/></span>
   <div className="auth-card">
    <p className="eyebrow">RECUPERAÇÃO DE SENHA</p>
    <h1>Validando seu link…</h1>
    <p className="muted">Só um instante.</p>
   </div>
  </div>;
 }

 if(reset&&resetInvalid){
  return <div className="auth-page">
   <Link className="auth-logo" to={destination()}><img src="/FIOlogo/FIObranco.png" alt="FIO"/></Link>
   <div className="auth-card">
    <p className="eyebrow">RECUPERAÇÃO DE SENHA</p>
    <h1>Esse link não é mais válido.</h1>
    <p className="muted">Ele pode ter expirado ou já ter sido usado. Solicite um novo link para continuar.</p>
    <Link className="primary full" to={`/login?mode=forgot${audience?`&audience=${encodeURIComponent(audience)}`:''}${shop?`&shop=${encodeURIComponent(shop)}`:''}`}>Solicitar novo link</Link>
   </div>
   <p className="auth-footer">MENOS RUÍDO. MAIS FIO.</p>
  </div>;
 }

 return <div className="auth-page auth-page--login">
  <Link className="auth-logo" to="/"><img src="/FIOlogo/FIObranco.png" alt="FIO"/></Link>

  <div className="auth-card auth-card--login">
   <p className="eyebrow">{reset?'RECUPERAÇÃO DE SENHA':audience==='client'?'ACESSO DO CLIENTE':'BEM-VINDO AO FIO'}</p>
   <h1>{heading}</h1>
   <p className="muted">{description}</p>

   <form onSubmit={submit}>
    {!reset&&<Field label="E-mail">
     <input
      type="email"
      autoComplete="email"
      value={email}
      onChange={e=>setEmail(e.target.value)}
      required
     />
    </Field>}

    {(reset||mode!=='forgot')&&<Field label={reset?'Nova senha':'Senha'}>
      <div style={{position:'relative'}}>
       <input name="password" type={showPassword?'text':'password'} minLength={8}
        autoComplete={mode==='login'&&!reset?'current-password':'new-password'}
        value={password} onChange={e=>setPassword(e.target.value)}
        style={{paddingRight:48}} required />
       <button type="button" aria-label={showPassword?'Ocultar senha':'Mostrar senha'}
        title={showPassword?'Ocultar senha':'Mostrar senha'} onClick={()=>setShowPassword(v=>!v)}
        style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',display:'grid',placeItems:'center',width:32,height:32,padding:0,border:0,background:'transparent',color:'inherit',cursor:'pointer'}}>
        {showPassword?<EyeOff size={18}/>:<Eye size={18}/>}
       </button>
      </div>
     </Field>}

    {reset&&<Field label="Confirmar nova senha">
      <div style={{position:'relative'}}>
       <input name="confirmPassword" type={showConfirmPassword?'text':'password'} minLength={8}
        autoComplete="new-password" value={confirmPassword}
        onChange={e=>setConfirmPassword(e.target.value)}
        style={{paddingRight:48}} required />
       <button type="button" aria-label={showConfirmPassword?'Ocultar confirmação de senha':'Mostrar confirmação de senha'}
        title={showConfirmPassword?'Ocultar senha':'Mostrar senha'} onClick={()=>setShowConfirmPassword(v=>!v)}
        style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',display:'grid',placeItems:'center',width:32,height:32,padding:0,border:0,background:'transparent',color:'inherit',cursor:'pointer'}}>
        {showConfirmPassword?<EyeOff size={18}/>:<Eye size={18}/>}
       </button>
      </div>
     </Field>}

    {!reset&&mode==='login'&&<label className="remember-session"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span>Manter conectado neste dispositivo</span></label>}

    {needsCaptcha&&<AuthCaptcha onToken={setCaptchaToken} attempt={captchaAttempt}/>}
    {message&&<p role="status" className="notice">{message}</p>}

    <button className="primary full" disabled={busy||(needsCaptcha&&!captchaToken)}>
     {busy
      ?'Aguarde…'
      :reset
       ?'Salvar nova senha'
       :mode==='signup'
        ?'Criar conta'
        :mode==='forgot'
         ?'Enviar link de recuperação'
         :'Entrar'}
    </button>
   </form>

   {!reset&&<div className="auth-options">
    {mode==='forgot'
     ?<button type="button" className="text-button" onClick={()=>{setMode('login');setMessage('');}}>Voltar para entrar</button>
     :<>
       <button type="button" className="text-button" onClick={()=>{setMode(mode==='signup'?'login':'signup');setMessage('');}}>
        {mode==='signup'?'Já tenho uma conta':'Criar uma conta'}
       </button>
       <button type="button" className="text-button" onClick={()=>{setMode('forgot');setMessage('');}}>Esqueci minha senha</button>
      </>}
   </div>}
   {!reset&&mode!=='forgot'&&<>
    <div className="auth-divider" style={{display:'flex',alignItems:'center',gap:16,margin:'22px 0',color:'#888',fontSize:13}}><span style={{flex:1,height:1,background:'currentColor',opacity:.3}}/><span>ou</span><span style={{flex:1,height:1,background:'currentColor',opacity:.3}}/></div>
    <button type="button" className="oauth-button" disabled={busy} onClick={()=>void signInWithGoogle()}>
     <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false" style={{flexShrink:0}}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55Z"/>
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/>
     </svg>
     Continuar com Google
    </button>
   </>}


  </div>

  <p className="auth-footer">MENOS RUÍDO. MAIS FIO.</p>
 </div>;
}

function ClientJoinOnboarding({onDone,slug}:{onDone:()=>void;slug:string}) {
 const [displayName,setDisplayName]=useState(''),[phone,setPhone]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const r=await api<{barbershopId:string}>('/onboarding',undefined,{mode:'join',slug,displayName:displayName.trim()});
   sessionStorage.setItem('fio-shop',r.barbershopId);
   if(phone.trim())await api('/profile/contact',r.barbershopId,{displayName:displayName.trim(),phone:phone.trim()},'PATCH');
   onDone();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="auth-page">
  <span className="auth-logo"><img src="/FIOlogo/FIObranco.png" alt="FIO"/></span>
  <div className="auth-card">
   <p className="eyebrow">SEU PERFIL</p><h1>Como podemos te chamar?</h1><p className="muted">Só precisamos do básico para conectar sua conta a esta barbearia.</p>
   <form onSubmit={submit}>
    <Field label="Seu nome"><input minLength={2} maxLength={100} autoComplete="name" required value={displayName} onChange={e=>setDisplayName(e.target.value)}/></Field>
    <Field label="WhatsApp / telefone (opcional)"><input type="tel" inputMode="tel" autoComplete="tel" placeholder="(61) 99999-9999" minLength={8} maxLength={24} value={phone} onChange={e=>setPhone(e.target.value)}/></Field>
    {error&&<p className="notice" role="alert">{error}</p>}
    <button className="primary full" disabled={busy}>{busy?'Entrando…':'Entrar na barbearia'}</button>
   </form>
   <button type="button" className="text-button" onClick={()=>supabase?.auth.signOut()}>Usar outra conta</button>
  </div>
  <p className="auth-footer">MENOS RUÍDO. MAIS FIO.</p>
 </div>;
}

function LegacyOnboarding({onDone}:{onDone:()=>void}) {
 const params=new URLSearchParams(window.location.search),token=params.get('invite'),presetShop=params.get('shop')??'';
 const [mode,setMode]=useState<'create'|'join'|'invite'>(token?'invite':presetShop?'join':'create');
 const [name,setName]=useState(''),[slug,setSlug]=useState(presetShop),[displayName,setDisplayName]=useState(''),[phone,setPhone]=useState(''),[invite,setInvite]=useState(token??''),[error,setError]=useState(''),[busy,setBusy]=useState(false);

 async function submit(e:FormEvent){
  e.preventDefault();
  setBusy(true);
  setError('');
  try{
   const r=await api<{barbershopId:string}>('/onboarding',undefined,{mode,displayName,...(mode==='create'?{name,slug}:mode==='join'?{slug}:{token:invite})});
   sessionStorage.setItem('fio-shop',r.barbershopId);
   if(phone.trim())await api('/profile/contact',r.barbershopId,{displayName:displayName.trim(),phone:phone.trim()},'PATCH');
   onDone();
  }catch(e){
   setError((e as Error).message);
  }finally{
   setBusy(false);
  }
 }

 return <div className="auth-page">
  <span className="auth-logo"><img src="/FIOlogo/FIObranco.png" alt="FIO"/></span>
  <div className="auth-card">
   <p className="eyebrow">SEU ESPAÇO</p>
   <h1>Vamos conectar os pontos.</h1>

   <div className="segmented">
    {([['create','Sou responsável'],['join','Sou cliente'],['invite','Tenho convite']] as const).map(([v,t])=>
     <button type="button" className={mode===v?'selected':''} key={v} onClick={()=>setMode(v)}>{t}</button>
    )}
   </div>

   <form onSubmit={submit}>
    <Field label="Seu nome"><input minLength={2} maxLength={100} required value={displayName} onChange={e=>setDisplayName(e.target.value)}/></Field>
    <Field label="WhatsApp / telefone"><input type="tel" inputMode="tel" placeholder="(61) 99999-9999" minLength={8} maxLength={24} value={phone} onChange={e=>setPhone(e.target.value)}/></Field>
    {mode==='create'&&<Field label="Nome da barbearia"><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field>}
    {mode!=='invite'
     ?<Field label="Identificador da barbearia"><input required pattern="[a-z0-9-]{3,60}" placeholder="ex.: studio-011" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/></Field>
     :<Field label="Código do convite"><input required value={invite} onChange={e=>setInvite(e.target.value)}/></Field>}
    {error&&<p className="notice" role="alert">{error}</p>}
    <button className="primary full" disabled={busy}>{busy?'Conectando…':'Continuar'}</button>
   </form>

   <button className="text-button" onClick={()=>supabase?.auth.signOut()}>Sair da conta</button>
  </div>
 </div>;
}


export function EmailConfirmationPage(){
 const location=useLocation(),navigate=useNavigate();
 const params=new URLSearchParams(location.search);
 const audience=params.get('audience')||'owner';
 const shop=params.get('shop')??'';
 const email=params.get('email')??'';
 const [state,setState]=useState<'checking'|'confirmed'|'invalid'>('checking');

 useEffect(()=>{
  if(!supabase){setState('invalid');return;}
  const authClient=supabase;
  let active=true;
  const finish=(ok:boolean)=>{if(active)setState(ok?'confirmed':'invalid');};
  const check=async()=>{
   const {data:{session}}=await authClient.auth.getSession();
   if(session){finish(true);return;}
   window.setTimeout(async()=>{
    const {data:{session:late}}=await authClient.auth.getSession();
    finish(Boolean(late));
   },1200);
  };
  void check();
  const {data:{subscription}}=authClient.auth.onAuthStateChange((_event,session)=>{if(session)finish(true);});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);

 const back=async()=>{
  if(supabase)await supabase.auth.signOut({scope:'local'});
  const q=new URLSearchParams({audience});
  if(shop)q.set('shop',shop);
  if(email)q.set('email',email);
  navigate(`/login?${q.toString()}`,{replace:true});
 };

 return <div className="auth-page email-confirm-page">
  <span className="auth-logo"><img src="/FIOlogo/FIObranco.png" alt="FIO"/></span>
  <div className="auth-card email-confirm-card">
   {state==='checking'?<>
    <span className="email-confirm-icon is-loading"><LoaderCircle size={28}/></span>
    <p className="eyebrow">CONFIRMANDO SEU E-MAIL</p>
    <h1>Só um instante.</h1>
    <p className="muted">Estamos finalizando seu acesso ao FIO.</p>
   </>:state==='confirmed'?<>
    <span className="email-confirm-icon"><CheckCircle2 size={30}/></span>
    <p className="eyebrow">E-MAIL CONFIRMADO</p>
    <h1>Seu acesso está pronto.</h1>
    <p className="muted">Agora você já pode entrar no FIO com o e-mail e a senha que criou.</p>
    <button className="primary full" onClick={()=>void back()}>Voltar para entrar</button>
   </>:<>
    <p className="eyebrow">CONFIRMAÇÃO DE E-MAIL</p>
    <h1>Não foi possível confirmar este link.</h1>
    <p className="muted">Ele pode ter expirado ou já ter sido usado. Tente entrar normalmente; se necessário, crie a conta novamente.</p>
    <button className="primary full" onClick={()=>void back()}>Voltar para entrar</button>
   </>}
  </div>
  <p className="auth-footer">MENOS RUÍDO. MAIS FIO.</p>
 </div>;
}

export function Onboarding({onDone,shopId}:{onDone:()=>void;shopId?:string}) {
 const params=new URLSearchParams(window.location.search),audience=params.get('audience'),shop=params.get('shop')??'';
 if(audience==='client'&&shop)return <ClientJoinOnboarding onDone={onDone} slug={shop}/>;
 return <OwnerOnboarding onDone={onDone} shopId={shopId}/>;
}
