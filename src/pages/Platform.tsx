import { useEffect,useState,type FormEvent,type ReactNode } from 'react';
import { Link,NavLink,Navigate,useLocation,useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { LayoutDashboard, Store, Wallet, Activity, Settings, LogOut, ArrowLeft, ShieldCheck, MoreHorizontal, X } from 'lucide-react';
import { api,supabase,RequestError } from '../lib/api';
import { Modal } from '../components/ui';
import type { PlatformAdmin,PlatformShop,SaasPlan,AuditEvent,Page,PlatformOverview,PlatformSection } from '../../shared/platform';
import './platform.css';
import { PlatformCopilot,PlatformAlerts,PlatformPush } from './PlatformCopilot';
import { Bell, Sparkles } from 'lucide-react';

const labels:Record<string,string>={active:'Ativa',inactive:'Inativa',trial:'Teste',trialing:'Teste',suspended:'Suspensa',past_due:'Inadimplente',cancelled:'Cancelada',scheduled:'Agendado',completed:'Concluído',in_service:'Em atendimento',OWNER:'Responsável',BARBER:'Barbeiro',CLIENT:'Cliente',PLATFORM_ADMIN:'Platform Admin',UNKNOWN:'Papel não registrado'};
const label=(s:string)=>labels[s]??s;
const money=(n:number|null)=>n===null?'Não definido':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const date=(s:string|null)=>s?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(s)):'—';
function useResource<T>(path:string){
 const [state,setState]=useState<{data:T|null;error:string;code:string;loading:boolean}>({data:null,error:'',code:'',loading:true});
 const [revision,setRevision]=useState(0);
 useEffect(()=>{let alive=true;setState({data:null,error:'',code:'',loading:true});api<T>(path).then(data=>{if(alive)setState({data,error:'',code:'',loading:false});}).catch((e:Error)=>{if(alive)setState({data:null,error:e.message,code:e instanceof RequestError?e.code:'',loading:false});});return()=>{alive=false;};},[path,revision]);
 return {...state,reload:()=>setRevision(r=>r+1)};
}
function State({loading,error,empty=false,retry}:{loading?:boolean;error?:string;empty?:boolean;retry?:()=>void}){
 if(error)return <div className="pf-state" role="alert"><p>{error}</p>{retry&&<button onClick={retry}>Tentar novamente</button>}</div>;
 if(loading)return <p className="pf-state" role="status">Carregando…</p>;
 if(empty)return <div className="pf-state"><span>Sem registros por aqui.</span><small>Os dados aparecerão conforme a operação acontecer.</small></div>;
 return null;
}
function Pager({page,total,limit=25,onChange}:{page:number;total:number;limit?:number;onChange:(p:number)=>void}){return <div className="pf-pager"><small>{total} registros · página {page}</small><button disabled={page===1} onClick={()=>onChange(page-1)}>Anterior</button><button disabled={page*limit>=total} onClick={()=>onChange(page+1)}>Próxima</button></div>;}

export function PlatformLogin({session,ready}:{session:Session|null;ready:boolean}){
 const navigate=useNavigate(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const m=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');if(m)m.href='/manifest-platform.webmanifest';},[]);
 if(!ready)return <div className="pf-login"><State loading/></div>;
 if(session)return <Navigate replace to="/platform"/>;
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);try{if(!supabase)throw Error('Configure o Supabase para entrar.');const r=await supabase.auth.signInWithPassword({email:String(f.get('email')).trim(),password:String(f.get('password'))});if(r.error)throw Error('Não foi possível entrar. Confira suas credenciais.');navigate('/platform',{replace:true});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className="pf-login"><form onSubmit={submit}><Link className="pf-logo" to="/">fio<span>®</span></Link><small>PLATFORM</small><h1>Administração do FIO</h1><p>Acesse com sua conta autorizada.</p><label>E-mail<input name="email" type="email" autoComplete="username" required/></label><label>Senha<input name="password" type="password" autoComplete="current-password" required/></label>{error&&<p role="alert">{error}</p>}<button className="pf-primary" disabled={busy}>{busy?'Entrando…':'Entrar'}</button><Link to="/login">Outros acessos</Link></form></main>;
}
export function PlatformApp({session,ready}:{session:Session|null;ready:boolean}){
 useEffect(()=>{const m=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');if(m)m.href='/manifest-platform.webmanifest';},[]);
 if(!ready)return <div className="pf-login"><State loading/></div>;
 if(!session)return <Navigate replace to="/acesso/plataforma"/>;
 return <PlatformGate key={session.user.id}/>;
}
function PlatformGate(){
 const r=useResource<PlatformAdmin>('/platform/me');
 if(r.code==='AUTH_REQUIRED')return <main className="pf-login"><div><h1>Sessão expirada</h1><p>Entre novamente para continuar.</p><button onClick={()=>void supabase?.auth.signOut()}>Entrar novamente</button></div></main>;
 if(r.error)return <main className="pf-login"><div><ShieldCheck size={28}/><h1>{r.code==='FORBIDDEN'?'Acesso negado':'Não foi possível abrir o painel'}</h1><p role="alert">{r.error}</p>{r.code!=='FORBIDDEN'&&<button onClick={r.reload}>Tentar novamente</button>}<Link to="/">Voltar ao meu espaço</Link><button onClick={()=>void supabase?.auth.signOut()}>Sair desta conta</button></div></main>;
 if(!r.data)return <div className="pf-login"><State loading/></div>;
 return <PlatformWorkspace admin={r.data}/>;
}
const nav=[['','Visão geral',LayoutDashboard],['/barbearias','Barbearias',Store],['/assinaturas','Assinaturas',Wallet],['/atividade','Atividade',Activity],['/ai','Copiloto',Sparkles],['/alertas','Alertas',Bell],['/configuracoes','Configurações',Settings]] as const;
function PlatformWorkspace({ admin }: { admin: PlatformAdmin }) {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  let content: ReactNode;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (pathname === '/platform') {
    content = <Overview admin={admin} />;
  } else if (pathname === '/platform/barbearias') {
    content = <Shops />;
  } else if (/^\/platform\/barbearias\/[^/]+$/.test(pathname)) {
    content = <ShopDetail key={pathname} id={pathname.split('/').at(-1)!} />;
  } else if (pathname === '/platform/assinaturas') {
    content = <Subscriptions />;
  } else if (pathname === '/platform/atividade') {
    content = (
      <>
        <Heading title="Atividade" note="Quem fez o quê, em cada barbearia." />
        <ActivityList />
      </>
    );
  } else if (pathname === '/platform/configuracoes') {
    content = (
      <>
        <Configuration admin={admin} />
        <PlatformPush />
      </>
    );
  } else if (pathname === '/platform/ai') {
    content = <PlatformCopilot />;
  } else if (pathname === '/platform/alertas') {
    content = <PlatformAlerts />;
  } else {
    return <Navigate replace to="/platform" />;
  }

  const mobilePrimary = [
    ['', 'Visão geral', LayoutDashboard],
    ['/barbearias', 'Barbearias', Store],
    ['/ai', 'Copiloto', Sparkles],
  ] as const;

  const mobileMore = [
    ['/assinaturas', 'Assinaturas', Wallet],
    ['/atividade', 'Atividade', Activity],
    ['/alertas', 'Alertas', Bell],
    ['/configuracoes', 'Configurações', Settings],
  ] as const;

  return (
    <div className="pf-shell">
      <aside className="pf-sidebar">
        <Link className="pf-logo" to="/platform">
          fio<span>®</span>
        </Link>

        <small className="pf-kicker">PLATFORM</small>

        <nav className="pf-desktop-nav" aria-label="Administração da plataforma">
          {nav.map(([path, title, Icon]) => (
            <NavLink end={!path} key={path} to={'/platform' + path}>
              <Icon size={18} />
              <span>{title}</span>
            </NavLink>
          ))}
        </nav>

        <footer>
          <strong>{admin.display_name}</strong>
          <small>Platform Admin</small>
          <button onClick={() => void supabase?.auth.signOut()}>
            <LogOut size={16} />
            Sair
          </button>
        </footer>
      </aside>

      <nav className="pf-mobile-nav" aria-label="Navegação da plataforma">
        {mobilePrimary.map(([path, title, Icon]) => (
          <NavLink end={!path} key={path} to={'/platform' + path}>
            <Icon size={20} />
            <span>{title}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={mobileMenuOpen ? 'active' : ''}
          aria-expanded={mobileMenuOpen}
          aria-controls="pf-mobile-more"
          onClick={() => setMobileMenuOpen(open => !open)}
        >
          <MoreHorizontal size={20} />
          <span>Mais</span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="pf-mobile-overlay" onClick={() => setMobileMenuOpen(false)}>
          <section
            id="pf-mobile-more"
            className="pf-mobile-more"
            role="dialog"
            aria-modal="true"
            aria-label="Mais opções"
            onClick={event => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>{admin.display_name}</strong>
                <small>Platform Admin</small>
              </div>
              <button
                type="button"
                className="pf-mobile-close"
                aria-label="Fechar menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={20} />
              </button>
            </header>

            <nav>
              {mobileMore.map(([path, title, Icon]) => (
                <NavLink key={path} to={'/platform' + path}>
                  <Icon size={20} />
                  <span>{title}</span>
                </NavLink>
              ))}
            </nav>

            <button className="pf-mobile-logout" onClick={() => void supabase?.auth.signOut()}>
              <LogOut size={19} />
              Sair da conta
            </button>
          </section>
        </div>
      )}

      <main className={pathname === '/platform/ai' ? 'pf-ai-main' : undefined}>
        {content}
      </main>
    </div>
  );
}

function Heading({title,note,children}:{title:string;note?:string;children?:ReactNode}){return <header className="pf-heading"><div><h1>{title}</h1>{note&&<p>{note}</p>}</div>{children}</header>;}
function Overview({admin}:{admin:PlatformAdmin}){
 const r=useResource<PlatformOverview>('/platform/overview');
 return <><Heading title={`Olá, ${admin.display_name.split(' ')[0]}`} note="Seu FIO, em um olhar."/><State loading={r.loading} error={r.error} retry={r.reload}/>{r.data&&<><div className="pf-metrics">{[['Receita SaaS','Indisponível','Cobrança ainda não integrada'],['Barbearias',r.data.activeShops,'Ativas'],['Assinaturas',r.data.activeSubscriptions,'Ativas, incluindo gratuitas'],['Pendências',r.data.alerts,'Suspensas ou inadimplentes']].map(([name,value,help])=><div key={name}><small>{name}</small><strong>{value}</strong><span>{help}</span></div>)}</div><section className="pf-panel"><div className="pf-panel-title"><h2>Atividade recente</h2><Link to="/platform/atividade">Ver tudo</Link></div><Events events={r.data.recent}/></section></>}</>;
}
function Events({events}:{events:AuditEvent[]}){return <><State empty={!events.length}/><div className="pf-events">{events.map(e=><article key={e.id}><time>{date(e.created_at)}</time><div><strong>{e.description}</strong><span>{e.barbershops?.name??'Plataforma'} · {e.actor_name??e.actor_user_id}</span><small>{label(e.actor_role)} · {e.event_type}</small></div></article>)}</div></>;}
function Shops(){
 const [search,setSearch]=useState(''),[term,setTerm]=useState(''),[status,setStatus]=useState('all'),[page,setPage]=useState(1);
 const r=useResource<Page<PlatformShop>>(`/platform/shops?${new URLSearchParams({search:term,status,page:String(page)})}`);
 return <><Heading title="Barbearias" note="Acompanhe os espaços que usam o FIO."/><form className="pf-filters" onSubmit={e=>{e.preventDefault();setTerm(search);setPage(1);}}><label>Pesquisar<input placeholder="Nome da barbearia" value={search} onChange={e=>setSearch(e.target.value)} maxLength={100}/></label><label>Status<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>{['all','active','trial','suspended','past_due'].map(s=><option key={s} value={s}>{s==='all'?'Todas':label(s)}</option>)}</select></label><button>Buscar</button></form><State loading={r.loading} error={r.error} retry={r.reload}/>{r.data&&<><State empty={!r.data.items.length}/><div className="pf-shops">{r.data.items.map(s=><Link to={`/platform/barbearias/${s.id}`} key={s.id}><div className="pf-shop-logo">{s.logo_url?<img src={s.logo_url} alt=""/>:<Store size={18}/>}</div><div><strong>{s.name}</strong><small>{s.owner_name??'Responsável não registrado'}</small></div><span>{s.plan}<small>{label(s.status)}</small></span><time><small>Última atividade</small>{date(s.last_activity)}</time></Link>)}</div><Pager page={page} total={r.data.total} onChange={setPage}/></>}</>;
}
const tabs=[['summary','Resumo'],['team','Equipe'],['clients','Clientes'],['agenda','Agenda'],['finance','Financeiro'],['subscriptions','Assinaturas'],['reviews','Avaliações'],['activity','Atividade']] as const;
function ShopDetail({id}:{id:string}){
 const r=useResource<PlatformShop>(`/platform/shops/${id}`),[tab,setTab]=useState<string>('summary'),[edit,setEdit]=useState(false);
 return <><Link className="pf-back" to="/platform/barbearias"><ArrowLeft size={16}/>Barbearias</Link><State loading={r.loading} error={r.error} retry={r.reload}/>{r.data&&<><Heading title={r.data.name} note={`${r.data.plan} · ${label(r.data.status)}`}><button onClick={()=>setEdit(true)}>Editar administração</button></Heading><nav className="pf-tabs" aria-label="Detalhes da barbearia">{tabs.map(([key,name])=><button key={key} aria-pressed={key===tab} onClick={()=>setTab(key)}>{name}</button>)}</nav>{tab==='summary'?<section className="pf-panel"><h2>Resumo</h2><dl className="pf-summary"><dt>Responsável</dt><dd>{r.data.owner_name??'Não registrado'}</dd><dt>Identificador público</dt><dd>{r.data.slug}</dd><dt>Plano SaaS</dt><dd>{r.data.plan}</dd><dt>Assinatura FIO</dt><dd>{label(r.data.billing_status)}</dd><dt>Fim do período</dt><dd>{date(r.data.current_period_end)}</dd><dt>Última atividade</dt><dd>{date(r.data.last_activity)}</dd></dl></section>:tab==='activity'?<ActivityList shop={id}/>:<ShopSection key={tab} id={id} section={tab as PlatformSection}/>} {edit&&<ShopEditor shop={r.data} close={()=>setEdit(false)} done={()=>{setEdit(false);r.reload();}}/>}</>}</>;
}
const columns:Record<PlatformSection,[string,string][]>= {
 team:[['display_name','Nome'],['role','Papel'],['active','Ativo']],clients:[['name','Nome'],['phone','Contato'],['created_at','Cadastro']],agenda:[['starts_at','Início'],['ends_at','Fim'],['status','Status'],['price_cents','Valor']],finance:[['created_at','Recebido em'],['amount_cents','Valor']],subscriptions:[['name','Plano de cortes'],['remaining_cuts','Cortes restantes'],['status','Status'],['expires_at','Validade']],reviews:[['rating','Nota'],['comment','Comentário'],['created_at','Data']],
};
function cell(value:unknown,key:string):ReactNode{if(value===null||value===undefined)return '—';if(typeof value==='boolean')return value?'Sim':'Não';if(key.endsWith('_cents'))return money(Number(value));if(key.endsWith('_at')||key==='current_period_end')return date(String(value));return label(String(value));}
function DataTable({items,cols}:{items:Record<string,unknown>[];cols:[string,string][]}){return <><State empty={!items.length}/>{items.length>0&&<div className="pf-table-wrap"><table><thead><tr>{cols.map(([k,n])=><th key={k}>{n}</th>)}</tr></thead><tbody>{items.map((row,i)=><tr key={String(row.id??row.user_id??i)}>{cols.map(([k])=><td key={k}>{cell(row[k],k)}</td>)}</tr>)}</tbody></table></div>}</>;}
function ShopSection({id,section}:{id:string;section:PlatformSection}){
 const [page,setPage]=useState(1),r=useResource<Page<Record<string,unknown>>>(`/platform/shops/${id}/${section}?page=${page}`);
 return <section className="pf-panel">{section==='finance'&&<p>Recebimentos da barbearia. Não compõem a receita SaaS do FIO.</p>}{section==='subscriptions'&&<p>Planos de cortes vendidos aos clientes desta barbearia.</p>}<State loading={r.loading} error={r.error} retry={r.reload}/>{r.data&&<><DataTable items={r.data.items} cols={columns[section]}/><Pager page={page} total={r.data.total} onChange={setPage}/></>}</section>;
}
function ShopEditor({shop,close,done}:{shop:PlatformShop;close:()=>void;done:()=>void}){
 const plans=useResource<SaasPlan[]>('/platform/plans'),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [name,setName]=useState(shop.name),[status,setStatus]=useState(shop.platform_status),[planId,setPlanId]=useState(shop.plan_id),[billingStatus,setBilling]=useState(shop.billing_status),[period,setPeriod]=useState(shop.current_period_end?.slice(0,10)??'');
 async function save(){setBusy(true);setError('');try{await api(`/platform/shops/${shop.id}`,undefined,{name,status,planId,billingStatus,periodEnd:period===(shop.current_period_end?.slice(0,10)??'')?shop.current_period_end:period?new Date(`${period}T23:59:59Z`).toISOString():null,confirmed:true},'PATCH');done();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Modal title={confirm?'Confirmar alteração':'Administração da barbearia'} onClose={()=>{if(!busy)close();}}><div className="pf-form">{confirm?<><p>Salvar alterações em <strong>{name}</strong>?</p><p>{label(status)} · {plans.data?.find(p=>p.id===planId)?.name} · {label(billingStatus)}</p>{status==='suspended'&&<p>O acesso operacional da equipe e dos clientes será suspenso.</p>}<small>A alteração será registrada em seu nome.</small><button disabled={busy} onClick={()=>setConfirm(false)}>Revisar</button><button disabled={busy} onClick={()=>void save()}>{busy?'Salvando…':'Confirmar e salvar'}</button></>:<form onSubmit={e=>{e.preventDefault();setConfirm(true);}}><label>Nome<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>Status da barbearia<select value={status} onChange={e=>setStatus(e.target.value)}>{['active','trial','suspended'].map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label><label>Plano FIO<select required value={planId} onChange={e=>setPlanId(e.target.value)}>{plans.data?.filter(p=>p.active||p.id===shop.plan_id).map(p=><option key={p.id} value={p.id}>{p.name}{!p.active?' (inativo)':''}</option>)}</select></label><State error={plans.error} loading={plans.loading} retry={plans.reload}/><label>Status da assinatura<select value={billingStatus} onChange={e=>setBilling(e.target.value)}>{['active','inactive','trialing','past_due','cancelled'].map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label><label>Fim do período (UTC, opcional)<input type="date" value={period} onChange={e=>setPeriod(e.target.value)}/></label><button disabled={!plans.data}>Revisar alteração</button></form>}{error&&<p role="alert">{error}</p>}</div></Modal>;
}
function Subscriptions(){
 const [status,setStatus]=useState('all'),[page,setPage]=useState(1),r=useResource<Page<Record<string,unknown>>>(`/platform/subscriptions?page=${page}&status=${status}`);
 return <><Heading title="Assinaturas" note="Assinaturas das barbearias no FIO."/><label className="pf-filter">Status<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>{['all','active','inactive','trialing','past_due','cancelled'].map(s=><option key={s} value={s}>{s==='all'?'Todas':label(s)}</option>)}</select></label><State loading={r.loading} error={r.error} retry={r.reload}/>{r.data&&<><DataTable items={r.data.items.map(s=>({...s,shop:(s.barbershops as {name:string}|null)?.name}))} cols={ [['shop','Barbearia'],['plan','Plano SaaS'],['status','Status'],['current_period_end','Fim do período']]}/><Pager page={page} total={r.data.total} onChange={setPage}/></>}<p className="pf-note">Os status são administrativos. Não há cobrança automática integrada.</p></>;
}
function ActivityList({shop}:{shop?:string}){
 const [query,setQuery]=useState(''),[reset,setReset]=useState(0),[page,setPage]=useState(1),r=useResource<Page<AuditEvent>>(`/platform/activity?page=${page}${shop?'&shop='+shop:''}${query?'&'+query:''}`);
 function filter(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget),p=new URLSearchParams();for(const [k,v] of f)if(String(v).trim()){const val=String(v).trim();p.set(k,k==='from'?new Date(val+'T00:00:00').toISOString():k==='to'?new Date(val+'T23:59:59.999').toISOString():val);}setQuery(p.toString());setPage(1);}
 return <><form key={reset} className="pf-filters pf-activity-filters" onSubmit={filter}><label>De<input type="date" name="from"/></label><label>Até<input type="date" name="to"/></label>{!shop&&<ActivityLookup kind="shop"/>}<ActivityLookup kind="user"/><label>Papel<select name="role"><option value="">Todos</option>{['PLATFORM_ADMIN','OWNER','BARBER','CLIENT','UNKNOWN'].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label><label>Tipo<select name="type"><option value="">Todos</option>{[["appointment.completed","Atendimento concluído"],["appointment.cancelled","Agendamento cancelado"],["appointment.created","Agendamento criado"],["memberships.insert","Vínculo criado"],["platform.shop.updated","Administração / plano"],["platform.plan.updated","Catálogo SaaS"],["payment.recorded","Pagamento registrado"],["reviews.insert","Avaliação criada"]].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><button>Filtrar</button><button type="reset" onClick={()=>{setQuery('');setPage(1);setReset(r=>r+1);}}>Limpar</button></form><State loading={r.loading} error={r.error} retry={r.reload}/>{r.data&&<section className="pf-panel"><Events events={r.data.items}/><Pager page={page} total={r.data.total} onChange={setPage}/></section>}</>;
}
function ActivityLookup({kind}:{kind:'shop'|'user'}){
 const [search,setSearch]=useState(''),[term,setTerm]=useState('');
 useEffect(()=>{const t=setTimeout(()=>setTerm(search),300);return()=>clearTimeout(t);},[search]);
 const r=useResource<Page<PlatformShop>|{id:string;name:string}[]>(kind==='shop'?'/platform/shops?limit=25&search='+encodeURIComponent(term):'/platform/actors?search='+encodeURIComponent(term));
 const items=r.data?(Array.isArray(r.data)?r.data:r.data.items):[];
 return <div className="pf-lookup"><label>{kind==='shop'?'Barbearia':'Usuário'}<input aria-label={kind==='shop'?'Buscar barbearia':'Buscar usuário'} placeholder="Buscar por nome" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)}/></label><select name={kind} aria-label={kind==='shop'?'Selecionar barbearia':'Selecionar usuário'}><option value="">{r.loading?'Buscando…':'Todos'}</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>{r.error&&<small role="alert">{r.error}</small>}</div>;
}
function Configuration({admin}:{admin:PlatformAdmin}){
 const r=useResource<SaasPlan[]>('/platform/plans'),[edit,setEdit]=useState<SaasPlan|null>(null);
 return <><Heading title="Configurações" note="Catálogo de planos e acesso administrativo."/><section className="pf-panel"><h2>Seu acesso</h2><p>{admin.display_name} · Platform Admin</p><small>Administradores são cadastrados por um operador autorizado no Supabase.</small><p><button onClick={()=>void supabase?.auth.signOut()}>Sair desta conta</button></p></section><section className="pf-panel"><h2>Planos do FIO</h2><State loading={r.loading} error={r.error} retry={r.reload}/>{r.data?.map(p=><div className="pf-plan" key={p.id}><div><strong>{p.name}</strong><small>{money(p.price_cents)} · {p.active?'Disponível':'Inativo'}</small><small>IA: {p.features.ai_enabled?'habilitada':'desabilitada'} · {String(p.limits.ai_daily_limit??0)} solicitações/dia</small></div><button onClick={()=>setEdit(p)}>Editar</button></div>)}<p className="pf-note">Preço de catálogo. Limites de IA refletem a configuração existente; nenhuma cobrança é disparada.</p></section>{edit&&<PlanEditor plan={edit} close={()=>setEdit(null)} done={()=>{setEdit(null);r.reload();}}/>}</>;
}
function PlanEditor({plan,close,done}:{plan:SaasPlan;close:()=>void;done:()=>void}){
 const [name,setName]=useState(plan.name),[price,setPrice]=useState(plan.price_cents===null?'':String(plan.price_cents/100)),[active,setActive]=useState(plan.active),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);try{await api(`/platform/plans/${plan.id}`,undefined,{name,priceCents:price===''?null:Math.round(Number(price)*100),active,confirmed:true},'PATCH');done();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Modal title={confirm?'Confirmar plano':'Editar plano SaaS'} onClose={()=>{if(!busy)close();}}><div className="pf-form">{confirm?<><p>{name} · {money(price===''?null:Math.round(Number(price)*100))} · {active?'Disponível':'Inativo'}</p><p>Alterar o catálogo não cobra nem cancela assinaturas existentes.</p><button disabled={busy} onClick={()=>setConfirm(false)}>Revisar</button><button disabled={busy} onClick={()=>void save()}>{busy?'Salvando…':'Confirmar e salvar'}</button></>:<form onSubmit={e=>{e.preventDefault();setConfirm(true);}}><label>Nome<input minLength={2} maxLength={100} required value={name} onChange={e=>setName(e.target.value)}/></label><label>Preço em R$ (vazio = não definido)<input type="number" min="0" max="100000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Disponibilidade<select value={String(active)} onChange={e=>setActive(e.target.value==='true')}><option value="true">Disponível</option><option value="false">Inativo</option></select></label><button>Revisar alteração</button></form>}{error&&<p role="alert">{error}</p>}</div></Modal>;
}
