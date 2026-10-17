import {useEffect,useState} from 'react';
import {ArrowLeft,CreditCard,RefreshCw,ShieldCheck} from 'lucide-react';
import {api,RequestError} from '../lib/api';
import {tokenizeAnnualCard} from '../lib/syncpay-public-card';

type PaidAnnual='SOLO'|'SOLO_PREMIUM'|'PRO'|'PREMIUM';
type AnnualStatus={orderId?:string;state:string;paid?:boolean;providerStatus?:string;message?:string};
type AnnualConfig={chargeEnabled:boolean;maxInstallments:number};
type AnnualPrepare={id:string;state:string;automaticRenewal:false};

export function AnnualCardCheckout({shopId,plan,planName,priceCents,onBack,onPaid}:{
 shopId:string;plan:PaidAnnual;planName:string;priceCents:number;
 onBack:()=>void;onPaid:()=>Promise<void>;
}){
 const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);
 const [chargeEnabled,setChargeEnabled]=useState(false);
 const [error,setError]=useState('');
 const [orderId,setOrderId]=useState<string|null>(null);
 const [orderState,setOrderState]=useState('none');
 const [document,setDocument]=useState('');
 const [holder,setHolder]=useState('');
 const [number,setNumber]=useState('');
 const [month,setMonth]=useState('');
 const [year,setYear]=useState('');
 const [cvv,setCvv]=useState('');
 const [consent,setConsent]=useState(false);
 const key=import.meta.env.VITE_SYNCPAY_PUBLIC_KEY??'';
 const canCharge=chargeEnabled&&/^pk_live_[A-Za-z0-9._-]{8,}$/.test(key);
 const cents=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
 const failure=(e:unknown)=>e instanceof RequestError?e.message:
  e instanceof Error&&e.message==='FALHA_TOKENIZACAO'?'A SyncPay recusou os dados do cartão. Confira e tente novamente.':
  e instanceof Error&&e.message==='CARTAO_NAO_AUTORIZADO_NA_SYNCPAY'?'Esta conta ainda não tem autorização para cartão pela API.':
  'Não foi possível concluir. Confira o pedido antes de realizar outra tentativa.';

 useEffect(()=>{
  let current=true;
  void Promise.all([
   api<AnnualConfig>('/saas/annual/card-config',shopId),
   api<AnnualStatus>('/saas/annual/status',shopId)
  ]).then(async ([cfg,status])=>{
   if(!current)return;
   setChargeEnabled(Boolean(cfg.chargeEnabled&&cfg.maxInstallments>=1));
   if(status.orderId&&status.state!=='none'&&status.state!=='disabled'){
    setOrderId(status.orderId);setOrderState(status.state);
   }
  }).catch(e=>{if(current)setError(failure(e));}).finally(()=>{if(current)setReady(true);});
  return()=>{current=false;};
 },[shopId]);

 async function verify(){
  if(!orderId||busy)return;
  setBusy(true);setError('');
  try{
   const s=await api<AnnualStatus>(`/saas/annual/card-status?orderId=${encodeURIComponent(orderId)}`,shopId);
   setOrderState(s.state);
   if(s.paid===true||s.state==='paid')await onPaid();
   else if(s.state==='review')setError(s.providerStatus==='failed'
    ?'A SyncPay informou que o pagamento falhou. Não repita esta compra; consulte o suporte.'
    :'Pagamento ainda não aprovado. Aguarde e verifique novamente, sem criar outro pedido.');
   else if(s.state==='submitting')setError('A solicitação está em conferência. Não tente pagar novamente; fale com o suporte FIO se demorar.');
   else setError('Pedido ainda não confirmado. Se você já pagou, não tente novamente; fale com o suporte.');
  }catch(e){setError(failure(e));}
  finally{setBusy(false);}
 }

 async function purchase(){
  if(busy||!canCharge||!consent||![11,14].includes(document.replace(/\D/g,'').length)||
   number.replace(/\D/g,'').length<13||holder.trim().length<5||month.length!==2||year.length!==4||cvv.length<3||
   (orderId!==null&&orderState!=='preparing'))return;
  setBusy(true);setError('');
  let submitted=false;
  try{
   const prepared=await api<AnnualPrepare>('/saas/annual/prepare',shopId,{plan});
   setOrderId(prepared.id);setOrderState(prepared.state);
   if(prepared.state!=='preparing')throw new Error('PEDIDO_EM_ANALISE');
   const sealed=await tokenizeAnnualCard(key,{number,holder_name:holder,expiry_month:month,expiry_year:year,cvv});
   // Erase PAN/CVV as soon as SyncPay returns the one-time token.
   setNumber('');setCvv('');
   submitted=true;setOrderState('submitting');
   const result=await api<AnnualStatus>('/saas/annual/card',shopId,{
    orderId:prepared.id,installments:1,cardToken:sealed.token,
    ...(sealed.brand?{cardBrand:sealed.brand}:{}),
    ...(sealed.last4?{cardLast4:sealed.last4}:{}),
    document:document.replace(/\D/g,''),acceptedTerms:true
   });
   setOrderState(result.state);
   if(result.state==='paid'){await onPaid();return;}
   setError('Cobrança enviada. Aguardando aprovação da SyncPay. A verificação automática está ativa.');
  }catch(e){
   if(submitted){setOrderState('submitting');setError('Não foi possível confirmar a resposta. A cobrança pode ter sido enviada. NÃO tente pagar novamente; verifique o pedido ou procure suporte.');}
   else setError(failure(e));
  }finally{setNumber('');setCvv('');setBusy(false);}
 }

 // Enquanto a tela estiver aberta, confere automaticamente; o webhook faz a
 // conciliacao mesmo se o cliente fechar a pagina.
 useEffect(()=>{
  if(orderState!=='review'||!orderId)return;
  let active=true,checking=false;
  const timer=window.setInterval(()=>{
   if(!active||checking||window.document.visibilityState==='hidden')return;
   checking=true;
   void api<AnnualStatus>(`/saas/annual/card-status?orderId=${encodeURIComponent(orderId)}`,shopId)
    .then(s=>{if(!active)return;setOrderState(s.state);
      if(s.paid===true||s.state==='paid')void onPaid();})
    .catch(()=>{ /* Permanece pendente; nao inicia outra cobranca */ })
    .finally(()=>{checking=false;});
  },20000);
  return()=>{active=false;window.clearInterval(timer);};
 },[orderId,orderState,shopId,onPaid]);
 const blocked=Boolean(orderId)&&!['none','preparing'].includes(orderState);
 return <section className="fio-payflow fio-payflow-review" aria-label="Compra anual no cartão">
  <header className="fio-payflow-titlebar"><div>
   <button className="fio-payflow-back" type="button" onClick={onBack} aria-label="Voltar aos planos"><ArrowLeft size={18}/></button>
   <div><h1>Comprar plano anual</h1><span>{planName} · 365 dias</span></div>
  </div></header>
  <div className="fio-payflow-review-card"><div><span>Plano</span><strong>{planName}</strong></div>
   <div><span>Pagamento único</span><strong>{cents(priceCents)} em 1x</strong></div>
   <div><span>Renovação automática</span><strong>Não</strong></div></div>
  <div className="fio-payflow-note"><ShieldCheck size={18}/><span>Cartão enviado diretamente à SyncPay. O FIO recebe apenas um token. O acesso só é liberado após confirmação do pagamento.</span></div>
  <div className="fio-payflow-note">Parcelas de 2x a 12x ainda aguardam confirmação do total com juros pela SyncPay. Nenhuma estimativa será cobrada como preço final.</div>
  {!ready?<div className="fio-payflow-note">Conferindo disponibilidade...</div>:
   !canCharge?<div className="fio-payflow-note" role="status">Pagamento anual de 1x preparado, mas ainda bloqueado até a validação final da conta SyncPay. Nenhuma cobrança pode ser iniciada.</div>:null}
  {blocked?<div className="fio-payflow-note" role="status">Já existe um pedido anual ({orderState}). Para evitar duplicidade, não é possível iniciar outro pagamento.</div>:
   <div>
    <label className="fio-payflow-field"><span>CPF ou CNPJ do pagador</span><input inputMode="numeric" value={document} onChange={e=>setDocument(e.target.value.replace(/\D/g,'').slice(0,14))} autoComplete="off"/></label>
    <label className="fio-payflow-field"><span>Nome no cartão</span><input autoComplete="cc-name" value={holder} onChange={e=>setHolder(e.target.value.slice(0,80))}/></label>
    <label className="fio-payflow-field"><span>Número do cartão</span><input inputMode="numeric" autoComplete="cc-number" value={number} onChange={e=>setNumber(e.target.value.replace(/\D/g,'').slice(0,19))}/></label>
    <div className="fio-payflow-review-card">
     <label className="fio-payflow-field"><span>Mês (MM)</span><input value={month} autoComplete="cc-exp-month" inputMode="numeric" maxLength={2} onChange={e=>setMonth(e.target.value.replace(/\D/g,'').slice(0,2))}/></label>
     <label className="fio-payflow-field"><span>Ano (AAAA)</span><input value={year} autoComplete="cc-exp-year" inputMode="numeric" maxLength={4} onChange={e=>setYear(e.target.value.replace(/\D/g,'').slice(0,4))}/></label>
     <label className="fio-payflow-field"><span>CVV</span><input type="password" autoComplete="cc-csc" value={cvv} inputMode="numeric" maxLength={4} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,4))}/></label>
    </div>
    <label className="fio-payflow-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Autorizo uma compra única de {cents(priceCents)} em 1x, sem renovação automática. Li os <a target="_blank" rel="noreferrer" href="/termos">Termos</a> e a <a target="_blank" rel="noreferrer" href="/cancelamento-e-reembolso">política de reembolso</a>.</span></label>
   </div>}
  {error&&<div className="fio-payflow-error" role="alert">{error}</div>}
  <div className="fio-payflow-bottom-action">
   {blocked?<button className="fio-payflow-primary" disabled={busy} type="button" onClick={()=>void verify()}><RefreshCw size={16}/> {busy?'Consultando...':'Verificar pagamento'}</button>
    :<button className="fio-payflow-primary" type="button" disabled={!ready||!canCharge||busy||!consent||![11,14].includes(document.length)||number.length<13||holder.trim().length<5||month.length!==2||year.length!==4||cvv.length<3}
     onClick={()=>void purchase()}><CreditCard size={16}/> {busy?'Preparando...':'Pagar anual em 1x'} →</button>}
  </div>
 </section>;
}
