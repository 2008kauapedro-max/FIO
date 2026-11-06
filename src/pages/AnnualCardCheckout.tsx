import {useEffect,useState} from 'react';
import {ArrowLeft,Copy,CreditCard,QrCode,RefreshCw,ShieldCheck} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import {api,RequestError} from '../lib/api';
import {tokenizeAnnualCard} from '../lib/syncpay-public-card';

type PaidAnnual='SOLO'|'SOLO_PREMIUM'|'PRO'|'PREMIUM';
type AnnualStatus={orderId?:string;state:string;paid?:boolean;providerStatus?:string;message?:string;pixCode?:string};
type AnnualConfig={chargeEnabled:boolean;pixEnabled?:boolean;maxInstallments:number};
type AnnualPrepare={id:string;state:string;automaticRenewal:false};
type Method='pix'|'card';

export function AnnualCardCheckout({shopId,plan,planName,priceCents,onBack,onPaid}:{
 shopId:string;plan:PaidAnnual;planName:string;priceCents:number;
 onBack:()=>void;onPaid:()=>Promise<void>;
}){
 const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);
 const [chargeEnabled,setChargeEnabled]=useState(false);
 const [pixEnabled,setPixEnabled]=useState(false);
 const [method,setMethod]=useState<Method>('pix');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [orderId,setOrderId]=useState<string|null>(null);
 const [orderState,setOrderState]=useState('none');
 const [pixCode,setPixCode]=useState('');
 const [document,setDocument]=useState('');
 const [phone,setPhone]=useState('');
 const [holder,setHolder]=useState('');
 const [number,setNumber]=useState('');
 const [month,setMonth]=useState('');
 const [year,setYear]=useState('');
 const [cvv,setCvv]=useState('');
 const [consent,setConsent]=useState(false);
 const key=import.meta.env.VITE_SYNCPAY_PUBLIC_KEY??'';
 const canCard=chargeEnabled&&/^pk_live_[A-Za-z0-9._-]{8,}$/.test(key);
 const canPay=method==='pix'?pixEnabled:canCard;
 const cents=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
 const failure=(e:unknown)=>e instanceof RequestError?e.message:
  e instanceof Error&&e.message==='FALHA_TOKENIZACAO'?'A SyncPay recusou os dados do cartão. Confira e tente novamente.':
  e instanceof Error&&e.message==='CARTAO_NAO_AUTORIZADO_NA_SYNCPAY'?'Esta conta ainda não tem autorização para cartão pela API.':
  'Não foi possível concluir. Confira o pedido antes de realizar outra tentativa.';
 const docOk=[11,14].includes(document.replace(/\D/g,'').length);
 const phoneBad=!/^\d{10,13}$/.test(phone.replace(/\D/g,''));
 const phoneOk=!phoneBad;
 const cardOk=number.replace(/\D/g,'').length>=13&&holder.trim().length>=5&&month.length===2&&year.length===4&&cvv.length>=3;
 const formOk=consent&&docOk&&phoneOk&&(method==='pix'||cardOk);

 useEffect(()=>{
  let current=true;
  void Promise.all([
   api<AnnualConfig>('/saas/annual/card-config',shopId),
   api<AnnualStatus>('/saas/annual/status',shopId)
  ]).then(async ([cfg,status])=>{
   if(!current)return;
   const card=Boolean(cfg.chargeEnabled&&cfg.maxInstallments>=1);
   setChargeEnabled(card);setPixEnabled(Boolean(cfg.pixEnabled));
   setMethod(cfg.pixEnabled||!card?'pix':'card');
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
   if(s.pixCode)setPixCode(s.pixCode);
   if(s.paid===true||s.state==='paid')await onPaid();
   else if(s.state==='review'&&s.pixCode)setNotice('Pix ainda não pago. Pague pelo app do banco usando o código abaixo.');
   else if(s.state==='review')setError(s.providerStatus==='failed'
    ?'A SyncPay informou que o pagamento falhou. Não repita esta compra; consulte o suporte.'
    :'Pagamento ainda não aprovado. Aguarde e verifique novamente, sem criar outro pedido.');
   else if(s.state==='submitting')setError('A solicitação está em conferência. Não tente pagar novamente; fale com o suporte FIO se demorar.');
   else setError('Pedido ainda não confirmado. Se você já pagou, não tente novamente; fale com o suporte.');
  }catch(e){setError(failure(e));}
  finally{setBusy(false);}
 }

 async function prepare(){
  const prepared=await api<AnnualPrepare>('/saas/annual/prepare',shopId,{plan});
  setOrderId(prepared.id);setOrderState(prepared.state);
  if(prepared.state!=='preparing')throw new Error('PEDIDO_EM_ANALISE');
  return prepared;
 }

 async function purchasePix(){
  if(busy||!pixEnabled||!formOk||(orderId!==null&&orderState!=='preparing'))return;
  setBusy(true);setError('');setNotice('');
  let submitted=false;
  try{
   const prepared=await prepare();
   submitted=true;setOrderState('submitting');
   const result=await api<AnnualStatus>('/saas/annual/pix',shopId,{
    orderId:prepared.id,document:document.replace(/\D/g,''),phone:phone.replace(/\D/g,''),acceptedTerms:true
   });
   setOrderState(result.state);
   if(result.pixCode)setPixCode(result.pixCode);
   setNotice('Pix gerado. Pague no app do banco; o plano é liberado sozinho assim que o pagamento for confirmado.');
  }catch(e){
   if(e instanceof RequestError&&e.code==='ANNUAL_PROVIDER_REJECTED'){setOrderId(null);setOrderState('none');setError(e.message);}
   else if(submitted){setOrderState('submitting');setError('Não foi possível confirmar se o Pix foi gerado. NÃO gere outro; toque em Verificar pagamento ou procure o suporte.'+(e instanceof RequestError?` (código: ${e.code})`:''));}
   else setError(failure(e));
  }finally{setBusy(false);}
 }

 async function purchaseCard(){
  if(busy||!canCard||!formOk||(orderId!==null&&orderState!=='preparing'))return;
  setBusy(true);setError('');setNotice('');
  let submitted=false;
  try{
   const prepared=await prepare();
   const sealed=await tokenizeAnnualCard(key,{number,holder_name:holder,expiry_month:month,expiry_year:year,cvv});
   // Erase PAN/CVV as soon as SyncPay returns the one-time token.
   setNumber('');setCvv('');
   submitted=true;setOrderState('submitting');
   const result=await api<AnnualStatus>('/saas/annual/card',shopId,{
    orderId:prepared.id,installments:1,cardToken:sealed.token,
    ...(sealed.brand?{cardBrand:sealed.brand}:{}),
    ...(sealed.last4?{cardLast4:sealed.last4}:{}),
    document:document.replace(/\D/g,''),phone:phone.replace(/\D/g,''),acceptedTerms:true
   });
   setOrderState(result.state);
   if(result.state==='paid'){await onPaid();return;}
   setNotice('Cobrança enviada. Aguardando aprovação da SyncPay. A verificação automática está ativa.');
  }catch(e){
   if(e instanceof RequestError&&e.code==='ANNUAL_PROVIDER_REJECTED'){setOrderId(null);setOrderState('none');setError(e.message);}
   else if(submitted){setOrderState('submitting');setError('Não foi possível confirmar a resposta. A cobrança pode ter sido enviada. NÃO tente pagar novamente; verifique o pedido ou procure suporte.');}
   else setError(failure(e));
  }finally{setNumber('');setCvv('');setBusy(false);}
 }

 async function copyPix(){
  try{await navigator.clipboard.writeText(pixCode);setNotice('Código Pix copiado. Cole no app do banco em "Pix Copia e Cola".');}
  catch{setError('Não foi possível copiar. Selecione o código e copie manualmente.');}
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
      if(s.pixCode)setPixCode(s.pixCode);
      if(s.paid===true||s.state==='paid')void onPaid();})
    .catch(()=>{ /* Permanece pendente; nao inicia outra cobranca */ })
    .finally(()=>{checking=false;});
  },pixCode?12000:20000);
  return()=>{active=false;window.clearInterval(timer);};
 },[orderId,orderState,shopId,onPaid,pixCode]);

 const blocked=Boolean(orderId)&&!['none','preparing'].includes(orderState);
 const showPix=blocked&&orderState==='review'&&Boolean(pixCode);
 return <section className="fio-payflow fio-payflow-review" aria-label="Compra do plano anual">
  <header className="fio-payflow-titlebar"><div>
   <button className="fio-payflow-back" type="button" onClick={onBack} aria-label="Voltar aos planos"><ArrowLeft size={18}/></button>
   <div><h1>Comprar plano anual</h1><span>{planName} · 365 dias</span></div>
  </div></header>
  <div className="fio-payflow-review-card"><div><span>Plano</span><strong>{planName}</strong></div>
   <div><span>Pagamento único</span><strong>{cents(priceCents)} à vista</strong></div>
   <div><span>Renovação automática</span><strong>Não</strong></div></div>

  {showPix?<div className="fio-payflow-pix">
   <div className="fio-payflow-qr"><QRCodeSVG value={pixCode} size={220} level="M" includeMargin aria-label="QR Code Pix do plano anual"/></div>
   <ol className="fio-payflow-steps">
    <li>Abra o app do seu banco e escolha pagar com Pix.</li>
    <li>Leia o QR Code ou use "Pix Copia e Cola" com o código abaixo.</li>
    <li>Confira o valor de {cents(priceCents)} antes de confirmar.</li>
    <li>Pronto. O plano é liberado assim que a SyncPay confirmar o pagamento.</li>
   </ol>
   <label className="fio-payflow-field"><span>Pix Copia e Cola</span><input readOnly value={pixCode} onFocus={e=>e.currentTarget.select()}/></label>
   <button type="button" className="fio-payflow-secondary" onClick={()=>void copyPix()}><Copy size={16}/> Copiar código Pix</button>
  </div>:null}

  {!blocked&&ready&&(pixEnabled||canCard)?<div className="fio-payflow-methods" role="radiogroup" aria-label="Forma de pagamento">
   {pixEnabled&&<button type="button" role="radio" aria-checked={method==='pix'} className={method==='pix'?'active':''} onClick={()=>setMethod('pix')}>
    <QrCode size={20}/><span><strong>Pix à vista</strong><small>Paga na hora pelo app do banco</small></span></button>}
   {canCard&&<button type="button" role="radio" aria-checked={method==='card'} className={method==='card'?'active':''} onClick={()=>setMethod('card')}>
    <CreditCard size={20}/><span><strong>Cartão de crédito</strong><small>Pagamento único em 1x</small></span></button>}
  </div>:null}

  {!blocked&&<div className="fio-payflow-note"><ShieldCheck size={18}/><span>{method==='pix'
   ?'O Pix é gerado pela SyncPay. O acesso só é liberado após a confirmação do pagamento.'
   :'Os dados do cartão vão direto do seu aparelho para a SyncPay. O FIO não recebe nem guarda o número nem o CVV.'}</span></div>}
  {!ready?<div className="fio-payflow-note">Conferindo disponibilidade...</div>:
   !pixEnabled&&!canCard?<div className="fio-payflow-note" role="status">O plano anual ainda não está liberado para pagamento. Nenhuma cobrança pode ser iniciada.</div>:null}
  {blocked&&!showPix?<div className="fio-payflow-note" role="status">Já existe um pedido anual em andamento. Para evitar cobrança em dobro, não é possível iniciar outro pagamento.</div>:null}
  {!blocked&&(pixEnabled||canCard)?<div>
   <label className="fio-payflow-field"><span>CPF ou CNPJ do pagador</span><input inputMode="numeric" value={document} onChange={e=>setDocument(e.target.value.replace(/\D/g,'').slice(0,14))} autoComplete="off"/></label>
   <label className="fio-payflow-field"><span>Telefone com DDD do pagador</span><input type="tel" autoComplete="tel" inputMode="tel" placeholder="(61) 99999-9999" value={phone} maxLength={20} onChange={e=>setPhone(e.target.value.replace(/[^0-9()+\s-]/g,'').slice(0,20))}/><small>A SyncPay pede CPF e telefone para registrar o pagamento.</small></label>
   {method==='card'&&<>
    <label className="fio-payflow-field"><span>Nome no cartão</span><input autoComplete="cc-name" value={holder} onChange={e=>setHolder(e.target.value.slice(0,80))}/></label>
    <label className="fio-payflow-field"><span>Número do cartão</span><input inputMode="numeric" autoComplete="cc-number" value={number} onChange={e=>setNumber(e.target.value.replace(/\D/g,'').slice(0,19))}/></label>
    <div className="fio-payflow-review-card">
     <label className="fio-payflow-field"><span>Mês (MM)</span><input value={month} autoComplete="cc-exp-month" inputMode="numeric" maxLength={2} onChange={e=>setMonth(e.target.value.replace(/\D/g,'').slice(0,2))}/></label>
     <label className="fio-payflow-field"><span>Ano (AAAA)</span><input value={year} autoComplete="cc-exp-year" inputMode="numeric" maxLength={4} onChange={e=>setYear(e.target.value.replace(/\D/g,'').slice(0,4))}/></label>
     <label className="fio-payflow-field"><span>CVV</span><input type="password" autoComplete="cc-csc" value={cvv} inputMode="numeric" maxLength={4} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,4))}/></label>
    </div>
   </>}
   <label className="fio-payflow-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Autorizo uma compra única de {cents(priceCents)}, sem renovação automática. Li os <a target="_blank" rel="noreferrer" href="/termos">Termos</a>, a <a target="_blank" rel="noreferrer" href="/privacidade">Privacidade</a> e a <a target="_blank" rel="noreferrer" href="/cancelamento-e-reembolso">política de reembolso</a>.</span></label>
  </div>:null}
  {notice&&<div className="fio-payflow-note" role="status">{notice}</div>}
  {error&&<div className="fio-payflow-error" role="alert">{error}</div>}
  <div className="fio-payflow-bottom-action">
   {blocked?<button className="fio-payflow-primary" disabled={busy} type="button" onClick={()=>void verify()}><RefreshCw size={16}/> {busy?'Consultando...':'Verificar pagamento'}</button>
    :<button className="fio-payflow-primary" type="button" disabled={!ready||!canPay||busy||!formOk}
     onClick={()=>void (method==='pix'?purchasePix():purchaseCard())}>
     {method==='pix'?<QrCode size={16}/>:<CreditCard size={16}/>} {busy?'Preparando...':method==='pix'?'Gerar Pix':'Pagar com cartão'} →</button>}
  </div>
 </section>;
}
