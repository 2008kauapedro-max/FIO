import { useEffect,useMemo,useState } from 'react';
import { ArrowLeft,Check,Copy,CreditCard,Crown,Gift,RefreshCw,ShieldCheck,WalletCards,X } from 'lucide-react';
import { useLocation,useNavigate } from 'react-router-dom';
import { FIO_PLAN_CATALOG,type BillingCycle } from '../../shared/fio-plans';
import { api,RequestError } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { billingLocksNewSubscription,usablePix,type BillingState,type PaidPlan } from '../../shared/billing-state';
import type { Plan } from '../../shared/domain';
import type { WorkspaceProps } from './Workspace';
import { useI18n } from '../i18n';

type Screen='plans'|'review'|'pix'|'success'|'manage';
type PaymentMethod='card'|'pix';

function documentDigits(value:string){
 return value.replace(/\D/g,'').slice(0,14);
}

function formatDocument(value:string){
 const digits=documentDigits(value);

 if(digits.length<=11){
  return digits
   .replace(/^(\d{3})(\d)/,'$1.$2')
   .replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3')
   .replace(/\.(\d{3})(\d)/,'.$1-$2');
 }

 return digits
  .replace(/^(\d{2})(\d)/,'$1.$2')
  .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
  .replace(/\.(\d{3})(\d)/,'.$1/$2')
  .replace(/(\d{4})(\d)/,'$1-$2');
}

export function FioPlans(p:WorkspaceProps){
 const {t,formatCurrency,formatDate}=useI18n();
 const navigate=useNavigate();
 const location=useLocation();

 const amount=(cents:number)=>formatCurrency(cents/100,'BRL');
 const date=(value?:string|null)=>value?formatDate(value,{day:'2-digit',month:'short',year:'numeric'}):'';
 const cycleLabel=(value:BillingCycle)=>t(`fp.cycle.${value}`);
 const providerStatus=(value:string)=>t(`fp.billingStatus.${['pending_first_payment','active','overdue','suspended','cancelled'].includes(value)?value:'default'}`);
 const checkoutMessage=(error:unknown)=>{
  if(!(error instanceof RequestError))
   return t('fp.billingError');

  const internalCodes=[
   'SYNCPAY_AUTH_ERROR',
   'SYNCPAY_CONFIG_ERROR',
   'STRIPE_AUTH_ERROR',
   'STRIPE_CONFIG_ERROR',
   'PROVIDER_ERROR',
   'INTERNAL_ERROR'
  ];

  if(internalCodes.includes(error.code))
   return t('fp.billingError');

  return error.message||t('fp.billingError');
 };

 const soloMode=p.data.shop.operation_mode==='SOLO';
 const primaryPaid:PaidPlan=soloMode?'SOLO':'PRO';

 const visiblePlans=useMemo(
  ()=>FIO_PLAN_CATALOG.filter(plan=>
   soloMode
    ?['FREE','SOLO','SOLO_PREMIUM'].includes(plan.code)
    :['FREE','PRO','PREMIUM'].includes(plan.code)
  ),
  [soloMode]
 );

 const initialPlan=visiblePlans.some(plan=>plan.code===p.data.plan)
  ?p.data.plan
  :'FREE';

 const [screen,setScreen]=useState<Screen>('plans');
 const [selectedPlan,setSelectedPlan]=useState<Plan>(initialPlan);
 const [cycle,setCycle]=useState<BillingCycle>('annual');
 const [document,setDocument]=useState('');
 const [acceptedTerms,setAcceptedTerms]=useState(false);
 const [changeAccepted,setChangeAccepted]=useState(false);
 const [checkoutPlan,setCheckoutPlan]=useState<PaidPlan|null>(null);
 const [changePlan,setChangePlan]=useState<PaidPlan|null>(null);
 const [busy,setBusy]=useState(false);
 const [billing,setBilling]=useState<BillingState|null>(null);
 const [billingLoaded,setBillingLoaded]=useState(false);
 const [billingConfigured,setBillingConfigured]=useState(false);
 const [stripeConfigured,setStripeConfigured]=useState(false);
 const [paymentMethod,setPaymentMethod]=useState<PaymentMethod>('card');
 const [stripeReturn,setStripeReturn]=useState<'pending'|'checking'|'cancelled'|null>(null);
 const [checkoutError,setCheckoutError]=useState('');
 const [checkoutCode,setCheckoutCode]=useState('');
 const [now,setNow]=useState(Date.now());

 const sub=p.data.fioSubscription;
 const trialUsed=Boolean(sub.trial_ends_at);
 const trialActive=sub.status==='trialing'&&Boolean(sub.trial_ends_at)&&new Date(sub.trial_ends_at!)>new Date();
 const billingLocked=billingLocksNewSubscription(billing);

 const planDefinition=visiblePlans.find(plan=>plan.code===selectedPlan)??visiblePlans[0];
 const planPrice=planDefinition.prices[cycle]??0;
 const annualSaving=planDefinition.code!=='FREE'&&cycle==='annual'&&planDefinition.prices.monthly!=null&&planDefinition.prices.annual!=null
  ?planDefinition.prices.monthly*12-planDefinition.prices.annual
  :0;
 const monthlyEquivalent=cycle==='annual'&&planPrice>0
  ?Math.round(planPrice/12)
  :null;

 useEffect(()=>{
  if(!visiblePlans.some(plan=>plan.code===selectedPlan))
   setSelectedPlan(visiblePlans[0]?.code??'FREE');
 },[visiblePlans,selectedPlan]);

 useEffect(()=>{
  let active=true;

  void api<{configured:boolean;stripeConfigured:boolean;subscription:BillingState|null}>(
   '/saas/billing',
   p.data.shop.id
  )
   .then(result=>{
    if(!active)return;
    setBilling(result.subscription);
    setBillingConfigured(result.configured);
    setStripeConfigured(result.stripeConfigured);
    setPaymentMethod(result.stripeConfigured?'card':'pix');
    setBillingLoaded(true);
   })
   .catch(error=>{
    if(!active)return;
    setCheckoutError(checkoutMessage(error));
    setBillingLoaded(true);
   });

  return()=>{active=false;};
 },[p.data.shop.id]);

 useEffect(()=>{
  if(screen!=='pix')return;

  const timer=window.setInterval(
   ()=>setNow(Date.now()),
   1000
  );

  return()=>window.clearInterval(timer);
 },[screen]);

 useEffect(()=>{
  if(
   screen!=='pix'||
   !billing||
   billing.providerStatus==='active'
  )
   return;

  let active=true;

  const poll=window.setInterval(()=>{
   void api<{configured:boolean;subscription:BillingState|null}>(
    '/saas/billing',
    p.data.shop.id
   )
    .then(async result=>{
     if(!active)return;

     setBilling(result.subscription);
     setBillingConfigured(result.configured);

     if(result.subscription?.providerStatus==='active'){
      await p.refresh();
      setScreen('success');
     }
    })
    .catch(()=>undefined);
  },5000);

  return()=>{
   active=false;
   window.clearInterval(poll);
  };
 },[screen,billing?.providerStatus,p.data.shop.id,p.refresh]);

 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  const outcome=params.get('stripe');
  if(outcome!=='success'&&outcome!=='cancelled')return;
  const sessionId=params.get('session_id')??'';
  params.delete('stripe');
  params.delete('session_id');
  const remaining=params.toString();
  navigate({pathname:location.pathname,search:remaining?'?'+remaining:''},{replace:true});
  if(outcome==='success'&&/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId))
   setStripeReturn('pending');
  else if(outcome==='cancelled')
   setStripeReturn('cancelled');
 },[location.pathname,location.search,navigate]);

 useEffect(()=>{
  if(stripeReturn!=='pending')return;
  let alive=true;
  let attempts=0;
  let checking=false;
  const check=async()=>{
   if(!alive||checking)return;
   checking=true;
   let confirmed=false;
   try{
    const result=await api<{configured:boolean;stripeConfigured:boolean;subscription:BillingState|null}>(
     '/saas/billing',p.data.shop.id
    );
    if(!alive)return;
    setBilling(result.subscription);
    setBillingConfigured(result.configured);
    setStripeConfigured(result.stripeConfigured);
    if(result.subscription?.provider==='stripe'&&result.subscription.providerStatus==='active'){
     confirmed=true;
     setSelectedPlan(result.subscription.plan);
     await p.refresh();
     if(!alive)return;
     setScreen('success');
     setStripeReturn(null);
    }
   }catch{
    // O parametro de retorno jamais concede acesso ou prova pagamento.
   }finally{
    checking=false;
    if(alive&&!confirmed&&++attempts>=12)setStripeReturn('checking');
   }
  };
  void check();
  const timer=window.setInterval(()=>void check(),5000);
  return()=>{alive=false;window.clearInterval(timer);};
 },[stripeReturn,p.data.shop.id,p.refresh]);

 function shortName(code:Plan){
  if(code==='FREE')return 'FREE';

  if(soloMode){
   if(code==='SOLO')return 'PRO';
   if(code==='SOLO_PREMIUM')return 'PREMIUM';
  }

  return code==='PRO'?'PRO':'PREMIUM';
 }

 function displayName(code:Plan){
  return `FIO ${shortName(code)}`;
 }

 function translatedItem(group:number,item:number){
  return t(`fp.plan.${planDefinition.code}.g${group}i${item}`);
 }

 const compactFeatures=useMemo(()=>{
  if(planDefinition.code==='FREE'){
   return [
    translatedItem(0,0),
    translatedItem(0,1),
    translatedItem(1,0),
    translatedItem(1,1),
    translatedItem(2,0)
   ];
  }

  if(soloMode){
   return [
    translatedItem(0,1),
    `${translatedItem(0,2)} · ${translatedItem(0,3)}`,
    `${translatedItem(1,0)} · ${translatedItem(1,1)}`,
    translatedItem(2,0),
    `${translatedItem(3,0)} · ${translatedItem(3,1)}`
   ];
  }

  return [
   translatedItem(0,0),
   translatedItem(0,1),
   `${translatedItem(0,2)} · ${translatedItem(0,3)}`,
   `${translatedItem(1,0)} · ${translatedItem(1,1)}`,
   `${translatedItem(3,0)} · ${translatedItem(3,1)}`
  ];
 },[planDefinition.code,soloMode,t]);

 function resetCheckout(){
  setCheckoutPlan(null);
  setChangePlan(null);
  setDocument('');
  setAcceptedTerms(false);
  setChangeAccepted(false);
  setCheckoutError('');
  setCheckoutCode('');
 }

 function returnPlans(){
  if(busy)return;
  resetCheckout();
  setScreen('plans');
 }

 async function startTrial(){
  if(busy)return;

  setBusy(true);
  setCheckoutError('');

  try{
   await api(
    '/saas/trial',
    p.data.shop.id,
    {confirmed:true}
   );

   await p.refresh();
   p.notify(t('fp.trialStarted'));
   setSelectedPlan(primaryPaid);
  }catch(error){
   p.notify(checkoutMessage(error));
  }finally{
   setBusy(false);
  }
 }

 function choosePaid(code:PaidPlan){
  setCheckoutError('');
  setCheckoutCode('');
  setSelectedPlan(code);

  if(stripeReturn==='pending'||stripeReturn==='checking'){
   setCheckoutError('Confirme o estado do pagamento Stripe antes de iniciar outra tentativa.');
   return;
  }

  if(!billingLoaded){
   setCheckoutError(t('fp.checking'));
   return;
  }

  if(billing?.provider==='stripe'){
   setSelectedPlan(billing.plan);
   setScreen('manage');
   return;
  }

  if(!billingConfigured&&!stripeConfigured){
   setCheckoutError(t('fp.billingSupport'));
   return;
  }

  if(
   billing&&
   ['pending_first_payment','overdue','suspended'].includes(billing.providerStatus)
  ){
   setSelectedPlan(billing.plan);

   if(usablePix(billing))
    setScreen('pix');
   else
    setScreen('manage');

   return;
  }

  if(
   billing?.providerStatus==='active'
  ){
   if(
    billing.plan===code&&
    billing.cycle===cycle
   ){
    setScreen('manage');
    return;
   }

   setChangePlan(code);
   setChangeAccepted(false);
   setScreen('review');
   return;
  }

  if(billingLocked){
   setCheckoutError(t('fp.currentChargeFirst'));
   return;
  }

  setCheckoutPlan(code);
  setDocument('');
  setAcceptedTerms(false);
  setPaymentMethod(stripeConfigured?'card':'pix');
  setScreen('review');
 }

 async function subscribe(){
  if(
   !checkoutPlan||
   !acceptedTerms||
   busy
  )
   return;

  if(paymentMethod==='card'){
   if(!stripeConfigured)return;

   setBusy(true);
   setCheckoutError('');
   setCheckoutCode('');

   try{
    const result=await api<{
     configured:boolean;
     provider:'stripe';
     sessionId:string;
     url:string;
    }>(
     '/saas/stripe/checkout',
     p.data.shop.id,
     {
      plan:checkoutPlan,
      cycle,
      acceptedTerms:true
     }
    );

    const checkoutUrl=new URL(result.url);

    if(
     checkoutUrl.protocol!=='https:'||
     checkoutUrl.hostname!=='checkout.stripe.com'
    )
     throw new Error('STRIPE_CHECKOUT_URL_INVALID');

    window.location.assign(checkoutUrl.toString());
    return;
   }catch(error){
    setCheckoutError(checkoutMessage(error));
    setCheckoutCode(error instanceof RequestError?error.code:'');
    setBusy(false);
   }

   return;
  }

  if(!billingConfigured)return;

  const digits=documentDigits(document);

  if(![11,14].includes(digits.length))
   return;

  setBusy(true);
  setCheckoutError('');
  setCheckoutCode('');

  try{
   const result=await api<BillingState>(
    '/saas/subscribe',
    p.data.shop.id,
    {
     plan:checkoutPlan,
     cycle,
     document:digits,
     acceptedTerms:true
    }
   );

   setBilling(result);

   if(result.providerStatus==='active'){
    await p.refresh();
    setScreen('success');
   }else{
    setScreen('pix');
   }

   p.notify(
    result.providerStatus==='active'
     ?t('fp.subscriptionConfirmed')
     :t('fp.chargeCreated')
   );
  }catch(error){
   setCheckoutError(checkoutMessage(error));
   setCheckoutCode(error instanceof RequestError?error.code:'');
  }finally{
   setBusy(false);
  }
 }

 async function confirmChange(){
  if(
   !changePlan||
   !changeAccepted||
   busy
  )
   return;

  setBusy(true);
  setCheckoutError('');
  setCheckoutCode('');

  try{
   const result=await api<{subscription:BillingState}>(
    '/saas/change-plan',
    p.data.shop.id,
    {
     plan:changePlan,
     cycle,
     confirmed:true
    }
   );

   setBilling(result.subscription);
   setSelectedPlan(changePlan);
   setChangePlan(null);
   await p.refresh();

   if(result.subscription.providerStatus==='active'&&!result.subscription.change)
    setScreen('success');
   else if(usablePix(result.subscription))
    setScreen('pix');
   else
    setScreen('manage');

   p.notify(t('fp.changeRequested'));
  }catch(error){
   setCheckoutError(checkoutMessage(error));
   setCheckoutCode(error instanceof RequestError?error.code:'');
  }finally{
   setBusy(false);
  }
 }

 async function refreshBilling(showNotice=true){
  if(busy)return;

  setBusy(true);
  setCheckoutError('');

  try{
   const result=await api<{configured:boolean;subscription:BillingState|null}>(
    '/saas/billing',
    p.data.shop.id
   );

   setBilling(result.subscription);
   setBillingConfigured(result.configured);
   setBillingLoaded(true);

   if(result.subscription?.providerStatus==='active'){
    await p.refresh();
    if(stripeReturn&&result.subscription.provider==='stripe'){
     setSelectedPlan(result.subscription.plan);
     setStripeReturn(null);
     setScreen('success');
    }else if(screen==='pix')
     setScreen('success');
   }

   if(showNotice){
    if(result.subscription?.providerStatus==='active')
     p.notify(t('fp.paymentConfirmed'));
    else if(result.subscription)
     p.notify(providerStatus(result.subscription.providerStatus));
    else
     p.notify(result.configured?t('fp.noCharge'):t('fp.billingSupport'));
   }
  }catch(error){
   setCheckoutError(checkoutMessage(error));
  }finally{
   setBusy(false);
  }
 }

 async function recoverEnrollment(){
  if(busy)return;

  setBusy(true);
  setCheckoutError('');
  setCheckoutCode('');

  try{
   const result=await api<{
    configured:boolean;
    subscription:BillingState|null;
    cleared:boolean;
   }>(
    '/saas/recover-enrollment',
    p.data.shop.id,
    {confirmed:true}
   );

   setBilling(result.subscription);

   if(result.subscription){
    setSelectedPlan(result.subscription.plan);

    if(usablePix(result.subscription))
     setScreen('pix');
    else
     setScreen('manage');

    p.notify(t('fp.recovered'));
   }else{
    setScreen('plans');
    p.notify(t('fp.previousCleared'));
   }
  }catch(error){
   setCheckoutError(checkoutMessage(error));
   setCheckoutCode(error instanceof RequestError?error.code:'');
  }finally{
   setBusy(false);
  }
 }

 async function manageStripeSubscription(){
  if(busy)return;
  setBusy(true);
  setCheckoutError('');
  try{
   const result=await api<{url:string}>(
    '/saas/stripe/portal',p.data.shop.id,{confirmed:true}
   );
   const portal=new URL(result.url);
   if(portal.protocol!=='https:'||portal.hostname!=='billing.stripe.com')
    throw new Error('STRIPE_PORTAL_URL_INVALID');
   window.location.assign(portal.toString());
  }catch(error){
   setCheckoutError(checkoutMessage(error));
   setBusy(false);
  }
 }

 async function manageCharge(action:'cancel_pending'|'resend'|'cancel_active'){
  const question=
   action==='cancel_pending'
    ?t('fp.confirmCancelPending')
    :action==='cancel_active'
     ?t('fp.confirmCancelActive')
     :t('fp.confirmNewPix');

  if(!window.confirm(question))return;

  setBusy(true);
  setCheckoutError('');

  try{
   const result=await api<{subscription:BillingState|null}>(
    '/saas/charge',
    p.data.shop.id,
    {action,confirmed:true}
   );

   setBilling(result.subscription);

   if(action==='cancel_pending'){
    setScreen('plans');
    resetCheckout();
    p.notify(t('fp.pendingCancelled'));
   }else if(action==='cancel_active'){
    await p.refresh();
    setScreen('plans');
    p.notify(t('fp.subscriptionCancelled'));
   }else{
    if(result.subscription&&usablePix(result.subscription))
     setScreen('pix');

    p.notify(t('fp.newPixReady'));
   }
  }catch(error){
   setCheckoutError(checkoutMessage(error));
  }finally{
   setBusy(false);
  }
 }

 async function requestRefund(){
  if(
   !billing?.refund?.eligible||
   busy
  )
   return;

  const deadline=billing.refund.deadline
   ?date(billing.refund.deadline)
   :t('fp.sevenDays');

  if(!window.confirm(t('fp.confirmRefund',{deadline})))
   return;

  setBusy(true);
  setCheckoutError('');

  try{
   const result=await api<{
    subscription:BillingState|null;
    refund:{
     code:string;
     status:string;
     requestedAt:string;
    };
    cancellation:
     'cancelled'|
     'needs_attention'|
     'already_requested';
   }>(
    '/saas/refund',
    p.data.shop.id,
    {confirmed:true}
   );

   setBilling(result.subscription);
   await p.refresh();

   if(result.cancellation==='needs_attention')
    p.notify(t('fp.refundSupport'));
   else
    p.notify(t('fp.refundSent'));

   setScreen('plans');
  }catch(error){
   setCheckoutError(checkoutMessage(error));
  }finally{
   setBusy(false);
  }
 }

 async function copyPix(){
  if(
   !usablePix(billing)||
   !billing?.payment?.pixCode
  ){
   p.notify(t('fp.pixUnavailable'));
   return;
  }

  try{
   await navigator.clipboard.writeText(
    billing.payment.pixCode
   );

   p.notify(t('fp.pixCopied'));
  }catch{
   p.notify(t('fp.pixCopyFailed'));
  }
 }

 const expiryText=useMemo(()=>{
  const expiry=billing?.payment?.expiresAt;

  if(!expiry)return '';

  const delta=Math.max(
   0,
   Date.parse(expiry)-now
  );

  const totalSeconds=Math.floor(delta/1000);
  const minutes=Math.floor(totalSeconds/60);
  const seconds=totalSeconds%60;

  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
 },[billing?.payment?.expiresAt,now]);

 if(screen==='review'){
  const target=changePlan??checkoutPlan;

  if(!target){
   setScreen('plans');
   return null;
  }

  const targetDefinition=FIO_PLAN_CATALOG.find(plan=>plan.code===target)!;
  const total=targetDefinition.prices[cycle]??0;

  return <section className="fio-payflow fio-payflow-review">
   <header className="fio-payflow-titlebar">
    <div>
     <button className="fio-payflow-back" type="button" onClick={returnPlans} aria-label={t('common.back')}>
      <ArrowLeft size={18}/>
     </button>
     <div>
      <h1>{changePlan?t('fp.changeModal'):'Revisar e pagar'}</h1>
      <span>{displayName(target)}</span>
     </div>
    </div>
    <button className="fio-payflow-close" type="button" onClick={returnPlans} aria-label={t('ui.close')}>
     <X size={20}/>
    </button>
   </header>

   <div className="fio-payflow-review-card">
    <div><span>{t('fp.plan')}</span><strong>{displayName(target)}</strong></div>
    <div><span>{t('fp.period')}</span><strong>{cycleLabel(cycle)}</strong></div>
    <div><span>{t('fp.value')}</span><strong>{amount(total)}</strong></div>
   </div>

   {!changePlan&&<>
    <div className="fio-payflow-methods" role="radiogroup" aria-label="Forma de pagamento">
     <button
      type="button"
      role="radio"
      aria-checked={paymentMethod==='card'}
      className={paymentMethod==='card'?'active':''}
      disabled={!stripeConfigured}
      onClick={()=>setPaymentMethod('card')}
     >
      <CreditCard size={18}/>
      <span>
       <strong>CartÃ£o</strong>
       <small>CrÃ©dito Â· pagamento seguro pela Stripe</small>
      </span>
     </button>

     <button
      type="button"
      role="radio"
      aria-checked={paymentMethod==='pix'}
      className={paymentMethod==='pix'?'active':''}
      disabled={!billingConfigured}
      onClick={()=>setPaymentMethod('pix')}
     >
      <WalletCards size={18}/>
      <span>
       <strong>Pix</strong>
       <small>Pagamento pela SyncPay</small>
      </span>
     </button>
    </div>

    {paymentMethod==='card'
     ?<div className="fio-payflow-note">
       <ShieldCheck size={18}/>
       <span>VocÃª serÃ¡ direcionado ao Checkout seguro da Stripe. O FIO nÃ£o recebe nem armazena os dados do seu cartÃ£o.</span>
      </div>
     :<>
      <label className="fio-payflow-field">
       <span>CPF ou CNPJ do responsÃ¡vel</span>
       <input
        value={document}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        maxLength={18}
        onChange={event=>setDocument(formatDocument(event.target.value))}
       />
       <small>Enviado Ã  SyncPay para identificar quem paga. O FIO nÃ£o salva esse nÃºmero.</small>
      </label>

      <details className="fio-payflow-disclosure">
       <summary>{t('fp.cancelRefund')}</summary>
       <p>{t('fp.cancelRefundDesc')}</p>
       <p>{t('fp.noAutoRefund')}</p>
      </details>
     </>
    }

    <label className="fio-payflow-consent">
     <input
      type="checkbox"
      checked={acceptedTerms}
      onChange={event=>setAcceptedTerms(event.target.checked)}
     />
     <span>
      {t('fp.termsConsent')}{' '}
      <a href="/termos" target="_blank" rel="noreferrer">Termos</a>
      {' Â· '}
      <a href="/privacidade" target="_blank" rel="noreferrer">Privacidade</a>
     </span>
    </label>
   </>}

   {changePlan&&<>
    <div className="fio-payflow-note">
     <ShieldCheck size={18}/>
     <span>{t('fp.changeDesc')}</span>
    </div>

    <label className="fio-payflow-consent">
     <input
      type="checkbox"
      checked={changeAccepted}
      onChange={event=>setChangeAccepted(event.target.checked)}
     />
     <span>{t('fp.changeConsent')}</span>
    </label>
   </>}

   {checkoutError&&<div className="fio-payflow-error" role="alert">{checkoutError}</div>}

   {['SYNCPAY_ENROLLMENT_IN_PROGRESS','SYNCPAY_ENROLLMENT_UNCERTAIN'].includes(checkoutCode)&&
    <button className="fio-payflow-secondary" disabled={busy} onClick={()=>void recoverEnrollment()}>
     <RefreshCw size={16}/>
     {t('fp.checkPrevious')}
    </button>
   }

   <div className="fio-payflow-bottom-action">
    <button
     className="fio-payflow-primary"
     disabled={
      busy||
      (
       changePlan
        ?!changeAccepted
        :!acceptedTerms||
         (paymentMethod==='card'
          ?!stripeConfigured
          :!billingConfigured||![11,14].includes(documentDigits(document).length))
      )
     }
     onClick={()=>void (changePlan?confirmChange():subscribe())}
    >
     {busy
      ?paymentMethod==='card'
       ?'Abrindo pagamento seguro...'
       :t('fp.preparingPix')
      :changePlan
       ?t('fp.confirmChange')
       :paymentMethod==='card'
        ?'Continuar com cartÃ£o'
        :'Gerar Pix'
     }
     <span>→</span>
    </button>
   </div>
  </section>;
 }

 if(screen==='pix'&&billing){
  const canUsePix=usablePix(billing);

  return <section className="fio-payflow fio-payflow-pix">
   <header className="fio-payflow-titlebar">
    <div>
     <button className="fio-payflow-back" type="button" onClick={returnPlans} aria-label={t('common.back')}>
      <ArrowLeft size={18}/>
     </button>
     <div>
      <h1>{t('fp.pixPayment')}</h1>
      <span>{displayName(billing.plan)}</span>
     </div>
    </div>
    <button className="fio-payflow-close" type="button" onClick={returnPlans} aria-label={t('ui.close')}>
     <X size={20}/>
    </button>
   </header>

   <div className="fio-payflow-pix-center">
    <span>{t('fp.payPixDesc')}</span>
    <strong>{amount(billing.change?.amountCents??billing.amountCents)}</strong>
   </div>

   {canUsePix&&billing.payment?.pixCode?<>
    <div className="fio-payflow-qr">
     <QRCodeSVG
      value={billing.payment.pixCode}
      size={220}
      level="M"
      includeMargin
      aria-label={t('fp.pixQrAria')}
     />
    </div>

    <div className="fio-payflow-pix-copy">
     <code>{billing.payment.pixCode}</code>
     <button type="button" onClick={()=>void copyPix()}>{t('fp.copyPix')}</button>
    </div>

    <div className="fio-payflow-wait">
     <i/>
     <span>{providerStatus(billing.providerStatus)}</span>
     {expiryText&&<small>expira em <b>{expiryText}</b></small>}
    </div>

    <ol className="fio-payflow-steps">
     <li>Abra o app do seu banco.</li>
     <li>Escolha pagar com Pix e leia o QR Code ou cole o código.</li>
     <li>Confirme. O FIO libera o plano assim que receber a confirmação.</li>
    </ol>
   </>:<>
    <div className="fio-payflow-note">
     <WalletCards size={18}/>
     <span>{t('fp.noValidPix')}</span>
    </div>
   </>}

   {checkoutError&&<div className="fio-payflow-error" role="alert">{checkoutError}</div>}

   <div className="fio-payflow-bottom-action">
    <button className="fio-payflow-primary" disabled={busy} onClick={()=>void refreshBilling()}>
     <RefreshCw size={17}/>
     {busy?t('fp.updating'):t('fp.paidRefresh')}
    </button>

    {['pending_first_payment','overdue'].includes(billing.providerStatus)&&!billing.change&&
     <button className="fio-payflow-link-danger" disabled={busy} onClick={()=>void manageCharge('cancel_pending')}>
      {t('fp.cancelPending')}
     </button>
    }
   </div>
  </section>;
 }

 if(screen==='success'){
  return <section className="fio-payflow fio-payflow-success">
   <header className="fio-payflow-titlebar">
    <div>
     <div>
      <h1>Tudo certo</h1>
      <span>{displayName(selectedPlan)}</span>
     </div>
    </div>
   </header>

   <div className="fio-payflow-success-center">
    <span className="fio-payflow-success-icon"><Check size={30}/></span>
    <h2>{t('fp.paymentConfirmed')}</h2>
    <p>{displayName(selectedPlan)} já está ativo.</p>
   </div>

   <div className="fio-payflow-bottom-action">
    <button className="fio-payflow-primary" onClick={()=>navigate(p.base)}>
     Ir para o app
    </button>
   </div>
  </section>;
 }

 if(screen==='manage'&&billing){
  return <section className="fio-payflow fio-payflow-manage">
   <header className="fio-payflow-titlebar">
    <div>
     <button className="fio-payflow-back" type="button" onClick={returnPlans} aria-label={t('common.back')}>
      <ArrowLeft size={18}/>
     </button>
     <div>
      <h1>{t('fp.subscription')}</h1>
      <span>{displayName(billing.plan)}</span>
     </div>
    </div>
    <button className="fio-payflow-close" type="button" onClick={returnPlans} aria-label={t('ui.close')}>
     <X size={20}/>
    </button>
   </header>

   <div className="fio-payflow-manage-status">
    <Crown size={24}/>
    <div>
     <strong>{providerStatus(billing.providerStatus)}</strong>
     <span>{displayName(billing.plan)} · {cycleLabel(billing.cycle)}</span>
    </div>
   </div>

   <div className="fio-payflow-review-card">
    <div><span>{t('fp.plan')}</span><strong>{displayName(billing.plan)}</strong></div>
    <div><span>{t('fp.period')}</span><strong>{cycleLabel(billing.cycle)}</strong></div>
    <div><span>{t('fp.value')}</span><strong>{amount(billing.amountCents)}</strong></div>
   </div>

   {billing.change&&<div className="fio-payflow-note">
    <RefreshCw size={18}/>
    <span>{t('fp.changePending',{plan:displayName(billing.change.plan),cycle:cycleLabel(billing.change.cycle)})}</span>
   </div>}

   {checkoutError&&<div className="fio-payflow-error" role="alert">{checkoutError}</div>}

   <div className="fio-payflow-bottom-action">
    <button className="fio-payflow-primary" disabled={busy} onClick={()=>void refreshBilling()}>
     <RefreshCw size={17}/>
     {busy?t('fp.updating'):t('fp.refreshStatus')}
    </button>

    {billing.provider==='stripe'?<>
     <div className="fio-payflow-note">
      <ShieldCheck size={18}/>
      <span>Gerencie seu cartão e o cancelamento na Stripe. Para solicitar reembolso do primeiro pagamento em até 7 dias, use a Central de Ajuda do FIO.</span>
     </div>
     <button className="fio-payflow-secondary" disabled={busy} onClick={()=>void manageStripeSubscription()}>
      Gerenciar na Stripe
     </button>
     <button className="fio-payflow-secondary" disabled={busy} onClick={()=>navigate(p.base+'/suporte')}>
      Reembolso e suporte FIO
     </button>
    </>:<>
     {billing.providerStatus==='pending_first_payment'&&!billing.change&&
      <button className="fio-payflow-secondary" disabled={busy} onClick={()=>void manageCharge('resend')}>
       {t('fp.newPix')}
      </button>
     }

     {billing.providerStatus==='active'&&!billing.change&&billing.refund?.eligible&&
      <button className="fio-payflow-link-danger" disabled={busy} onClick={()=>void requestRefund()}>
       {t('fp.cancelRefundButton')}
      </button>
     }

     {['active','overdue','suspended'].includes(billing.providerStatus)&&!billing.change&&!billing.refund?.eligible&&
      <button className="fio-payflow-link-danger" disabled={busy} onClick={()=>void manageCharge('cancel_active')}>
       {t('fp.cancelSubscription')}
      </button>
     }
    </>}
   </div>
  </section>;
 }

 const paidSelected=selectedPlan!=='FREE';
 const selectedPaid=paidSelected?selectedPlan as PaidPlan:null;
 const currentSamePlan=p.data.plan===selectedPlan;
 const selectedBillingCurrent=Boolean(
  billing?.providerStatus==='active'&&
  billing.plan===selectedPlan&&
  billing.cycle===cycle
 );

 return <section className="fio-payflow fio-payflow-plans">
  {stripeReturn&&<div className="fio-payflow-note" role="status">
   <ShieldCheck size={18}/>
   <span>{stripeReturn==='pending'
    ?'Aguardando confirmacao segura da Stripe. O plano so sera ativado apos a confirmacao do webhook.'
    :stripeReturn==='cancelled'
     ?'Checkout interrompido. Confira o estado da assinatura antes de tentar novamente.'
     :'A confirmacao esta demorando. Confira o status ou procure o suporte FIO.'}</span>
   <button type="button" className="fio-payflow-secondary" disabled={busy} onClick={()=>void refreshBilling(false)}>Atualizar status</button>
  </div>}
  <div className="fio-payflow-plan-controls">
  <div className="fio-payflow-cycle" role="tablist" aria-label={t('fp.subscriptionPeriod')}>
   <button type="button" className={cycle==='annual'?'active':''} aria-selected={cycle==='annual'} onClick={()=>setCycle('annual')}>
    Anual <small>-20%</small>
   </button>
   <button type="button" className={cycle==='monthly'?'active':''} aria-selected={cycle==='monthly'} onClick={()=>setCycle('monthly')}>
    Mensal
   </button>
  </div>

  <div className="fio-payflow-tabs" role="tablist" aria-label={t('fp.title')}>
   {visiblePlans.map(plan=>
    <button
     type="button"
     key={plan.code}
     role="tab"
     aria-selected={selectedPlan===plan.code}
     className={selectedPlan===plan.code?'active':''}
     onClick={()=>setSelectedPlan(plan.code)}
    >
     {shortName(plan.code)}
    </button>
   )}
  </div>
  </div>

  <div className="fio-payflow-plan-scroll">
  <article className="fio-payflow-card" data-plan={selectedPlan}>
   <span className="fio-payflow-eyebrow">{t(`fp.plan.${planDefinition.code}.eyebrow`)}</span>
   <h2>{displayName(planDefinition.code)}</h2>

   <div className="fio-payflow-price">
    <strong>{planPrice===0?amount(0):amount(planPrice)}</strong>
    <span>{planPrice===0?'grátis':cycle==='annual'?'/ano':'/mês'}</span>
   </div>

   {monthlyEquivalent!==null&&
    <small className="fio-payflow-equivalent">
     equivale a {amount(monthlyEquivalent)}/mês
    </small>
   }

   <div className="fio-payflow-badges">
    {annualSaving>0&&<span>Economia de {amount(annualSaving)}/ano</span>}
    {selectedPlan===primaryPaid&&!trialUsed&&<span className="trial"><Gift size={13}/>14 dias grátis</span>}
   </div>

   <div className="fio-payflow-features">
    {compactFeatures.filter(Boolean).map((feature,index)=>{
     const premiumAi=
      ['PREMIUM','SOLO_PREMIUM'].includes(selectedPlan)&&
      index===compactFeatures.filter(Boolean).length-1;

     return <div
      key={`${selectedPlan}-${index}`}
      className={premiumAi?'fio-payflow-feature-ai-premium':''}
     >
      <Check size={15}/>
      <span>{feature}</span>
     </div>;
    })}
   </div>
  </article>

  {checkoutError&&<div className="fio-payflow-error" role="alert">{checkoutError}</div>}
  </div>

  <div className="fio-payflow-bottom-action fio-payflow-plan-action">
   {selectedPlan==='FREE'
    ?<button className="fio-payflow-primary" disabled>
      {currentSamePlan?t('fp.currentPlan'):t('fp.freePlan')}
     </button>
    :selectedBillingCurrent
     ?<button className="fio-payflow-primary" onClick={()=>setScreen('manage')}>
       {t('fp.viewSubscription')}
      </button>
     :<button
       className="fio-payflow-primary"
       disabled={busy||!billingLoaded||(!billingConfigured&&!stripeConfigured)||stripeReturn==='pending'||stripeReturn==='checking'}
       onClick={()=>selectedPaid&&choosePaid(selectedPaid)}
      >
       {billing?.providerStatus==='active'
        ?`Trocar para ${displayName(selectedPlan)}`
        :`Assinar ${displayName(selectedPlan)}`
       }
      </button>
   }

   {selectedPlan===primaryPaid&&!trialUsed&&p.data.plan==='FREE'&&!billingLocked&&
    <button className="fio-payflow-trial" disabled={busy} onClick={()=>void startTrial()}>
     {t('fp.trialCta',{plan:displayName(selectedPlan)})}
    </button>
   }
  </div>
 </section>;
}
