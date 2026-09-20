import { useMemo,useState } from 'react';
import { ArrowRight,Check,Copy,Crown,Gift,Info,RefreshCw,ShieldCheck,Sparkles,WalletCards } from 'lucide-react';
import { BILLING_LABELS,FIO_PLAN_CATALOG,billingSuffix,type BillingCycle } from '../../shared/fio-plans';
import { money } from '../../shared/domain';
import { api,RequestError } from '../lib/api';
import type { WorkspaceProps } from './Workspace';
import { Modal,PageTitle } from '../components/ui';

const date=(value?:string|null)=>value?new Date(value).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'';
type PaidPlan='PRO'|'PREMIUM';
const checkoutMessage=(error:unknown)=>{
 if(!(error instanceof RequestError))return 'Não foi possível criar a cobrança agora. Tente novamente em instantes.';
 const messages:Record<string,string>={SYNCPAY_NOT_CONFIGURED:'A cobrança ainda não foi configurada no servidor. Revise as variáveis da SyncPay.',SYNCPAY_AUTH_ERROR:'A SyncPay recusou as credenciais do servidor. Revise o Client ID e o Client Secret.',SYNCPAY_ACCOUNT_PENDING:'A conta SyncPay ainda aguarda aprovação para cobrança recorrente.',SYNCPAY_INVALID_REQUEST:'A SyncPay recusou os dados desta cobrança. Confira CPF/CNPJ e tente novamente.',SYNCPAY_RATE_LIMIT:'Muitas tentativas seguidas. Aguarde alguns minutos antes de gerar outro Pix.',SYNCPAY_ENROLLMENT_UNCERTAIN:'Não foi possível confirmar se a cobrança foi criada. Não gere outro Pix agora; atualize a página em alguns minutos.',SYNCPAY_SUBSCRIPTION_EXISTS:'Já há uma cobrança ou assinatura em andamento para esta barbearia.'};
 return messages[error.code]??error.message;
};
type BillingState={
 provider:'syncpay';providerStatus:'pending_first_payment'|'active'|'overdue'|'suspended'|'cancelled'|string;
 plan:PaidPlan;cycle:BillingCycle;amountCents:number;nextChargeAt:string|null;
 payment:{pixCode:string|null;qrCode:string|null;identifier:string|null;expiresAt:string|null}|null;
};

export function FioPlans(p:WorkspaceProps){
 const [cycle,setCycle]=useState<BillingCycle>('monthly');
 const [busy,setBusy]=useState(false);
 const [choiceOpen,setChoiceOpen]=useState(false);
 const [checkoutPlan,setCheckoutPlan]=useState<PaidPlan|null>(null);
 const [document,setDocument]=useState('');
 const [acceptedTerms,setAcceptedTerms]=useState(false);
 const [billing,setBilling]=useState<BillingState|null>(null);
 const [checkoutError,setCheckoutError]=useState('');
 const sub=p.data.fioSubscription;
 const trialUsed=Boolean(sub.trial_ends_at);
 const trialActive=sub.status==='trialing'&&Boolean(sub.trial_ends_at)&&new Date(sub.trial_ends_at!)>new Date();
 const activeDefinition=useMemo(()=>FIO_PLAN_CATALOG.find(x=>x.code===p.data.plan)??FIO_PLAN_CATALOG[0],[p.data.plan]);
 const paidActive=['active','past_due'].includes(sub.status)&&p.data.plan!=='FREE';

 async function startTrial(){
  setBusy(true);setCheckoutError('');
  try{
   await api('/saas/trial',p.data.shop.id,{confirmed:true});
   await p.refresh();setChoiceOpen(false);
   p.notify('Teste do FIO PRO ativado. Você tem 14 dias para explorar os recursos.');
  }catch{p.notify('Não foi possível iniciar o teste agora. Tente novamente em instantes.');}
  finally{setBusy(false);}
 }
 function selectPaid(code:PaidPlan){
  setChoiceOpen(false);setCheckoutPlan(code);setDocument('');setAcceptedTerms(false);setBilling(null);setCheckoutError('');
 }
 function closeCheckout(){if(busy)return;setCheckoutPlan(null);setBilling(null);setCheckoutError('');}
 async function subscribe(){
  if(!checkoutPlan||!acceptedTerms)return;
  setBusy(true);setCheckoutError('');
  try{
   const result=await api<BillingState>('/saas/subscribe',p.data.shop.id,{plan:checkoutPlan,cycle,document,acceptedTerms:true});
   setBilling(result);
   if(result.providerStatus==='active'||result.providerStatus==='overdue')await p.refresh();
   p.notify(result.providerStatus==='active'?'Assinatura confirmada com sucesso.':'Cobrança criada. Finalize o pagamento para liberar o plano.');
  }catch(error){setCheckoutError(checkoutMessage(error));}
  finally{setBusy(false);}
 }
 async function refreshBilling(){
  setBusy(true);setCheckoutError('');
  try{
   const result=await api<{configured:boolean;subscription:BillingState|null}>('/saas/billing',p.data.shop.id);
   if(result.subscription)setBilling(result.subscription);
   await p.refresh();
   if(result.subscription?.providerStatus==='active')p.notify('Pagamento confirmado. Seu plano FIO já está ativo.');
   else if(result.subscription?.providerStatus==='overdue')p.notify('Pagamento pendente. Regularize a cobrança para manter o acesso.');
   else p.notify('Pagamento ainda não confirmado. Tente atualizar novamente em alguns instantes.');
  }catch(error){setCheckoutError(checkoutMessage(error));}
  finally{setBusy(false);}
 }
 async function copyPix(){
  if(!billing?.payment?.pixCode)return;
  try{await navigator.clipboard?.writeText(billing.payment.pixCode);p.notify('Código Pix copiado.');}
  catch{p.notify('Não foi possível copiar automaticamente. Selecione o código manualmente.');}
 }

 return <>
  <PageTitle eyebrow="ASSINATURA FIO" title="Escolha como sua barbearia cresce" description="Compare os recursos e escolha semanal, mensal ou anual com clareza. Só o responsável pela barbearia pode alterar este plano."/>

  <section className="fio-plan-current">
   <div className="fio-plan-current-icon"><Crown size={21}/></div>
   <div className="fio-plan-current-copy"><span>PLANO ATUAL</span><strong>{activeDefinition.name}</strong><small>{trialActive?`Teste grátis até ${date(sub.trial_ends_at)}`:sub.current_period_end?`Período atual até ${date(sub.current_period_end)}`:'Sem vencimento definido'}</small></div>
   <span className={`fio-billing-status ${trialActive?'is-trial':''}`}>{trialActive?'TESTE ATIVO':sub.status==='past_due'?'PAGAMENTO PENDENTE':p.data.plan==='FREE'?'GRÁTIS':sub.status==='cancelled'||sub.status==='inactive'?'INATIVO':'ATIVO'}</span>
  </section>

  <section className="fio-cycle-section">
   <div className="fio-cycle-heading"><div><span className="eyebrow">PERÍODO DE COBRANÇA</span><h2>Como você prefere pagar?</h2></div><small>Você pode revisar tudo antes de gerar a cobrança.</small></div>
   <div className="fio-cycle-picker" role="tablist" aria-label="Período da assinatura">
    {(Object.keys(BILLING_LABELS) as BillingCycle[]).map(key=><button key={key} type="button" role="tab" aria-selected={cycle===key} className={cycle===key?'active':''} onClick={()=>setCycle(key)}><span className="fio-cycle-check">{cycle===key?<Check size={15}/>:null}</span><span><b>{BILLING_LABELS[key]}</b>{key==='weekly'?<small>mais flexível</small>:key==='monthly'?<small>equilíbrio</small>:<small>melhor valor</small>}</span></button>)}
   </div>
  </section>

  <div className="fio-pricing-grid">
   {FIO_PLAN_CATALOG.map(plan=>{
    const price=plan.prices[cycle],current=p.data.plan===plan.code,unavailable=price===null;
    const annualSaving=plan.code!=='FREE'&&cycle==='annual'&&plan.prices.monthly!=null&&price!=null?plan.prices.monthly*12-price:0;
    const monthlyEquivalent=cycle==='annual'&&price?Math.round(price/12):null;
    return <article key={plan.code} className={`fio-price-card ${plan.recommended?'recommended':''} ${current?'current':''}`}>
     <div className="fio-price-card-accent"/>
     <div className="fio-price-card-top"><div><span className="eyebrow">{plan.eyebrow}</span><h2>{plan.name}</h2><p>{plan.description}</p></div>{plan.recommended&&<span className="fio-recommended"><Sparkles size={14}/>Mais escolhido</span>}</div>
     <div className="fio-price"><span>{unavailable?'—':price===0?'R$ 0':money(price)}</span>{!unavailable&&price!==0&&<small>{billingSuffix(cycle)}</small>}</div>
     {monthlyEquivalent&&<small className="fio-price-equivalent">equivale a {money(monthlyEquivalent)}/mês</small>}
     {annualSaving>0&&<div className="fio-saving">Você economiza {money(annualSaving)} no ano</div>}
     {plan.code==='PRO'&&!trialUsed&&<div className="fio-trial-note"><Gift size={17}/><span><strong>14 dias grátis disponíveis</strong><small>Você decide entre testar primeiro ou assinar agora.</small></span></div>}
     <div className="fio-plan-highlights">{plan.highlights.map(item=><div key={item}><span className="fio-highlight-check"><Check size={14}/></span><span>{item}</span></div>)}</div>
     <div className="fio-card-action">{current?<button className="secondary full" disabled><ShieldCheck size={16}/>Plano atual</button>:unavailable?<button className="secondary full" disabled>Plano gratuito</button>:paidActive?<button className="secondary full" disabled>Troca de plano em breve</button>:plan.code==='PRO'&&!trialUsed&&p.data.plan==='FREE'?<button className="primary full" disabled={busy} onClick={()=>setChoiceOpen(true)}>Escolher FIO PRO<ArrowRight size={17}/></button>:<button className="primary full" disabled={busy} onClick={()=>selectPaid(plan.code as PaidPlan)}>Assinar {plan.code}<ArrowRight size={17}/></button>}</div>
    </article>;
   })}
  </div>

  <section className="fio-plan-explainer"><Info size={18}/><div><strong>Sem liberação antes da confirmação.</strong><p>Ao assinar, o FIO cria uma cobrança e mantém seu plano atual enquanto o primeiro pagamento não for confirmado. Depois da confirmação, os recursos do plano são liberados automaticamente para a barbearia.</p></div></section>

  {choiceOpen&&<Modal title="Começar no FIO PRO" onClose={()=>{if(!busy)setChoiceOpen(false);}}><div className="fio-start-options"><p className="muted">Escolha como você quer começar. Nenhuma cobrança é feita ao ativar o teste grátis.</p><button className="fio-start-option" disabled={busy} onClick={()=>void startTrial()}><span className="fio-start-icon"><Gift size={21}/></span><div><strong>Testar por 14 dias grátis</strong><p>Explore os recursos do PRO sem pagamento agora. Disponível uma única vez por barbearia.</p></div><ArrowRight size={18}/></button><button className="fio-start-option" disabled={busy} onClick={()=>selectPaid('PRO')}><span className="fio-start-icon"><WalletCards size={21}/></span><div><strong>Assinar agora</strong><p>Use o período <b>{BILLING_LABELS[cycle].toLowerCase()}</b> selecionado e gere a cobrança.</p></div><ArrowRight size={18}/></button>{busy&&<p className="muted fio-start-wait">Ativando seu teste…</p>}</div></Modal>}

  {checkoutPlan&&<Modal title={`Assinar FIO ${checkoutPlan}`} onClose={closeCheckout}><div className="fio-checkout-placeholder">
   <Crown size={28}/>
   {!billing?<>
    <h3>Revise e finalize</h3>
    <p className="muted">Assinatura <strong>{BILLING_LABELS[cycle].toLowerCase()}</strong>. O acesso pago só é liberado quando o pagamento for confirmado.</p>
    <div className="fio-checkout-summary"><div><span>Plano</span><strong>FIO {checkoutPlan}</strong></div><div><span>Período</span><strong>{BILLING_LABELS[cycle]}</strong></div><div><span>Valor</span><strong>{money(FIO_PLAN_CATALOG.find(x=>x.code===checkoutPlan)!.prices[cycle]!)}</strong></div></div>
    <label className="field fio-document-field"><span>CPF ou CNPJ do responsável</span><input value={document} inputMode="numeric" autoComplete="off" placeholder="Somente números ou formatado" maxLength={24} onChange={e=>setDocument(e.target.value)}/></label>
    <label className="fio-terms"><input type="checkbox" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)}/><span>Li e aceito a contratação recorrente no período e valor acima. O acesso será ativado somente após a confirmação do pagamento.</span></label>
    {checkoutError&&<div className="fio-checkout-error">{checkoutError}</div>}
    <button className="primary full" disabled={busy||!acceptedTerms||document.replace(/\D/g,'').length<11} onClick={()=>void subscribe()}>{busy?'Preparando cobrança…':'Gerar Pix da assinatura'}<ArrowRight size={17}/></button>
    <button className="secondary full" disabled={busy} onClick={closeCheckout}>Cancelar</button>
   </>:<>
    <div className={`fio-payment-state ${billing.providerStatus==='active'?'is-success':''}`}><span>{billing.providerStatus==='active'?<Check size={20}/>:<WalletCards size={20}/>}</span><div><h3>{billing.providerStatus==='active'?'Pagamento confirmado':'Pix pronto para pagamento'}</h3><p>{billing.providerStatus==='active'?'Seu plano foi confirmado e já pode ser usado pela barbearia.':'Pague o Pix abaixo. A liberação acontece somente depois da confirmação do pagamento.'}</p></div></div>
    <div className="settings-readonly"><span>Assinatura</span><strong>FIO {billing.plan} · {BILLING_LABELS[billing.cycle]}</strong><small>{money(billing.amountCents)}{billing.payment?.expiresAt?` · válido até ${date(billing.payment.expiresAt)}`:''}</small></div>
    {billing.payment?.pixCode&&<div className="fio-pix-box"><span>PIX COPIA E COLA</span><textarea readOnly value={billing.payment.pixCode} rows={4}/><button className="secondary full" onClick={()=>void copyPix()}><Copy size={16}/>Copiar código Pix</button></div>}
    {checkoutError&&<div className="fio-checkout-error">{checkoutError}</div>}
    {billing.providerStatus!=='active'&&<button className="primary full" disabled={busy} onClick={()=>void refreshBilling()}><RefreshCw size={16}/>{busy?'Atualizando…':'Já paguei · atualizar status'}</button>}
    <button className="secondary full" disabled={busy} onClick={closeCheckout}>{billing.providerStatus==='active'?'Concluir':'Fechar e pagar depois'}</button>
   </>}
  </div></Modal>}
 </>;
}
