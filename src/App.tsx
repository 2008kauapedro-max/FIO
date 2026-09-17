import { useCallback,useEffect,useState,lazy,Suspense } from 'react';
import { Link,NavLink,Navigate,useLocation,useNavigate } from 'react-router-dom';
import { LayoutDashboard,CalendarDays,Sparkles,Users,Scissors,UserRound,Wallet,LogOut,Menu,X,ArrowUpRight,Images,Megaphone,Sun,Moon,Crown } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import type { Bootstrap,Membership,Role } from '../shared/domain';
import { roleHome } from '../shared/domain';
import { api,supabase } from './lib/api';
import { AuthPage,EmailConfirmationPage,Onboarding } from './pages/Auth';
import { Agenda,Customers,Dashboard,Reports,Services,Settings as SettingsPage,Subscriptions,Team,Communication,type WorkspaceProps } from './pages/Workspace';
import { AssistantChat } from './components/AssistantChat';
import { Feed } from './pages/Feed';
import { PublicPortal } from './pages/PublicPortal';
import { FioPlans } from './pages/FioPlans';
const PlatformApp=lazy(()=>import('./pages/Platform').then(m=>({default:m.PlatformApp})));
const PlatformLogin=lazy(()=>import('./pages/Platform').then(m=>({default:m.PlatformLogin})));


function AppLoading(){
 return <div className="fio-loading-screen" role="status" aria-label="Abrindo FIO"><img src="/FIOlogo/FIObranco.png" alt=""/></div>;
}

type NavItem={path:string;label:string;icon:typeof LayoutDashboard;roles:Role[]};
const navItems:NavItem[]=[
 {path:'',label:'Visão geral',icon:LayoutDashboard,roles:['OWNER','BARBER','CLIENT']},
 {path:'/agenda',label:'Agenda',icon:CalendarDays,roles:['OWNER','BARBER','CLIENT']},
 {path:'/assistente',label:'Assistente',icon:Sparkles,roles:['OWNER','BARBER','CLIENT']},
 {path:'/feed',label:'Feed',icon:Images,roles:['OWNER','BARBER','CLIENT']},
 {path:'/clientes',label:'Clientes',icon:Users,roles:['OWNER','BARBER']},
 {path:'/equipe',label:'Equipe',icon:UserRound,roles:['OWNER','BARBER','CLIENT']},
 {path:'/servicos',label:'Serviços',icon:Scissors,roles:['OWNER','BARBER','CLIENT']},
 {path:'/assinaturas',label:'Assinaturas',icon:Wallet,roles:['OWNER','CLIENT']},
 {path:'/financeiro',label:'Financeiro',icon:Wallet,roles:['OWNER']},
 {path:'/comunicacao',label:'Comunicação',icon:Megaphone,roles:['OWNER']},
 {path:'/plano-fio',label:'Plano FIO',icon:Crown,roles:['OWNER']}
];

type Theme='dark'|'light';
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};

export default function App(){
 const location=useLocation(),navigate=useNavigate();
 const isPlatform=location.pathname==='/acesso/plataforma'||location.pathname==='/platform'||location.pathname.startsWith('/platform/');
 const demo=false,demoRole='OWNER' as Role;
 const [session,setSession]=useState<Session|null>(null),[authReady,setAuthReady]=useState(!supabase),[memberships,setMemberships]=useState<Membership[]|null>(null),[onboardingShopId,setOnboardingShopId]=useState(''),[shopId,setShopId]=useState(sessionStorage.getItem('fio-shop')??''),[data,setData]=useState<Bootstrap|null>(null),[error,setError]=useState(''),[toast,setToast]=useState(''),[menu,setMenu]=useState(false);
 const [theme,setTheme]=useState<Theme>(()=>(localStorage.getItem('fio-theme')==='light'?'light':'dark'));
 const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);

 useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('fio-theme',theme);},[theme]);
 useEffect(()=>{const onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPromptEvent);};window.addEventListener('beforeinstallprompt',onInstall);return()=>window.removeEventListener('beforeinstallprompt',onInstall);},[]);
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthReady(true);});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);setAuthReady(true);if(!s){setData(null);setMemberships(null);}});return()=>subscription.unsubscribe();},[]);
 const loadMemberships=useCallback(async()=>{try{const m=await api<Membership[]>('/memberships');setMemberships(m);const owner=m.find(x=>x.role==='OWNER');if(owner){try{const snapshot=await api<{shop:{onboarding_completed:boolean}}>('/onboarding/progress',owner.barbershop_id);setOnboardingShopId(snapshot.shop.onboarding_completed?'':owner.barbershop_id);}catch{setOnboardingShopId('');}}else setOnboardingShopId('');setShopId(prev=>m.some(x=>x.barbershop_id===prev)?prev:m[0]?.barbershop_id??'');setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{if(session&&!demo&&!isPlatform)void loadMemberships();},[session?.user.id,demo,isPlatform,loadMemberships]);
 const refresh=useCallback(async()=>{if(demo||!shopId)return;const next=await api<Bootstrap>('/bootstrap',shopId);setData(next);setError('');},[demo,shopId]);
 useEffect(()=>{if(session&&shopId&&!isPlatform&&!onboardingShopId){setData(null);void refresh().catch(e=>setError(e.message));}},[shopId,session?.user.id,refresh,isPlatform,onboardingShopId]);
 useEffect(()=>{if(!session||!shopId||isPlatform||onboardingShopId)return;void refresh().catch(()=>undefined);},[location.pathname,session?.user.id,shopId,isPlatform,onboardingShopId,refresh]);
 useEffect(()=>{if(!session||!shopId||isPlatform||onboardingShopId)return;const sync=()=>void refresh().catch(()=>undefined);const visible=()=>{if(document.visibilityState==='visible')sync();};window.addEventListener('focus',sync);document.addEventListener('visibilitychange',visible);const timer=window.setInterval(sync,30000);return()=>{window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',visible);window.clearInterval(timer);};},[session?.user.id,shopId,isPlatform,onboardingShopId,refresh]);
 useEffect(()=>{setMenu(false);},[location.pathname]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(timer);},[toast]);
 useEffect(()=>{
  const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if(!manifest||!data||isPlatform)return;
  manifest.href=data.membership.role==='OWNER'?'/manifest-owner.webmanifest':data.membership.role==='BARBER'?'/manifest-staff.webmanifest':`/api/public/manifest/${encodeURIComponent(data.shop.slug)}`;
 },[data?.membership.role,isPlatform]);

 if(location.pathname==='/acesso/plataforma')return <Suspense fallback={<AppLoading/>}><PlatformLogin session={session} ready={authReady}/></Suspense>;
 if(isPlatform)return <Suspense fallback={<AppLoading/>}><PlatformApp session={session} ready={authReady}/></Suspense>;
 if(location.pathname.startsWith('/b/')||location.pathname.startsWith('/barbearia/'))return <PublicPortal/>;
 if(location.pathname==='/acesso/gestao')return <Navigate replace to="/login?audience=owner"/>;
 if(location.pathname==='/acesso/equipe')return <Navigate replace to="/login?audience=staff"/>;
 if(location.pathname==='/confirm-email')return <EmailConfirmationPage/>;
 if(location.pathname==='/login')return <AuthPage/>;
 if(location.pathname==='/reset-password')return <AuthPage reset/>;
 if(location.pathname==='/'&&!authReady)return <AppLoading/>;
 if(!demo&&!authReady)return <AppLoading/>;
 if(!demo&&!session){
  const audience=location.pathname.startsWith('/owner')?'owner':location.pathname.startsWith('/barber')?'staff':location.pathname.startsWith('/client')?'client':new URLSearchParams(location.search).get('audience')??'';
  const params=new URLSearchParams();if(audience)params.set('audience',audience);const shop=new URLSearchParams(location.search).get('shop');if(shop)params.set('shop',shop);
  return <Navigate replace to={`/login${params.toString()?`?${params.toString()}`:''}`}/>;
 }
 if(!demo&&memberships===null)return <AppLoading/>;
 if(!demo&&(memberships?.length===0||Boolean(onboardingShopId)))return <Onboarding shopId={onboardingShopId||undefined} onDone={()=>void loadMemberships()}/>;
 if(error)return <div className="full-error"><h1>Não foi possível abrir seu espaço.</h1><p role="alert">{error}</p><button className="primary" onClick={()=>{setError('');void loadMemberships().then(refresh).catch(e=>setError(e.message));}}>Tentar novamente</button><Link to="/login">Voltar ao acesso</Link></div>;
 if(!data)return <AppLoading/>;
 if(location.pathname==='/')return <Navigate replace to={roleHome(data.membership.role)+location.search}/>;

 const role=data.membership.role,base=roleHome(role),page=location.pathname.slice(base.length),items=navItems.filter(n=>n.roles.includes(role));
 if(!location.pathname.startsWith(base+'/')&&location.pathname!==base)return <Navigate replace to={base}/>;
 if(page!==''&&page!=='/configuracoes'&&!items.some(n=>n.path===page))return <Navigate replace to={base}/>;
 const props:WorkspaceProps={data,demo,base,refresh,notify:setToast,updateDemo:fn=>setData(d=>d?fn(d):d),canInstall:Boolean(installPrompt),installApp:async()=>{if(!installPrompt){setToast('No navegador do celular, use “Adicionar à tela inicial”.');return;}await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null);}};
 let content;
 switch(page){
  case '/agenda':content=<Agenda {...props}/>;break;
  case '/clientes':content=<Customers {...props}/>;break;
  case '/equipe':content=<Team {...props}/>;break;
  case '/servicos':content=<Services {...props}/>;break;
  case '/assinaturas':content=<Subscriptions {...props}/>;break;
  case '/financeiro':content=<Reports {...props}/>;break;
  case '/comunicacao':content=<Communication {...props}/>;break;
  case '/plano-fio':content=<FioPlans {...props}/>;break;
  case '/configuracoes':content=<SettingsPage {...props}/>;break;
  case '/feed':content=<Feed {...props}/>;break;
  case '/assistente':content=<AssistantChat role={role} plan={data.plan} aiEnabled={data.aiEnabled} shopId={data.shop.id} demo={demo} base={base}/>;break;
  default:content=<Dashboard {...props}/>;
 }
 const toggleTheme=()=>setTheme(t=>t==='dark'?'light':'dark');
 return <div className="app-shell">
  {menu&&<button className="menu-backdrop" aria-label="Fechar menu" onClick={()=>setMenu(false)}/>}
  <aside className={`sidebar ${menu?'is-open':''}`}>
   <div className="sidebar-brand sidebar-shop-brand">
    <Link to={base} className="sidebar-shop-link" aria-label={`Abrir ${data.shop.name}`}>
     <span className="sidebar-shop-logo">
      {data.shop.logo_url?<img src={data.shop.logo_url} alt=""/>:<Scissors size={18}/>}
     </span>
     <span className="sidebar-shop-copy">
      <strong>{data.shop.public_title||data.shop.name}</strong>
      <small>{role==='OWNER'?'FIO Gestão':role==='BARBER'?'FIO Equipe':'Área do cliente'}</small>
     </span>
    </Link>
    <button className="icon-button close-menu" aria-label="Fechar navegação" onClick={()=>setMenu(false)}><X size={20}/></button>
   </div>
   <p className="nav-label">NAVEGAÇÃO</p>
   <nav aria-label="Navegação principal">{items.map(n=><NavLink end={n.path===''} className={({isActive})=>`nav-link ${isActive?'active':''}`} to={base+n.path} key={n.path}><n.icon size={19} strokeWidth={1.6}/>{n.label}{n.path==='/assistente'&&<span className="ai-tag">IA</span>}</NavLink>)}</nav>
   <div className="sidebar-bottom">
    {memberships&&memberships.length>1?<label className="field">Trocar barbearia<select value={shopId} onChange={e=>{sessionStorage.setItem('fio-shop',e.target.value);setShopId(e.target.value);}}>{memberships.map(m=><option key={m.barbershop_id} value={m.barbershop_id}>{m.role} · {m.barbershop_id.slice(0,8)}</option>)}</select></label>:null}
    <button className="nav-link theme-toggle" onClick={toggleTheme}>{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>} {theme==='dark'?'Tema claro':'Tema escuro'}</button>
    <div className="profile">
     <NavLink className="profile-account" to={`${base}/configuracoes`} aria-label="Abrir perfil e configurações">
      <span className="avatar small">{data.membership.display_name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>
      <span className="profile-copy"><strong>{data.membership.display_name}</strong><small>{role==='OWNER'?'Responsável':role==='BARBER'?'Barbeiro':'Cliente'} · Configurações</small></span>
     </NavLink>
     <button className="icon-button" aria-label="Sair" title="Sair" onClick={()=>{if(demo)navigate('/login');else void supabase?.auth.signOut();}}><LogOut size={17}/></button>
    </div>
   </div>
  </aside>
  <div className="workspace">
   <header className="topbar"><div className="mobile-brand"><Link to={base} className="sidebar-logo" aria-label="FIO"><img src={theme==='dark'?'/FIOlogo+nome/Branco.png':'/FIOlogo+nome/Preto.png'} alt="FIO"/></Link></div><div className="breadcrumb"><span>{data.shop.name}</span><span>/</span><strong>{page==='/configuracoes'?'Configurações':items.find(n=>n.path===page)?.label??'Visão geral'}</strong></div><div className="header-right">{role==='OWNER'?<NavLink to={`${base}/plano-fio`} className="plan-badge plan-badge-link">FIO {data.plan}</NavLink>:<span className="plan-badge">FIO {data.plan}</span>}<button className="icon-button compact-theme" aria-label={theme==='dark'?'Usar tema claro':'Usar tema escuro'} onClick={toggleTheme}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><button className="icon-button mobile-menu-button" aria-label="Abrir menu" onClick={()=>setMenu(true)}><Menu size={22}/></button></div></header>
   <main key={`${base}:${shopId}:${page}`} className={page==='/assistente'?'chat-main':'main-content'}>{content}</main>
   <nav className="bottom-nav" aria-label="Navegação mobile">{role==='CLIENT'?<><NavLink end to={base}><LayoutDashboard size={21}/><span>Início</span></NavLink><NavLink to={`${base}/agenda`}><CalendarDays size={21}/><span>Agenda</span></NavLink><NavLink to={`${base}/assinaturas`}><Wallet size={21}/><span>Assinatura</span></NavLink><NavLink to={`${base}/feed`}><Images size={21}/><span>Feed</span></NavLink><button onClick={()=>setMenu(true)}><Menu size={21}/><span>Mais</span></button></>:role==='BARBER'?<><NavLink end to={base}><LayoutDashboard size={21}/><span>Início</span></NavLink><NavLink to={`${base}/agenda`}><CalendarDays size={21}/><span>Agenda</span></NavLink><NavLink to={`${base}/clientes`}><Users size={21}/><span>Clientes</span></NavLink><NavLink to={`${base}/feed`}><Images size={21}/><span>Feed</span></NavLink><button onClick={()=>setMenu(true)}><Menu size={21}/><span>Mais</span></button></>:<><NavLink end to={base}><LayoutDashboard size={21}/><span>Início</span></NavLink><NavLink to={`${base}/agenda`}><CalendarDays size={21}/><span>Agenda</span></NavLink><NavLink to={`${base}/clientes`}><Users size={21}/><span>Clientes</span></NavLink><NavLink to={`${base}/equipe`}><UserRound size={21}/><span>Equipe</span></NavLink><button onClick={()=>setMenu(true)}><Menu size={21}/><span>Mais</span></button></>}</nav>
  </div>
  {toast&&<div className="toast" role="status">{toast}<button aria-label="Fechar aviso" onClick={()=>setToast('')}><X size={16}/></button></div>}
 </div>;
}
