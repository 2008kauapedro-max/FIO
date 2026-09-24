import { useEffect,useMemo,useState } from 'react';
import { ArrowRight,Check,Copy,Crown,Gift,Info,RefreshCw,ShieldCheck,Sparkles,WalletCards } from 'lucide-react';
import { BILLING_LABELS,FIO_PLAN_CATALOG,billingSuffix,type BillingCycle } from '../../shared/fio-plans';
import { money } from '../../shared/domain';
import { api,RequestError } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { billingErrorMessage,billingLocksNewSubscription,billingStatusLabel,usablePix,type BillingState,type PaidPlan } from '../../shared/billing-state';
import type { WorkspaceProps } from './Workspace';
import { Modal,PageTitle } from '../components/ui';

const date=(value?:string|null)=>value?new Date(value).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'';
const checkoutMessage=(error:unknown)=>{
 return billingErrorMessage(error instanceof RequestError?error.code:undefined);
};

export function FioPlans(p:WorkspaceProps){
 const [changePlan,setChangePlan]=useState<PaidPlan|null>(null),[changeAccepted,setChangeAccepted]=useState(false);
 const [cycle,setCycle]=useState<BillingCycle>('monthly');
 const [busy,setBusy]=useState(false);
 const [choiceOpen,setChoiceOpen]=useState(false);
 const [checkoutPlan,setCheckoutPlan]=useState<PaidPlan|null>(null);
 const [document,setDocument]=useState('');
 const [acceptedTerms,setAcceptedTerms]=useState(false);
 const [billing,setBilling]=useState<BillingState|null>(null);
 const [billingLoaded,setBillingLoaded]=useState(false);
 const [billingConfigured,setBillingConfigured]=useState(false);
 const [checkoutError,setCheckoutError]=useState('');
 const sub=p.data.fioSubscription;
 const trialUsed=Boolean(sub.trial_ends_at);
 const trialActive=sub.status==='trialing'&&Boolean(sub.trial_ends_at)&&new Date(sub.trial_ends_at!)>new Date();
 const activeDefinition=useMemo(()=>FIO_PLAN_CATALOG.find(x=>x.code===p.data.plan)??FIO_PLAN_CATALOG[0],[p.data.plan]);
 const paidActive=['active','past_due'].includes(sub.status)&&p.data.plan!=='FREE';
 const billingLocked=billingLocksNewSubscription(billing);
 useEffect(()=>{
  let active=true;
  void api<{configured:boolean;subscription:BillingState|null}>('/saas/billing',p.data.shop.id).then(result=>{
   if(!active)return;
   setBilling(result.subscription);setBillingConfigured(result.configured);setBillingLoaded(true);
  }).catch(error=>{if(active)setCheckoutError(checkoutMessage(error));});
  return()=>{active=false;};
 },[p.data.shop.id]);

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
  if(!billingLoaded||!billingConfigured||billingLocked){setCheckoutError('Consulte a cobrança atual antes de iniciar outra assinatura.');return;}
  setChoiceOpen(false);setCheckoutPlan(code);setDocument('');setAcceptedTerms(false);setBilling(null);setCheckoutError('');
 }
 function closeCheckout(){if(busy)return;setCheckoutPlan(null);setCheckoutError('');}
 async function subscribe(){
  if(!checkoutPlan||!acceptedTerms||busy||billingLocked)return;
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
   setBilling(result.subscription);setBillingConfigured(result.configured);setBillingLoaded(true);
   await p.refresh();
   if(result.subscription?.change)p.notify('Troca em andamento. O acesso atual é mantido até a confirmação necessária.');
   else if(result.subscription?.providerStatus==='active')p.notify('Pagamento confirmado. Seu plano FIO já está ativo.');
   else if(result.subscription?.providerStatus==='overdue')p.notify('Pagamento pendente. Regularize a cobrança para manter o acesso.');
   else if(result.subscription)p.notify(billingStatusLabel(result.subscription.providerStatus));
   else p.notify(result.configured?'Nenhuma cobrança em andamento.':'Assinaturas temporariamente indisponíveis. Fale com o suporte.');
  }catch(error){setCheckoutError(checkoutMessage(error));}
  finally{setBusy(false);}
 }
 async function manageCharge(action:'cancel_pending'|'resend'){
  const question=action==='cancel_pending'?'Cancelar esta contratação antes do primeiro pagamento? O teste grátis continua até sua data original. Não pague o Pix antigo.':'Solicitar um novo Pix para a cobrança atual? Confira o novo código antes de pagar.';
  if(!window.confirm(question))return;setBusy(true);setCheckoutError('');
  try{const result=await api<{subscription:BillingState|null}>('/saas/charge',p.data.shop.id,{action,confirmed:true});setBilling(action==='cancel_pending'?null:result.subscription);await p.refresh();if(action==='cancel_pending'){setCheckoutPlan(null);p.notify('Contratação pendente cancelada. Você já pode escolher outro plano.');}else p.notify('Novo Pix consultado. Use somente o código válido exibido.');}catch(e){setCheckoutError(checkoutMessage(e));}finally{setBusy(false);}
 }
 async function confirmChange(){
  if(!changePlan||!changeAccepted||busy)return;setBusy(true);setCheckoutError('');
  try{const result=await api<{subscription:BillingState}>('/saas/change-plan',p.data.shop.id,{plan:changePlan,cycle,confirmed:true});setBilling(result.subscription);setChangePlan(null);setCheckoutPlan(result.subscription.plan);await p.refresh();p.notify('Solicitação registrada. Confira a cobrança e o plano ativo.');}catch(e){setCheckoutError(checkoutMessage(e));}finally{setBusy(false);}
 }
 async function copyPix(){
  if(!usablePix(billing)||!billing?.payment?.pixCode){p.notify('Este código Pix não está mais disponível. Atualize a cobrança.');return;}
  try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(billing.payment.pixCode);p.notify('Código Pix copiado.');}
  catch{p.notify('Não foi possível copiar automaticamente. Selecione o código manualmente.');}
 }

 return <>
  <PageTitle eyebrow="ASSINATURA FIO" title="Escolha como sua barbearia cresce" description="Compare os recursos e escolha semanal, mensal ou anual com clareza. Só o responsável pela barbearia pode alterar este plano."/>

  <section className="fio-plan-current">
   <div className="fio-plan-current-icon"><Crown size={21}/></div>
   <div className="fio-plan-current-copy"><span>PLANO ATUAL</span><strong>{activeDefinition.name}</strong><small>{trialActive?`Teste grátis até ${date(sub.trial_ends_at)}`:sub.current_period_end?`Período atual até ${date(sub.current_period_end)}`:'Sem vencimento definido'}</small></div>
   <span className={`fio-billing-status ${trialActive?'is-trial':''}`}>{trialActive?'TESTE ATIVO':sub.status==='past_due'?'PAGAMENTO PENDENTE':p.data.plan==='FREE'?'GRÁTIS':sub.status==='cancelled'||sub.status==='inactive'?'INATIVO':'ATIVO'}</span>
  </section>

  {billing?.providerStatus!=='cancelled'&&<section className="fio-billing-resume" aria-label="Cobrança atual">
   <div><strong>{billing?billingStatusLabel(billing.providerStatus):billingLoaded?(billingConfigured?'Nenhuma contratação iniciada':'Assinaturas temporariamente indisponíveis'):checkoutError?'Não foi possível consultar a cobrança':'Consultando sua assinatura…'}</strong>
   <p className="muted">{billing?.providerStatus==='pending_first_payment'?`Você iniciou a contratação do FIO ${billing.plan} · ${BILLING_LABELS[billing.cycle]} (${money(billing.amountCents)}), mas ainda não pagou o Pix. Nenhum valor foi debitado. A contratação só será concluída se você pagar.`:billing?`FIO ${billing.plan} · ${BILLING_LABELS[billing.cycle]} · ${money(billing.amountCents)}`:'Consulte a situação antes de iniciar uma nova assinatura.'}</p></div>
   <div className="page-actions">{billing&&<button className="primary" disabled={busy} onClick={()=>{setCheckoutPlan(billing.plan);setCheckoutError('');}}>Ver detalhes</button>}{billing?.providerStatus==='pending_first_payment'&&!billing.change&&<button className="danger" disabled={busy} onClick={()=>void manageCharge('cancel_pending')}>Cancelar contratação</button>}<button className="secondary" disabled={busy} onClick={()=>void refreshBilling()}><RefreshCw size={16}/>{busy?'Consultando…':'Atualizar status'}</button></div>
  </section>}
  {billing?.change&&<p className="notice">Troca para FIO {billing.change.plan} · {BILLING_LABELS[billing.change.cycle]} em andamento. Confira a cobrança; seu acesso segue o plano atual até a confirmação.</p>}
  {checkoutError&&!checkoutPlan&&!changePlan&&<p className="fio-checkout-error" role="alert">{checkoutError}</p>}

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
     <div className="fio-card-action">{plan.code==='FREE'||unavailable?<button className="secondary full" disabled>{current?'Plano atual':'Plano gratuito'}</button>:billing?.providerStatus==='active'&&!billing.change?(billing.plan===plan.code&&billing.cycle===cycle?<button className="secondary full" disabled>Plano e período atuais</button>:<button className="primary full" disabled={busy} onClick={()=>{setChangePlan(plan.code as PaidPlan);setChangeAccepted(false);setCheckoutError('');}}>Trocar para {plan.code}<ArrowRight size={17}/></button>):billingLocked?<button className="secondary full" disabled={busy} onClick={()=>{if(billing)setCheckoutPlan(billing.plan);}}>Ver assinatura atual</button>:plan.code==='PRO'&&!trialUsed&&p.data.plan==='FREE'?<button className="primary full" disabled={busy||!billingLoaded||!billingConfigured} onClick={()=>setChoiceOpen(true)}>Começar com PRO<ArrowRight size={17}/></button>:<button className="primary full" disabled={busy||!billingLoaded||!billingConfigured} onClick={()=>selectPaid(plan.code as PaidPlan)}>Assinar {plan.code}<ArrowRight size={17}/></button>}</div>
    </article>;
   })}
  </div>

  <section className="fio-plan-explainer"><Info size={18}/><div><strong>Você controla quando iniciar a contratação.</strong><p>O FIO só inicia uma contratação depois que o responsável escolhe um plano, aceita as condições e solicita o Pix. O plano pago só é liberado após a confirmação do pagamento.</p></div></section>

  {choiceOpen&&<Modal title="Começar no FIO PRO" onClose={()=>{if(!busy)setChoiceOpen(false);}}><div className="fio-start-options"><p className="muted">Escolha como você quer começar. Nenhuma cobrança é feita ao ativar o teste grátis.</p><button className="fio-start-option" disabled={busy} onClick={()=>void startTrial()}><span className="fio-start-icon"><Gift size={21}/></span><div><strong>Testar por 14 dias grátis</strong><p>Explore os recursos do PRO sem pagamento agora. Disponível uma única vez por barbearia.</p></div><ArrowRight size={18}/></button><button className="fio-start-option" disabled={busy} onClick={()=>selectPaid('PRO')}><span className="fio-start-icon"><WalletCards size={21}/></span><div><strong>Assinar agora</strong><p>Use o período <b>{BILLING_LABELS[cycle].toLowerCase()}</b> selecionado e gere a cobrança.</p></div><ArrowRight size={18}/></button>{busy&&<p className="muted fio-start-wait">Ativando seu teste…</p>}</div></Modal>}

  {changePlan&&<Modal title="Revisar troca de plano" onClose={()=>{if(!busy)setChangePlan(null);}}><div className="fio-checkout-placeholder"><h3>FIO {changePlan} · {BILLING_LABELS[cycle]}</h3><p>Novo valor por período: <strong>{money(FIO_PLAN_CATALOG.find(x=>x.code===changePlan)!.prices[cycle]!)}</strong>.</p><p>Se houver aumento, a cobrança calcula a diferença proporcional do período atual e gera um Pix. O FIO libera os novos recursos após confirmar essa diferença. Reduções são agendadas para o próximo ciclo, sem devolução do período já pago.</p><label className="fio-terms"><input type="checkbox" checked={changeAccepted} onChange={e=>setChangeAccepted(e.target.checked)}/>Entendi a mudança de valor e autorizo solicitar a troca.</label>{checkoutError&&<p role="alert" className="fio-checkout-error">{checkoutError}</p>}<button className="primary full" disabled={busy||!changeAccepted} onClick={()=>void confirmChange()}>{busy?'Solicitando…':'Confirmar troca'}</button><button disabled={busy} className="secondary full" onClick={()=>setChangePlan(null)}>Voltar</button></div></Modal>}
  {checkoutPlan&&<Modal title={billing?`Assinatura FIO ${billing.plan}`:`Assinar FIO ${checkoutPlan}`} onClose={closeCheckout}><div className="fio-checkout-placeholder">
   <Crown size={28}/>
   {!billing?<>
    <h3>Revise e finalize</h3>
    <p className="muted">Assinatura <strong>{BILLING_LABELS[cycle].toLowerCase()}</strong>. O acesso pago só é liberado quando o pagamento for confirmado.</p>
    <div className="fio-checkout-summary"><div><span>Plano</span><strong>FIO {checkoutPlan}</strong></div><div><span>Período</span><strong>{BILLING_LABELS[cycle]}</strong></div><div><span>Valor</span><strong>{money(FIO_PLAN_CATALOG.find(x=>x.code===checkoutPlan)!.prices[cycle]!)}</strong></div></div>
    <label className="field fio-document-field"><span>CPF ou CNPJ do responsável</span><input value={document} inputMode="numeric" autoComplete="off" placeholder="Somente números ou formatado" maxLength={24} onChange={e=>setDocument(e.target.value)}/><small>Enviado à SyncPay para identificar o titular pagador e processar a assinatura. O FIO não salva esse número.</small></label>
    <label className="fio-terms"><input type="checkbox" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)}/><span>Li e aceito a contratação recorrente no período e valor acima. O acesso será ativado somente após a confirmação do pagamento.</span></label>
    {checkoutError&&<div className="fio-checkout-error">{checkoutError}</div>}
    <button className="primary full" disabled={busy||!acceptedTerms||document.replace(/\D/g,'').length<11} onClick={()=>void subscribe()}>{busy?'Preparando Pix…':'Gerar Pix'}<ArrowRight size={17}/></button>
    <button className="secondary full" disabled={busy} onClick={closeCheckout}>Cancelar</button>
   </>:<>
    <div className={`fio-payment-state ${billing.providerStatus==='active'?'is-success':''}`}><span>{billing.providerStatus==='active'?<Check size={20}/>:<WalletCards size={20}/>}</span><div><h3>{billing.change?'Troca de plano em andamento':billingStatusLabel(billing.providerStatus)}</h3><p>{billing.change?'Consulte a diferença abaixo. Os recursos novos aguardam confirmação quando há cobrança.':billing.providerStatus==='active'?'Pagamento confirmado. Atualize o status para sincronizar o acesso da barbearia.':usablePix(billing)?'Pague o Pix abaixo. A liberação depende da confirmação do pagamento.':'Não há um Pix válido disponível agora. Atualize o status ou fale com o suporte; não pague um código vencido.'}</p></div></div>
    <div className="settings-readonly"><span>Assinatura</span><strong>FIO {billing.plan} · {BILLING_LABELS[billing.cycle]}</strong><small>{billing.change?.amountCents!=null?`Diferença: ${money(billing.change.amountCents)}`:money(billing.amountCents)}{billing.payment?.expiresAt?` · válido até ${date(billing.payment.expiresAt)}`:''}</small></div>
    {usablePix(billing)&&<div className="fio-pix-box"><strong>Pix para pagamento</strong><p>Escaneie o QR Code no aplicativo do seu banco ou copie o código abaixo.</p><div className="fio-pix-qr"><QRCodeSVG value={billing.payment!.pixCode!} size={208} level="M" includeMargin aria-label="QR Code Pix para pagar"/></div><label htmlFor="fio-pix-code">Pix copia e cola</label><textarea id="fio-pix-code" aria-label="Código Pix copia e cola" readOnly value={billing.payment!.pixCode!} rows={3}/><button className="secondary full" onClick={()=>void copyPix()}><Copy size={16}/>Copiar código Pix</button><p className="fio-pix-recipient-note">O nome do recebedor exibido pelo banco é o cadastrado na conta SyncPay e não é alterado pelo FIO. Se não reconhecer o recebedor, não pague e fale com o suporte.</p></div>}
    {checkoutError&&<div className="fio-checkout-error">{checkoutError}</div>}
    {(billing.providerStatus!=='active'||billing.change)&&<button className="primary full" disabled={busy} onClick={()=>void refreshBilling()}><RefreshCw size={16}/>{busy?'Atualizando…':'Já paguei · atualizar status'}</button>}
    {['pending_first_payment','overdue'].includes(billing.providerStatus)&&!billing.change&&!usablePix(billing)&&<button className="secondary full" disabled={busy} onClick={()=>void manageCharge('resend')}>Gerar novo Pix da cobrança</button>}
    {billing.providerStatus==='pending_first_payment'&&!billing.change&&<button className="secondary full" disabled={busy} onClick={()=>void manageCharge('cancel_pending')}>Cancelar contratação pendente e escolher outro plano</button>}
    <p className="muted">Antes de pagar, confira valor e recebedor no aplicativo do seu banco. Se aparecer um alerta de segurança, interrompa o pagamento e fale com o suporte.</p>
    <button className="secondary full" disabled={busy} onClick={closeCheckout}>{billing.providerStatus==='active'?'Concluir':'Fechar e pagar depois'}</button>
   </>}
  </div></Modal>}
 </>;
}
