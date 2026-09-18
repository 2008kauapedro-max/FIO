import { useMemo,useState } from 'react';
import { ArrowRight,Check,Copy,Crown,Info,RefreshCw,Sparkles,ShieldCheck } from 'lucide-react';
import { BILLING_LABELS,FIO_PLAN_CATALOG,billingSuffix,type BillingCycle } from '../../shared/fio-plans';
import { money } from '../../shared/domain';
import { api } from '../lib/api';
import type { WorkspaceProps } from './Workspace';
import { Modal,PageTitle } from '../components/ui';

const date=(value?:string|null)=>value?new Date(value).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'';

type PaidPlan='PRO'|'PREMIUM';
type BillingState={
 provider:'syncpay';providerStatus:'pending_first_payment'|'active'|'overdue'|'suspended'|'cancelled'|string;
 plan:PaidPlan;cycle:BillingCycle;amountCents:number;nextChargeAt:string|null;
 payment:{pixCode:string|null;qrCode:string|null;identifier:string|null;expiresAt:string|null}|null;
};

export function FioPlans(p:WorkspaceProps){
 const [cycle,setCycle]=useState<BillingCycle>('monthly');
 const [busy,setBusy]=useState(false);
 const [checkoutPlan,setCheckoutPlan]=useState<PaidPlan|null>(null);
 const [document,setDocument]=useState('');
 const [acceptedTerms,setAcceptedTerms]=useState(false);
 const [billing,setBilling]=useState<BillingState|null>(null);
 const [checkoutError,setCheckoutError]=useState('');
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

 function selectPaid(code:PaidPlan){
  setCheckoutPlan(code);setDocument('');setAcceptedTerms(false);setBilling(null);setCheckoutError('');
 }
 function closeCheckout(){if(busy)return;setCheckoutPlan(null);setBilling(null);setCheckoutError('');}

 async function subscribe(){
  if(!checkoutPlan||!acceptedTerms)return;
  setBusy(true);setCheckoutError('');
  try{
   const result=await api<BillingState>('/saas/subscribe',p.data.shop.id,{plan:checkoutPlan,cycle,document,acceptedTerms:true});
   setBilling(result);
   if(result.providerStatus==='active'||result.providerStatus==='overdue')await p.refresh();
  }catch(e){setCheckoutError((e as Error).message);}finally{setBusy(false);}
 }

 async function refreshBilling(){
  setBusy(true);setCheckoutError('');
  try{
   const result=await api<{configured:boolean;subscription:BillingState|null}>('/saas/billing',p.data.shop.id);
   if(result.subscription)setBilling(result.subscription);
   await p.refresh();
   if(result.subscription?.providerStatus==='active')p.notify('Pagamento confirmado. Seu plano FIO já está ativo.');
   else if(result.subscription?.providerStatus==='overdue')p.notify('A assinatura está em período de tolerância. Regularize a cobrança para evitar bloqueio.');
   else p.notify('Ainda aguardando a confirmação da SyncPay.');
  }catch(e){setCheckoutError((e as Error).message);}finally{setBusy(false);}
 }

 async function copyPix(){
  if(!billing?.payment?.pixCode)return;
  await navigator.clipboard?.writeText(billing.payment.pixCode);
  p.notify('Código Pix copiado.');
 }

 return <>
  <PageTitle eyebrow="ASSINATURA FIO" title="Escolha como sua barbearia cresce" description="Semanal, mensal ou anual. O plano atualiza automaticamente no FIO assim que o pagamento for confirmado."/>

  <section className="fio-plan-current">
   <div className="fio-plan-current-icon"><Crown size={20}/></div>
   <div><span>Seu plano agora</span><strong>{activeDefinition.name}</strong><small>{trialActive?`Teste grátis até ${date(sub.trial_ends_at)}`:sub.current_period_end?`Período atual até ${date(sub.current_period_end)}`:'Sem vencimento definido'}</small></div>
   <span className={`fio-billing-status ${trialActive?'is-trial':''}`}>{trialActive?'TESTE ATIVO':sub.status==='past_due'?'PAGAMENTO PENDENTE':p.data.plan==='FREE'?'GRÁTIS':sub.status==='cancelled'||sub.status==='inactive'?'INATIVO':'ATIVO'}</span>
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
    const paidActive=['active','past_due'].includes(sub.status)&&p.data.plan!=='FREE';
    return <article key={plan.code} className={`fio-price-card ${plan.recommended?'recommended':''} ${current?'current':''}`}>
     <div className="fio-price-card-top"><div><span className="eyebrow">{plan.eyebrow}</span><h2>{plan.name}</h2><p>{plan.description}</p></div>{plan.recommended&&<span className="fio-recommended"><Sparkles size={14}/>Mais escolhido</span>}</div>
     <div className="fio-price"><span>{unavailable?'—':price===0?'R$ 0':money(price)}</span>{!unavailable&&price!==0&&<small>{billingSuffix(cycle)}</small>}</div>
     {annualSaving>0&&<div className="fio-saving">Economize {money(annualSaving)} no ano</div>}
     {plan.code==='PRO'&&!trialUsed&&<div className="fio-trial-note"><ShieldCheck size={16}/><span><strong>14 dias grátis</strong> uma única vez por barbearia.</span></div>}
     <div className="fio-plan-highlights">{plan.highlights.map(item=><div key={item}><Check size={16}/><span>{item}</span></div>)}</div>
     {current?<button className="secondary full" disabled>Plano atual</button>:unavailable?<button className="secondary full" disabled>Disponível no FREE contínuo</button>:paidActive?<button className="secondary full" disabled>Troca de plano em breve</button>:plan.code==='PRO'&&!trialUsed&&p.data.plan==='FREE'?<button className="primary full" disabled={busy} onClick={()=>void startTrial()}>{busy?'Ativando…':'Testar PRO por 14 dias'}<ArrowRight size={17}/></button>:<button className="primary full" onClick={()=>selectPaid(plan.code as PaidPlan)}>Assinar {plan.code}<ArrowRight size={17}/></button>}
    </article>;
   })}
  </div>

  <section className="fio-plan-explainer">
   <Info size={18}/><div><strong>O acesso pago só é liberado depois da confirmação.</strong><p>O FIO cria a assinatura na SyncPay, mostra o Pix e mantém o plano atual enquanto o primeiro pagamento não for confirmado. A confirmação válida atualiza sua assinatura automaticamente.</p></div>
  </section>

  {checkoutPlan&&<Modal title={`Assinar FIO ${checkoutPlan}`} onClose={closeCheckout}><div className="fio-checkout-placeholder">
   <Crown size={28}/>
   {!billing?<>
    <h3>Finalizar assinatura</h3>
    <p className="muted">Você vai criar uma cobrança recorrente <strong>{BILLING_LABELS[cycle].toLowerCase()}</strong> pela SyncPay. Nenhum plano é liberado antes da confirmação do pagamento.</p>
    <div className="settings-readonly"><span>Valor escolhido</span><strong>{money(FIO_PLAN_CATALOG.find(x=>x.code===checkoutPlan)!.prices[cycle]!)}</strong></div>
    <label className="field fio-document-field"><span>CPF ou CNPJ do responsável</span><input value={document} inputMode="numeric" autoComplete="off" placeholder="Somente números ou formatado" maxLength={24} onChange={e=>setDocument(e.target.value)}/></label>
    <label className="fio-terms"><input type="checkbox" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)}/><span>Li e aceito a contratação recorrente do FIO no ciclo e valor acima. O acesso será ativado somente após a confirmação do pagamento.</span></label>
    {checkoutError&&<div className="fio-checkout-error">{checkoutError}</div>}
    <button className="primary full" disabled={busy||!acceptedTerms||document.trim().length<11} onClick={()=>void subscribe()}>{busy?'Criando cobrança…':'Gerar Pix da assinatura'}<ArrowRight size={17}/></button>
    <button className="secondary full" disabled={busy} onClick={closeCheckout}>Cancelar</button>
   </>:<>
    <h3>{billing.providerStatus==='active'?'Pagamento confirmado':'Pix gerado com segurança'}</h3>
    <p className="muted">{billing.providerStatus==='active'?'Seu plano já foi confirmado pela SyncPay e está sendo refletido no FIO.':'Pague o Pix abaixo. A liberação acontece somente quando a SyncPay confirmar o pagamento.'}</p>
    <div className="settings-readonly"><span>Assinatura</span><strong>FIO {billing.plan} · {BILLING_LABELS[billing.cycle]}</strong><small>{money(billing.amountCents)}{billing.payment?.expiresAt?` · Pix válido até ${date(billing.payment.expiresAt)}`:''}</small></div>
    {billing.payment?.pixCode&&<div className="fio-pix-box"><span>PIX COPIA E COLA</span><textarea readOnly value={billing.payment.pixCode} rows={4}/><button className="secondary full" onClick={()=>void copyPix()}><Copy size={16}/>Copiar código Pix</button></div>}
    {checkoutError&&<div className="fio-checkout-error">{checkoutError}</div>}
    {billing.providerStatus!=='active'&&<button className="primary full" disabled={busy} onClick={()=>void refreshBilling()}><RefreshCw size={16}/>{busy?'Consultando…':'Já paguei · atualizar status'}</button>}
    <button className="secondary full" disabled={busy} onClick={closeCheckout}>{billing.providerStatus==='active'?'Concluir':'Fechar e pagar depois'}</button>
   </>}
  </div></Modal>}
 </>;
}
