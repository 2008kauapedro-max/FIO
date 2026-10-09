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
import {annualCheckoutPreview} from '../../shared/syncpay-annual-checkout';
import {refundStatusDisplay} from '../../shared/syncpay-refund-status';
import './legal-payments.css';
import {premiumInitialPlan,canStartPaidCheckout} from '../lib/plan-presentation';

type Screen='plans'|'review'|'pix'|'pix-auto'|'success'|'manage'|'refund';
type PaymentMethod='card'|'pix'|'pix-auto'|'sync-card'|'sync-hosted';

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

 const [screen,setScreen]=useState<Screen>('plans');
 const [selectedPlan,setSelectedPlan]=useState<Plan>(premiumInitialPlan(soloMode));
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
 const [pixAutomaticoConfigured,setPixAutomaticoConfigured]=useState(false);
 const [legacyPixCheckoutConfigured,setLegacyPixCheckoutConfigured]=useState(false);
 const [syncpayCardConfigured,setSyncpayCardConfigured]=useState(false);
 const [hostedCardConfigured,setHostedCardConfigured]=useState(false);
 const [cardNumber,setCardNumber]=useState('');
 const [cardHolder,setCardHolder]=useState('');
 const [cardMonth,setCardMonth]=useState('');
 const [cardYear,setCardYear]=useState('');
 const [cardCvv,setCardCvv]=useState('');
 const [annualInstallments,setAnnualInstallments]=useState(1);
 const [refundTracking,setRefundTracking]=useState<{requested:boolean;status:string|null;code:string|null;requestedAt:string|null;subscriptionCancelled:boolean|null}|null>(null);
 const [refundTrackingLoading,setRefundTrackingLoading]=useState(false);
 const [refundTrackingError,setRefundTrackingError]=useState('');
 const [paymentMethod,setPaymentMethod]=useState<PaymentMethod>('card');
 const [stripeReturn,setStripeReturn]=useState<'pending'|'checking'|'cancelled'|null>(null);
 const [checkoutError,setCheckoutError]=useState('');
 const [checkoutCode,setCheckoutCode]=useState('');
 const [now,setNow]=useState(Date.now());

 const sub=p.data.fioSubscription;
 const trialUsed=Boolean(sub.trial_ends_at);
 const trialActive=sub.status==='trialing'&&Boolean(sub.trial_ends_at)&&new Date(sub.trial_ends_at!)>new Date();
 const billingLocked=billingLocksNewSubscription(billing);
 const canCheckoutCycle=canStartPaidCheckout({billingConfigured,stripeConfigured,pixAutomaticoConfigured,syncpayCardConfigured,legacyPixCheckoutConfigured},cycle)||(hostedCardConfigured&&cycle==='monthly');

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
   setSelectedPlan(premiumInitialPlan(soloMode));
 },[visiblePlans,selectedPlan]);

 useEffect(()=>{
  let active=true;

  void api<{configured:boolean;stripeConfigured:boolean;pixAutomaticoConfigured:boolean;syncpayCardConfigured:boolean;legacyPixCheckoutConfigured:boolean;hostedCardConfigured:boolean;subscription:BillingState|null}>(
   '/saas/billing',
   p.data.shop.id
  )
   .then(result=>{
    if(!active)return;
    setBilling(result.subscription);
    setBillingConfigured(result.configured);
    setStripeConfigured(result.stripeConfigured);
    setPixAutomaticoConfigured(Boolean(result.pixAutomaticoConfigured));
    setLegacyPixCheckoutConfigured(Boolean(result.legacyPixCheckoutConfigured));
    setSyncpayCardConfigured(Boolean(result.syncpayCardConfigured));
    setHostedCardConfigured(Boolean(result.hostedCardConfigured));
    setPaymentMethod(result.hostedCardConfigured?'sync-hosted':result.pixAutomaticoConfigured?'pix-auto':result.syncpayCardConfigured?'sync-card':result.stripeConfigured?'card':'pix');
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
  if(screen!=='pix'&&screen!=='pix-auto')return;

  const timer=window.setInterval(
   ()=>setNow(Date.now()),
   1000
  );

  return()=>window.clearInterval(timer);
 },[screen]);

 useEffect(()=>{
  if(
   (screen!=='pix'&&screen!=='pix-auto')||
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

     setBilling(previous=>{const next=result.subscription;return next?.billingMethod==='pix_automatico'&&!next.payment?.qrCode&&previous?.payment?.qrCode?{...next,payment:previous.payment}:next;});
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
   if(soloMode)return [
    'Um barbeiro: você, sem funcionários',
    translatedItem(0,0),
    translatedItem(0,2),
    translatedItem(1,0),
    translatedItem(1,1),
    translatedItem(2,0)
   ];
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

  if(!canCheckoutCycle){
   setCheckoutError('A SyncPay ainda não habilitou uma forma de pagamento para este período. Não é possível concluir uma assinatura paga agora. Nenhuma cobrança foi iniciada.');
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
  setPaymentMethod(hostedCardConfigured?'sync-hosted':pixAutomaticoConfigured?'pix-auto':syncpayCardConfigured?'sync-card':stripeConfigured?'card':'pix');
  setScreen('review');
 }

 async function checkHostedCard(){
  setBusy(true);setCheckoutError('');
  try{
   const state=await api<{state:string;pending:boolean}>('/saas/syncpay/hosted-card/status',p.data.shop.id);
   if(state.state==='linked'){
    await refreshBilling();await p.refresh();setScreen('success');
   }else if(state.state==='review')setCheckoutError('Há uma cobrança que precisa de conferência. Fale com o suporte antes de pagar novamente.');
   else if(state.state==='pending')setCheckoutError('Pagamento ainda não confirmado. Confira novamente em instantes.');
   else setCheckoutError('Nenhum pagamento hospedado recente foi encontrado.');
  }catch(e){setCheckoutError(checkoutMessage(e));}finally{setBusy(false);}
 }
 async function subscribe(){
  if(
   !checkoutPlan||
   !acceptedTerms||
   busy
  )
   return;

  if(paymentMethod==='sync-hosted'){
   if(!hostedCardConfigured||cycle!=='monthly')return;
   setBusy(true);setCheckoutError('');
   try{
    const result=await api<{url:string,pending:boolean}>('/saas/syncpay/hosted-card',p.data.shop.id,{plan:checkoutPlan,cycle,acceptedTerms:true});
    const url=new URL(result.url);
    if(url.protocol!=='https:'||url.hostname!=='app.syncpayments.com.br'||!url.pathname.startsWith('/subscription/'))throw new Error('UNSAFE_CHECKOUT_URL');
    window.location.assign(url.toString());
    return;
   }catch(error){setCheckoutError(checkoutMessage(error));setBusy(false);}
   return;
  }

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
  if(paymentMethod==='pix'&&!legacyPixCheckoutConfigured)return;
  if(paymentMethod==='pix-auto'&&!pixAutomaticoConfigured)return;
  if(paymentMethod==='sync-card'&&(!syncpayCardConfigured||cycle!=='monthly'))return;

  const digits=documentDigits(document);

  if(![11,14].includes(digits.length))
   return;

  setBusy(true);
  setCheckoutError('');
  setCheckoutCode('');

  try{
// O PAN/CVV vai somente para a selagem, nunca para armazenamento local ou assinatura.
    let cardToken:string|undefined;
    if(paymentMethod==='sync-card'){
     const sealed=await api<{token:string;brand:string|null;last4:string|null}>(
      '/saas/syncpay/card-token',p.data.shop.id,{card:{number:cardNumber.replace(/\D/g,''),holder_name:cardHolder.trim(),expiry_month:cardMonth,expiry_year:cardYear,cvv:cardCvv}}
     );
     cardToken=sealed.token;
     setCardNumber('');setCardCvv('');
    }
    const result=await api<BillingState>(
     '/saas/subscribe',p.data.shop.id,{
      plan:checkoutPlan,cycle,document:digits,
      method:paymentMethod==='sync-card'?'credit_card':paymentMethod==='pix-auto'?'pix_automatico':'qr_code',
      ...(cardToken?{cardToken}:{}),acceptedTerms:true
     }
    );

   setBilling(result);

   if(result.providerStatus==='active'){
    await p.refresh();
    setScreen('success');
   }else{
    setScreen(paymentMethod==='sync-card'?'manage':paymentMethod==='pix-auto'?'pix-auto':'pix');
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
    if(result.subscription?.providerStatus==='cancelled'){
     setScreen('plans');
     p.notify(result.subscription.billingMethod==='pix_automatico'?'Assinatura cancelada na SyncPay. Confira também a autorização do Pix Automático no seu banco.':t('fp.subscriptionCancelled'));
    }else{
     setScreen('manage');
     p.notify('A SyncPay ainda está confirmando o cancelamento. Verifique novamente para conferir o fim das cobranças.');
    }
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

 async function refreshRefundTracking(){
  if(!billing||billing.provider!=='syncpay')return;
  setRefundTrackingLoading(true);
  setRefundTrackingError('');
  try{
   const found=await api<{requested:boolean;status:string|null;code:string|null;requestedAt:string|null;subscriptionCancelled:boolean|null}>(
    '/saas/syncpay/refund-status',p.data.shop.id
   );
   setRefundTracking(found);
  }catch{
   setRefundTrackingError('Não foi possível consultar o andamento na SyncPay agora. Tente atualizar ou fale com o suporte.');
  }finally{setRefundTrackingLoading(false);}
 }

 useEffect(()=>{
  if(screen!=='refund'||billing?.provider!=='syncpay')return;
  let valid=true;
  setRefundTrackingLoading(true);
  setRefundTracking(null);
  setRefundTrackingError('');
  void api<{requested:boolean;status:string|null;code:string|null;requestedAt:string|null;subscriptionCancelled:boolean|null}>(
   '/saas/syncpay/refund-status',p.data.shop.id
  ).then(result=>{if(valid)setRefundTracking(result);})
   .catch(()=>{if(valid)setRefundTrackingError('Não foi possível consultar o andamento do reembolso na SyncPay.');})
   .finally(()=>{if(valid)setRefundTrackingLoading(false);});
  return()=>{valid=false;};
 },[screen,p.data.shop.id,billing?.provider]);

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

   if(result.subscription){
    setScreen('refund');
    await refreshRefundTracking().catch(()=>{});
   }else setScreen('plans');
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
  const annualPreview=total>0?annualCheckoutPreview(total,annualInstallments):null;

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
    {syncpayCardConfigured&&cycle==='annual'&&<div className="fio-payflow-note fio-annual-card-options">
      <CreditCard size={18}/>
      <div style={{flex:1,minWidth:0}}>
       <strong>Compra anual no cartão — até 12 parcelas</strong>
       <p>Uma única compra de 365 dias de acesso, sem renovação automática. Não são doze mensalidades.</p>
       <label htmlFor="fio-annual-installments">Número de parcelas</label>
       <select id="fio-annual-installments" aria-label="Quantidade de parcelas anuais" value={annualInstallments} onChange={event=>setAnnualInstallments(Number(event.target.value))}>
        {Array.from({length:12},(_,i)=>i+1).map(i=><option key={i} value={i}>{i}x</option>)}
       </select>
       <p>Preço anual do plano: <strong>{amount(total)}</strong>.</p>
       <p>{annualPreview?.totalCents!==null&&annualPreview?.totalCents!==undefined?'Total para 1x: '+amount(annualPreview.totalCents):'O total com as taxas da SyncPay ainda não foi confirmado.'}</p>
       <p>{annualPreview?.explanation}</p>
       <p><a className="fio-legal-text-link" href="/cartao-e-parcelamento" target="_blank" rel="noopener noreferrer">Ver condições de cartão e parcelamento</a></p>
       <button className="fio-payflow-secondary" type="button" disabled>Compra anual em preparação</button>
      </div>
     </div>}
    <div className="fio-payflow-methods" role="radiogroup" aria-label="Forma de pagamento">
      {hostedCardConfigured&&cycle==='monthly'&&<button type="button" role="radio" aria-checked={paymentMethod==='sync-hosted'} className={paymentMethod==='sync-hosted'?'active':''} onClick={()=>setPaymentMethod('sync-hosted')}>
       <CreditCard size={18}/><span><strong>Cartão pela SyncPay</strong><small>Checkout hospedado · assinatura mensal</small></span>
      </button>}
      {syncpayCardConfigured&&<button type="button" role="radio" aria-checked={paymentMethod==='sync-card'} disabled={cycle!=='monthly'} className={paymentMethod==='sync-card'?'active':''} onClick={()=>setPaymentMethod('sync-card')}>
       <CreditCard size={18}/><span><strong>Cartão SyncPay</strong><small>Assinatura mensal recorrente</small></span>
      </button>}
      {!syncpayCardConfigured&&<button type="button" role="radio" aria-checked={false} disabled title="Aguardando homologação da SyncPay">
       <CreditCard size={18}/><span><strong>Cartão de crédito</strong><small>Mensal recorrente ou anual parcelado · em preparação</small></span>
      </button>}
      {pixAutomaticoConfigured&&<button type="button" role="radio" aria-checked={paymentMethod==='pix-auto'} className={paymentMethod==='pix-auto'?'active':''} onClick={()=>setPaymentMethod('pix-auto')}>
       <WalletCards size={18}/><span><strong>Pix Automático</strong><small>Autorize uma vez no app do banco</small></span>
      </button>}
      {!pixAutomaticoConfigured&&<button type="button" role="radio" aria-checked={false} disabled title="Aguardando homologação da SyncPay">
       <WalletCards size={18}/><span><strong>Pix Automático</strong><small>Autorização bancária · em preparação</small></span>
      </button>}
     {stripeConfigured&&!pixAutomaticoConfigured&&!syncpayCardConfigured&&<button
      type="button"
      role="radio"
      aria-checked={paymentMethod==='card'}
      className={paymentMethod==='card'?'active':''}
      disabled={!stripeConfigured||pixAutomaticoConfigured||syncpayCardConfigured}
      onClick={()=>setPaymentMethod('card')}
     >
      <CreditCard size={18}/>
      <span>
       <strong>Cartão</strong>
       <small>Crédito · pagamento seguro pela Stripe</small>
      </span>
     </button>}

     {legacyPixCheckoutConfigured&&!pixAutomaticoConfigured&&!syncpayCardConfigured&&<button
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
     </button>}
    </div>
    {!hostedCardConfigured&&!legacyPixCheckoutConfigured&&!pixAutomaticoConfigured&&!syncpayCardConfigured&&!stripeConfigured&&
     <div className="fio-payflow-note" role="status">Novos pagamentos estão temporariamente indisponíveis. O FIO está preparando Pix Automático e cartão. Os contratos existentes continuam acessíveis em Minha assinatura.</div>}

    {paymentMethod==='sync-hosted'?<div className="fio-payflow-note"><ShieldCheck size={18}/><span>Você será direcionado à SyncPay para informar os dados do cartão. O FIO não receberá o número nem o CVV. Sua assinatura só será ativada após confirmação do pagamento.</span></div>:paymentMethod==='sync-card'?<>
      <div className="fio-payflow-note"><ShieldCheck size={18}/><span>O cartão é usado para autorizar uma assinatura mensal. A confirmação de acesso depende da SyncPay. Os dados não ficam salvos no FIO.</span></div>
      <label className="fio-payflow-field"><span>CPF ou CNPJ do titular</span><input value={document} inputMode="numeric" autoComplete="off" maxLength={18} onChange={event=>setDocument(formatDocument(event.target.value))}/></label>
      <label className="fio-payflow-field"><span>Nome impresso no cartão</span><input value={cardHolder} autoComplete="cc-name" onChange={event=>setCardHolder(event.target.value)} /></label>
      <label className="fio-payflow-field"><span>Número do cartão</span><input value={cardNumber} inputMode="numeric" autoComplete="cc-number" onChange={event=>setCardNumber(event.target.value.replace(/\D/g,'').slice(0,19))}/></label>
      <div className="fio-payflow-review-card">
       <label className="fio-payflow-field"><span>Mês (MM)</span><input value={cardMonth} inputMode="numeric" autoComplete="cc-exp-month" maxLength={2} onChange={event=>setCardMonth(event.target.value.replace(/\D/g,'').slice(0,2))}/></label>
       <label className="fio-payflow-field"><span>Ano (AAAA)</span><input value={cardYear} inputMode="numeric" autoComplete="cc-exp-year" maxLength={4} onChange={event=>setCardYear(event.target.value.replace(/\D/g,'').slice(0,4))}/></label>
       <label className="fio-payflow-field"><span>CVV</span><input value={cardCvv} type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} onChange={event=>setCardCvv(event.target.value.replace(/\D/g,'').slice(0,4))}/></label>
      </div>
      <div className="fio-legal-inline"><a className="fio-legal-text-link" href="/cartao-e-parcelamento" target="_blank" rel="noopener noreferrer">Condições do cartão</a></div>
     </>:paymentMethod==='card'
     ?<div className="fio-payflow-note">
       <ShieldCheck size={18}/>
       <span>Você será direcionado ao Checkout seguro da Stripe. O FIO não recebe nem armazena os dados do seu cartão.</span>
      </div>
     :<>
      <label className="fio-payflow-field">
       <span>CPF ou CNPJ do responsável</span>
       <input
        value={document}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        maxLength={18}
        onChange={event=>setDocument(formatDocument(event.target.value))}
       />
       <small>Enviado à SyncPay para identificar quem paga. O FIO não salva esse número.</small>
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
      {' · '}
      <a href="/privacidade" target="_blank" rel="noreferrer">Privacidade</a>
     </span>
    </label>
    <div className="fio-legal-inline" aria-label="Informações da contratação">
     <a className="fio-legal-text-link" href="/condicoes-de-pagamento" target="_blank" rel="noopener noreferrer">Condições de pagamento</a>
     <a className="fio-legal-text-link" href="/cancelamento-e-reembolso" target="_blank" rel="noopener noreferrer">Cancelamento e reembolso</a>
     <a className="fio-legal-text-link" href={['card','sync-hosted','sync-card'].includes(paymentMethod)?'/cartao-e-parcelamento':'/pix-automatico'} target="_blank" rel="noopener noreferrer">{['card','sync-hosted','sync-card'].includes(paymentMethod)?'Entenda cartão e parcelamento':'Entenda as formas de pagamento Pix'}</a>
    </div>
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
         (paymentMethod==='sync-hosted'
           ?!hostedCardConfigured||cycle!=='monthly'
           :paymentMethod==='card'
           ?!stripeConfigured
           :paymentMethod==='sync-card'
            ?!syncpayCardConfigured||cycle!=='monthly'||!([11,14].includes(documentDigits(document).length))||cardNumber.length<13||cardHolder.trim().length<5||cardMonth.length!==2||cardYear.length!==4||cardCvv.length<3
            :!billingConfigured||(paymentMethod==='pix'&&!legacyPixCheckoutConfigured)||![11,14].includes(documentDigits(document).length))
      )
     }
     onClick={()=>void (changePlan?confirmChange():subscribe())}
    >
     {busy
      ?paymentMethod==='card'||paymentMethod==='sync-hosted'
       ?'Abrindo pagamento seguro...'
       :t('fp.preparingPix')
      :changePlan
       ?t('fp.confirmChange')
       :paymentMethod==='card'||paymentMethod==='sync-hosted'
        ?'Continuar com cartão'
        :paymentMethod==='sync-card'?'Autorizar assinatura no cartão':paymentMethod==='pix-auto'?'Autorizar Pix Automático':'Gerar Pix'
     }
     <span>→</span>
    </button>
   </div>
  </section>;
 }

 if(screen==='pix-auto'&&billing){
  const validMandate=Boolean(billing.payment?.qrCode&&billing.payment?.identifier);
  return <section className="fio-payflow fio-payflow-pix" aria-label="Autorizar Pix Automático">
   <header className="fio-payflow-titlebar"><div><button type="button" className="fio-payflow-back" onClick={returnPlans} aria-label="Voltar"><ArrowLeft size={18}/></button><div><h1>Autorizar Pix Automático</h1><span>{displayName(billing.plan)} · {cycleLabel(billing.cycle)}</span></div></div></header>
   <div className="fio-payflow-pix-center"><span>Autorize as próximas cobranças no aplicativo do seu banco</span><strong>{amount(billing.amountCents)}</strong></div>
   {validMandate?<><div className="fio-payflow-qr"><QRCodeSVG value={billing.payment!.qrCode!} size={220} level="M" includeMargin aria-label="QR Code de autorização do Pix Automático"/></div><ol className="fio-payflow-steps"><li>Abra o aplicativo do seu banco.</li><li>Leia o QR Code e confira as condições da autorização.</li><li>Confirme no banco. O plano será ativado após a confirmação real do pagamento.</li></ol><p role="status">Status da autorização: {billing.payment?.mandateStatus??'Aguardando confirmação'}</p></>:<div className="fio-payflow-note">Não foi possível obter um mandato válido. Consulte novamente ou procure o suporte antes de tentar contratar outra vez.</div>}
   <div className="fio-legal-inline"><a className="fio-legal-text-link" href="/pix-automatico" target="_blank" rel="noopener noreferrer">Como funciona e seus direitos</a><a className="fio-legal-text-link" href="/cancelamento-e-reembolso" target="_blank" rel="noopener noreferrer">Cancelamento e reembolso</a></div>
   <div className="fio-payflow-bottom-action"><button className="fio-payflow-primary" disabled={busy} onClick={()=>void refreshBilling()}>Verificar autorização</button>
   {billing.providerStatus==='pending_first_payment'&&<button type="button" className="fio-payflow-link-danger" disabled={busy} onClick={()=>void manageCharge('cancel_pending')}>Cancelar a contratação</button>}
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

 if(screen==='refund'&&billing){
  // A elegibilidade vem dos dados conciliados pelo servidor, não de uma opção escolhida pelo usuário.
  const automaticRefund=billing.provider==='syncpay'&&billing.refund?.eligible===true;
  const deadline=billing.provider==='syncpay'?billing.refund?.deadline:null;
  const deadlineExpired=Boolean(deadline&&Date.parse(deadline)<Date.now());
  return <section className="fio-payflow fio-payflow-manage">
   <header className="fio-payflow-titlebar">
    <div>
     <button type="button" className="fio-payflow-back" aria-label="Voltar à assinatura" onClick={()=>setScreen('manage')}><ArrowLeft size={18}/></button>
     <div><h1>Consultar reembolso</h1><span>{displayName(billing.plan)}</span></div>
    </div>
    <button type="button" className="fio-payflow-close" aria-label="Fechar" onClick={()=>setScreen('manage')}><X size={20}/></button>
   </header>
   <div className="fio-legal-refund-panel" aria-live="polite">
    {refundTrackingLoading&&<p role="status">Consultando a solicitação na SyncPay...</p>}
    {refundTrackingError&&<p role="alert">{refundTrackingError}</p>}
    {refundTracking?.requested&&<>
     <h2>Acompanhar reembolso</h2>
     <p>{refundTracking.status?refundStatusDisplay(refundTracking.status).label:'Status em verificação.'}</p>
     <p>Protocolo: <code>{refundTracking.code}</code></p>
     {refundTracking.requestedAt&&<p>Pedido registrado em {date(refundTracking.requestedAt)}.</p>}
     {refundTracking.subscriptionCancelled===true&&<p>Assinatura marcada como cancelada na SyncPay. No Pix Automático, confira também a autorização no seu banco.</p>}
     {refundTracking.subscriptionCancelled===false&&<p>ATENÇÃO: a SyncPay ainda não marcou esta assinatura como cancelada. Consulte o suporte; no Pix Automático, confira também a autorização no banco.</p>}
    </>}
    {!refundTrackingLoading&&!refundTrackingError&&!refundTracking?.requested&&(automaticRefund?<>
      <h2>Reembolso disponível</h2>
     <p className="fio-legal-refund-status">Sua contratação está dentro do período inicial de sete dias verificado pelo FIO.</p>
     <p className="fio-legal-inline"><a className="fio-legal-text-link" href="/direitos-do-cliente" target="_blank" rel="noopener noreferrer">Ver seus direitos e condições de reembolso</a></p>
     <p>O sistema consultou automaticamente os registros confirmados da cobrança. A elegibilidade será verificada novamente pelo servidor antes de processar o pedido.</p>
     {deadline&&<p>Prazo indicado pelo sistema: até <strong>{date(deadline)}</strong>.</p>}
     <p>O crédito será realizado pelo fluxo da SyncPay após confirmação. Não há garantia de devolução instantânea.</p>
    </>:<>
     <h2>{deadlineExpired?'O prazo inicial terminou':'Consulte as condições de reembolso'}</h2>
     <p>{deadlineExpired
      ?'O período inicial de sete dias identificado pelo sistema terminou. Isso não impede pedidos relativos a cobranças indevidas, duplicadas ou outros direitos previstos em lei.'
      :billing.provider==='stripe'
       ?'Para esta modalidade, o FIO direciona o pedido ao atendimento especializado. Não há reembolso automático disponível nesta tela.'
       :'Não encontramos uma cobrança elegível para reembolso automático. Se houve pagamento, erro, cobrança indevida ou outra situação protegida por lei, solicite uma análise ao suporte.'}</p>
    </>)}
    <div className="fio-legal-inline">
      <a className="fio-legal-text-link" href="/direitos-do-cliente" target="_blank" rel="noopener noreferrer">Ver seus direitos</a>
     <a className="fio-legal-text-link" href="/cancelamento-e-reembolso" target="_blank" rel="noopener noreferrer">Ler termos do reembolso</a>
     <a className="fio-legal-text-link" href="/condicoes-de-pagamento" target="_blank" rel="noopener noreferrer">Condições de pagamento</a>
    </div>
    {checkoutError&&<div className="fio-payflow-error" role="alert">{checkoutError}</div>}
    {refundTracking?.requested
     ?<button className="fio-payflow-primary" type="button" disabled={refundTrackingLoading} onClick={()=>void refreshRefundTracking()}>{refundTrackingLoading?'Atualizando...':'Atualizar andamento'}</button>
     :refundTrackingLoading||refundTrackingError
      ?<button className="fio-payflow-secondary" type="button" disabled={refundTrackingLoading} onClick={()=>void refreshRefundTracking()}>Tentar consultar novamente</button>
      :automaticRefund
       ?<button className="fio-payflow-primary" disabled={busy} onClick={()=>void requestRefund()}>{busy?'Processando solicitação...':'Solicitar reembolso'}</button>
       :<button className="fio-payflow-primary" onClick={()=>navigate(p.base+'/suporte')}>Solicitar análise ao suporte</button>
    }
    <p style={{fontSize:12,opacity:.72}}>Cancelar a renovação e devolver uma cobrança são operações diferentes. Confira as condições antes de confirmar.</p>
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

   <div className="fio-legal-inline" aria-label="Direitos e políticas da assinatura">
    <a className="fio-legal-text-link" href="/direitos-do-cliente" target="_blank" rel="noopener noreferrer">Ver seus direitos</a>
    <a className="fio-legal-text-link" href="/cancelamento-e-reembolso" target="_blank" rel="noopener noreferrer">Política de reembolso</a>
    <a className="fio-legal-text-link" href="/condicoes-de-pagamento" target="_blank" rel="noopener noreferrer">Condições de pagamento</a>
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
     {billing.providerStatus==='pending_first_payment'&&!billing.change&&billing.billingMethod==='qr_code'&&
      <button className="fio-payflow-secondary" disabled={busy} onClick={()=>void manageCharge('resend')}>
       {t('fp.newPix')}
      </button>
     }

     <button className="fio-payflow-secondary" disabled={busy} onClick={()=>setScreen('refund')}>
      Consultar reembolso
     </button>

     {['active','overdue','suspended'].includes(billing.providerStatus)&&!billing.change&&
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
    {selectedPlan===primaryPaid&&!trialUsed&&<span className="trial"><Gift size={13}/>Teste de 14 dias · aguardando autorização de cobrança</span>}
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
  {hostedCardConfigured&&<button className="fio-payflow-secondary" type="button" disabled={busy} onClick={()=>void checkHostedCard()}>{busy?'Consultando...':'Já paguei na SyncPay · verificar pagamento'}</button>}
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
       disabled={busy||!billingLoaded||stripeReturn==='pending'||stripeReturn==='checking'}
       onClick={()=>selectedPaid&&choosePaid(selectedPaid)}
      >
       {!canCheckoutCycle
        ?'Ver disponibilidade do pagamento'
        :billing?.providerStatus==='active'
         ?`Trocar para ${displayName(selectedPlan)}`
         :`Assinar ${displayName(selectedPlan)}`
       }
      </button>
   }

   {billingLoaded&&!canCheckoutCycle&&selectedPlan!=='FREE'&&
    <p className="fio-trial-provider-note" role="status">
     A contratação ainda está em preparação enquanto aguardamos a SyncPay. O teste de 14 dias com renovação automática requer autorização prévia de cartão ou Pix Automático.
     Nenhuma cobrança será feita sem autorização. Para contratar, é necessário um método de pagamento habilitado para este período.
    </p>
   }
  </div>
 </section>;
}
