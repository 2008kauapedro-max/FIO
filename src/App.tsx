import { useCallback,useEffect,useState } from 'react';
import { Link,NavLink,Navigate,useLocation,useNavigate } from 'react-router-dom';
import { LayoutDashboard,CalendarDays,Sparkles,Users,Scissors,UserRound,Wallet,Settings,LogOut,Menu,X,ArrowUpRight,PanelLeftClose,Images,Megaphone,Sun,Moon } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import type { Bootstrap,Membership,Role } from '../shared/domain';
import { roleHome } from '../shared/domain';
import { api,supabase } from './lib/api';
import { demoData } from './lib/demo';
import { AuthPage,Onboarding } from './pages/Auth';
import { Agenda,Customers,Dashboard,Reports,Services,Settings as SettingsPage,Subscriptions,Team,Communication,type WorkspaceProps } from './pages/Workspace';
import { AssistantChat } from './components/AssistantChat';
import { Feed } from './pages/Feed';
import { PublicPortal } from './pages/PublicPortal';
import { Spinner } from './components/ui';

type NavItem={path:string;label:string;icon:typeof LayoutDashboard;roles:Role[]};
const navItems:NavItem[]=[
 {path:'',label:'Visão geral',icon:LayoutDashboard,roles:['OWNER','BARBER','CLIENT']},
 {path:'/agenda',label:'Agenda',icon:CalendarDays,roles:['OWNER','BARBER','CLIENT']},
 {path:'/assistente',label:'Assistente',icon:Sparkles,roles:['OWNER','BARBER','CLIENT']},
 {path:'/feed',label:'Feed',icon:Images,roles:['OWNER','BARBER','CLIENT']},
 {path:'/clientes',label:'Clientes',icon:Users,roles:['OWNER','BARBER']},
 {path:'/equipe',label:'Equipe',icon:UserRound,roles:['OWNER']},
 {path:'/servicos',label:'Serviços',icon:Scissors,roles:['OWNER','BARBER','CLIENT']},
 {path:'/assinaturas',label:'Assinaturas',icon:Wallet,roles:['OWNER','CLIENT']},
 {path:'/financeiro',label:'Financeiro',icon:Wallet,roles:['OWNER']},
 {path:'/comunicacao',label:'Comunicação',icon:Megaphone,roles:['OWNER']}
];

type Theme='dark'|'light';
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};

export default function App(){
 const location=useLocation(),navigate=useNavigate();
 const demo=location.pathname.startsWith('/demo/'),demoRole=(location.pathname.split('/')[2]?.toUpperCase()??'OWNER') as Role;
 const [session,setSession]=useState<Session|null>(null),[authReady,setAuthReady]=useState(!supabase),[memberships,setMemberships]=useState<Membership[]|null>(null),[shopId,setShopId]=useState(sessionStorage.getItem('fio-shop')??''),[data,setData]=useState<Bootstrap|null>(null),[error,setError]=useState(''),[toast,setToast]=useState(''),[menu,setMenu]=useState(false);
 const [theme,setTheme]=useState<Theme>(()=>(localStorage.getItem('fio-theme')==='light'?'light':'dark'));
 const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);

 useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('fio-theme',theme);},[theme]);
 useEffect(()=>{const onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPromptEvent);};window.addEventListener('beforeinstallprompt',onInstall);return()=>window.removeEventListener('beforeinstallprompt',onInstall);},[]);
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthReady(true);});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);setAuthReady(true);if(!s){setData(null);setMemberships(null);}});return()=>subscription.unsubscribe();},[]);
 const loadMemberships=useCallback(async()=>{try{const m=await api<Membership[]>('/memberships');setMemberships(m);setShopId(prev=>m.some(x=>x.barbershop_id===prev)?prev:m[0]?.barbershop_id??'');setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{if(session&&!demo)void loadMemberships();},[session?.user.id,demo,loadMemberships]);
 const refresh=useCallback(async()=>{if(demo||!shopId)return;const next=await api<Bootstrap>('/bootstrap',shopId);setData(next);setError('');},[demo,shopId]);
 useEffect(()=>{if(demo&&['OWNER','BARBER','CLIENT'].includes(demoRole)){setData(demoData(demoRole));setError('');return;}if(session&&shopId){setData(null);void refresh().catch(e=>setError(e.message));}},[demo,demoRole,shopId,session?.user.id,refresh]);
 useEffect(()=>{setMenu(false);},[location.pathname]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(timer);},[toast]);
 useEffect(()=>{
  const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if(!manifest||!data)return;
  manifest.href=data.membership.role==='OWNER'?'/manifest-owner.webmanifest':data.membership.role==='BARBER'?'/manifest-staff.webmanifest':'/manifest-client.webmanifest';
 },[data?.membership.role]);

 if(location.pathname.startsWith('/b/'))return <PublicPortal/>;
 if(location.pathname==='/acesso/gestao')return <Navigate replace to="/login?audience=owner"/>;
 if(location.pathname==='/acesso/equipe')return <Navigate replace to="/login?audience=staff"/>;
 if(location.pathname==='/login')return <AuthPage/>;
 if(location.pathname==='/reset-password')return <AuthPage reset/>;
 if(location.pathname==='/'&&!authReady)return <Spinner/>;
 if(location.pathname==='/')return <Navigate replace to={(!supabase?'/demo/owner':!session?'/login':data?roleHome(data.membership.role):'/owner')+location.search}/>;
 if(!demo&&!authReady)return <Spinner/>;
 if(!demo&&!session)return <Navigate replace to="/login"/>;
 if(demo&&!['OWNER','BARBER','CLIENT'].includes(demoRole))return <Navigate replace to="/demo/owner"/>;
 if(!demo&&memberships?.length===0)return <Onboarding onDone={()=>void loadMemberships()}/>;
 if(error)return <div className="full-error"><h1>Não foi possível abrir seu espaço.</h1><p role="alert">{error}</p><button className="primary" onClick={()=>{setError('');void loadMemberships().then(refresh).catch(e=>setError(e.message));}}>Tentar novamente</button><Link to="/login">Voltar ao acesso</Link></div>;
 if(!data)return <Spinner/>;
 if(demo&&data.membership.role!==demoRole)return <Spinner/>;

 const role=data.membership.role,base=(demo?'/demo':'')+roleHome(role),page=location.pathname.slice(base.length),items=navItems.filter(n=>n.roles.includes(role));
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
  case '/configuracoes':content=<SettingsPage {...props}/>;break;
  case '/feed':content=<Feed {...props}/>;break;
  case '/assistente':content=<AssistantChat role={role} plan={data.plan} aiEnabled={data.aiEnabled} shopId={data.shop.id} demo={demo} base={base}/>;break;
  default:content=<Dashboard {...props}/>;
 }
 const toggleTheme=()=>setTheme(t=>t==='dark'?'light':'dark');
 return <div className="app-shell">
  {menu&&<button className="menu-backdrop" aria-label="Fechar menu" onClick={()=>setMenu(false)}/>}
  <aside className={`sidebar ${menu?'is-open':''}`}>
   <div className="sidebar-brand"><Link to={base} className="wordmark">fio<span>®</span></Link><button className="icon-button close-menu" aria-label="Fechar navegação" onClick={()=>setMenu(false)}><X size={20}/></button><PanelLeftClose className="sidebar-decoration" size={18}/></div>
   <div className="shop-switch"><span className="shop-icon"><Scissors size={19}/></span><div><strong>{data.shop.name}</strong><small>{{OWNER:'Workspace do responsável',BARBER:'Espaço do profissional',CLIENT:'Seu espaço de cuidado'}[role]}</small></div></div>
   <p className="nav-label">WORKSPACE</p>
   <nav aria-label="Navegação principal">{items.map(n=><NavLink end={n.path===''} className={({isActive})=>`nav-link ${isActive?'active':''}`} to={base+n.path} key={n.path}><n.icon size={19} strokeWidth={1.6}/>{n.label}{n.path==='/assistente'&&<span className="ai-tag">IA</span>}</NavLink>)}</nav>
   <div className="sidebar-bottom">
    {demo?<div className="demo-panel"><span className="eyebrow">MODO DEMONSTRAÇÃO</span><label>Explorar como<select aria-label="Perfil da demonstração" value={role} onChange={e=>navigate('/demo'+roleHome(e.target.value as Role))}><option value="OWNER">Responsável</option><option value="BARBER">Barbeiro</option><option value="CLIENT">Cliente</option></select></label><Link to="/login">Conectar minha barbearia <ArrowUpRight size={14}/></Link></div>:memberships&&memberships.length>1?<label className="field">Trocar barbearia<select value={shopId} onChange={e=>{sessionStorage.setItem('fio-shop',e.target.value);setShopId(e.target.value);}}>{memberships.map(m=><option key={m.barbershop_id} value={m.barbershop_id}>{m.role} · {m.barbershop_id.slice(0,8)}</option>)}</select></label>:null}
    <button className="nav-link theme-toggle" onClick={toggleTheme}>{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>} {theme==='dark'?'Tema claro':'Tema escuro'}</button>
    <NavLink className="nav-link" to={`${base}/configuracoes`}><Settings size={19}/>Seu espaço</NavLink>
    <div className="profile"><span className="avatar small">{data.membership.display_name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><strong>{data.membership.display_name}</strong><small>{role==='OWNER'?'Responsável':role==='BARBER'?'Barbeiro':'Cliente'}</small></div><button className="icon-button" aria-label="Sair" onClick={()=>{if(demo)navigate('/login');else void supabase?.auth.signOut();}}><LogOut size={17}/></button></div>
   </div>
  </aside>
  <div className="workspace">
   <header className="topbar"><div className="mobile-brand"><Link to={base} className="wordmark">fio<span>®</span></Link></div><div className="breadcrumb"><span>{data.shop.name}</span><span>/</span><strong>{page==='/configuracoes'?'Seu espaço':items.find(n=>n.path===page)?.label??'Visão geral'}</strong></div><div className="header-right">{demo&&<span className="demo-badge">Demonstração</span>}<span className="plan-badge">FIO {data.plan}</span><button className="icon-button compact-theme" aria-label={theme==='dark'?'Usar tema claro':'Usar tema escuro'} onClick={toggleTheme}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><button className="icon-button mobile-menu-button" aria-label="Abrir menu" onClick={()=>setMenu(true)}><Menu size={22}/></button></div></header>
   <main key={`${base}:${shopId}:${page}`} className={page==='/assistente'?'chat-main':'main-content'}>{content}</main>
   <nav className="bottom-nav" aria-label="Navegação mobile"><NavLink end to={base}><LayoutDashboard size={21}/><span>Início</span></NavLink><NavLink to={`${base}/agenda`}><CalendarDays size={21}/><span>Agenda</span></NavLink><NavLink to={`${base}/assistente`}><Sparkles size={21}/><span>IA</span></NavLink><NavLink to={`${base}/feed`}><Images size={21}/><span>Feed</span></NavLink><button onClick={()=>setMenu(true)}><Menu size={21}/><span>Mais</span></button></nav>
  </div>
  {toast&&<div className="toast" role="status">{toast}<button aria-label="Fechar aviso" onClick={()=>setToast('')}><X size={16}/></button></div>}
 </div>;
}
