import { useMemo,useState } from 'react';
import { ArrowRight,Check,Crown,Info,Sparkles,ShieldCheck } from 'lucide-react';
import { BILLING_LABELS,FIO_PLAN_CATALOG,billingSuffix,type BillingCycle } from '../../shared/fio-plans';
import { money } from '../../shared/domain';
import { api } from '../lib/api';
import type { WorkspaceProps } from './Workspace';
import { Modal,PageTitle } from '../components/ui';

const date=(value?:string|null)=>value?new Date(value).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'';

export function FioPlans(p:WorkspaceProps){
 const [cycle,setCycle]=useState<BillingCycle>('monthly');
 const [busy,setBusy]=useState(false);
 const [checkoutPlan,setCheckoutPlan]=useState<'PRO'|'PREMIUM'|null>(null);
 const sub=p.data.fioSubscription;
 const trialUsed=Boolean(sub.trial_ends_at);
 const trialActive=sub.status==='trialing'&&Boolean(sub.trial_ends_at)&&new Date(sub.trial_ends_at!)>new Date();
 const activeDefinition=useMemo(()=>FIO_PLAN_CATALOG.find(x=>x.code===p.data.plan)??FIO_PLAN_CATALOG[0],[p.data.plan]);

 async function startTrial(){
  setBusy(true);
  try{
   await api('/saas/trial',p.data.shop.id,{confirmed:true});
   await p.refresh();
   p.notify('Seu teste do FIO PRO começou. Você tem 14 dias para explorar os recursos.');
  }catch(e){p.notify((e as Error).message);}finally{setBusy(false);}
 }

 function selectPaid(code:'PRO'|'PREMIUM'){
  setCheckoutPlan(code);
 }

 return <>
  <PageTitle eyebrow="ASSINATURA FIO" title="Escolha como sua barbearia cresce" description="Semanal, mensal ou anual. O plano atualiza automaticamente no FIO assim que o pagamento for confirmado."/>

  <section className="fio-plan-current">
   <div className="fio-plan-current-icon"><Crown size={20}/></div>
   <div><span>Seu plano agora</span><strong>{activeDefinition.name}</strong><small>{trialActive?`Teste grátis até ${date(sub.trial_ends_at)}`:sub.current_period_end?`Período atual até ${date(sub.current_period_end)}`:'Sem vencimento definido'}</small></div>
   <span className={`fio-billing-status ${trialActive?'is-trial':''}`}>{trialActive?'TESTE ATIVO':sub.status==='past_due'?'PAGAMENTO PENDENTE':p.data.plan==='FREE'?'GRÁTIS':'ATIVO'}</span>
  </section>

  <div className="fio-cycle-picker" role="tablist" aria-label="Período da assinatura">
   {(Object.keys(BILLING_LABELS) as BillingCycle[]).map(key=><button key={key} type="button" role="tab" aria-selected={cycle===key} className={cycle===key?'active':''} onClick={()=>setCycle(key)}>{BILLING_LABELS[key]}{key==='annual'&&<small>melhor valor</small>}</button>)}
  </div>

  <div className="fio-pricing-grid">
   {FIO_PLAN_CATALOG.map(plan=>{
    const price=plan.prices[cycle];
    const current=p.data.plan===plan.code;
    const unavailable=price===null;
    const annualSaving=plan.code!=='FREE'&&cycle==='annual'&&plan.prices.monthly!=null&&price!=null?plan.prices.monthly*12-price:0;
    return <article key={plan.code} className={`fio-price-card ${plan.recommended?'recommended':''} ${current?'current':''}`}>
     <div className="fio-price-card-top"><div><span className="eyebrow">{plan.eyebrow}</span><h2>{plan.name}</h2><p>{plan.description}</p></div>{plan.recommended&&<span className="fio-recommended"><Sparkles size={14}/>Mais escolhido</span>}</div>
     <div className="fio-price"><span>{unavailable?'—':price===0?'R$ 0':money(price)}</span>{!unavailable&&price!==0&&<small>{billingSuffix(cycle)}</small>}</div>
     {annualSaving>0&&<div className="fio-saving">Economize {money(annualSaving)} no ano</div>}
     {plan.code==='PRO'&&!trialUsed&&<div className="fio-trial-note"><ShieldCheck size={16}/><span><strong>14 dias grátis</strong> uma única vez por barbearia.</span></div>}
     <div className="fio-plan-highlights">{plan.highlights.map(item=><div key={item}><Check size={16}/><span>{item}</span></div>)}</div>
     {current?<button className="secondary full" disabled>Plano atual</button>:unavailable?<button className="secondary full" disabled>Disponível no FREE contínuo</button>:plan.code==='PRO'&&!trialUsed&&p.data.plan==='FREE'?<button className="primary full" disabled={busy} onClick={()=>void startTrial()}>{busy?'Ativando…':'Testar PRO por 14 dias'}<ArrowRight size={17}/></button>:<button className="primary full" onClick={()=>selectPaid(plan.code as 'PRO'|'PREMIUM')}>Assinar {plan.code}<ArrowRight size={17}/></button>}
    </article>;
   })}
  </div>

  <section className="fio-plan-explainer">
   <Info size={18}/><div><strong>Sem ativação falsa.</strong><p>O teste PRO já pode ser ativado com segurança. As assinaturas pagas ficarão conectadas à SyncPay na próxima etapa; até lá, tocar em assinar não altera seu plano nem registra pagamento.</p></div>
  </section>

  {checkoutPlan&&<Modal title={`Assinar FIO ${checkoutPlan}`} onClose={()=>setCheckoutPlan(null)}><div className="fio-checkout-placeholder"><Crown size={28}/><h3>Checkout preparado para a SyncPay</h3><p className="muted">Na próxima etapa este botão vai criar a cobrança do período <strong>{BILLING_LABELS[cycle].toLowerCase()}</strong>, aguardar a confirmação do pagamento e só então ativar o FIO {checkoutPlan}.</p><div className="settings-readonly"><span>Valor escolhido</span><strong>{money(FIO_PLAN_CATALOG.find(x=>x.code===checkoutPlan)!.prices[cycle]!)}</strong></div><button className="secondary full" onClick={()=>setCheckoutPlan(null)}>Entendi</button></div></Modal>}
 </>;
}
