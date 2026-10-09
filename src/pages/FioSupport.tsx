import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowRight,CheckCircle2,ChevronDown,CircleHelp,CreditCard,FileText,LifeBuoy,MessageSquareText,RefreshCw,Search,Send,ShieldCheck} from 'lucide-react';
import {api} from '../lib/api';
import type {WorkspaceProps} from './Workspace';
import './FioSupport.css';

type Topic='question'|'problem'|'feedback';
type View='home'|'message'|'refund';
type RefundStatus='eligible'|'expired'|'no_subscription'|'not_paid'|'already_requested'|'manual_review';
type RefundPolicy={
 status:RefundStatus;
 eligible:boolean;
 amountCents:number|null;
 currency:string|null;
 paidAt:string|null;
 deadline:string|null;
};
type RefundResult={
 status:'not_available'|'refund_requested'|'cancel_requires_attention';
 refundStatus?:string;
 subscriptionCanceled?:boolean;
 message?:string;
 policy:RefundPolicy;
};

const articles=[
 {title:'Como funciona o agendamento?',text:'Os clientes entram pelo app ou minissite da barbearia, escolhem um serviço, profissional e horário disponível. O agendamento é confirmado no FIO.'},
 {title:'Como instalar o aplicativo da barbearia?',text:'Abra o minissite da barbearia pelo navegador do celular e use a opção de instalar ou adicionar à tela inicial, quando disponível.'},
 {title:'Como gerenciar minha assinatura FIO?',text:'Acesse Plano FIO. Se sua assinatura foi feita com cartão, a opção de gerenciar pagamento e cancelamento abre o portal seguro da Stripe.'},
 {title:'Cancelar uma assinatura gera reembolso?',text:'Cancelar impede renovações futuras, conforme o estado da assinatura. Para pedir devolução de um pagamento inicial, use a opção Reembolso nesta central. O prazo padrão de solicitação é de sete dias após o primeiro pagamento, sem prejuízo de outros direitos legais.'},
 {title:'O pagamento do cartão é seguro?',text:'O cartão é informado na página protegida da Stripe. Não envie número do cartão, senha ou códigos de acesso ao suporte.'},
 {title:'Como enviar uma sugestão ou relatar um erro?',text:'Clique em Enviar mensagem nesta central, escolha o assunto e conte o que aconteceu. O pedido vai para o suporte do FIO.'},
];

function displayAmount(cents:number|null,currency:string|null){
 if(cents==null||!currency)return '';
 try{
  const formatter=new Intl.NumberFormat('pt-BR',{style:'currency',currency:currency.toUpperCase()});
  const digits=formatter.resolvedOptions().maximumFractionDigits??2;
  return formatter.format(cents/(10**digits));
 }catch{return `${cents} ${currency.toUpperCase()}`;}
}

export function FioSupport(p:WorkspaceProps){
 const owner=p.data.membership.role==='OWNER';
 const [view,setView]=useState<View>('home');
 useEffect(()=>{
  const onTourTarget=(event:Event)=>{
   const target=(event as CustomEvent<{target?:string}>).detail?.target;
   if(target==='support-page'||target==='feedback')setView('home');
   if(target==='feedback-message'||target==='feedback-send')setView('message');
  };
  window.addEventListener('fio-tour-target',onTourTarget);
  return()=>window.removeEventListener('fio-tour-target',onTourTarget);
 },[]);
 const [query,setQuery]=useState('');
 const [opened,setOpened]=useState<number|null>(null);
 const [topic,setTopic]=useState<Topic>('question');
 const [message,setMessage]=useState('');
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [sent,setSent]=useState(false);
 const [policy,setPolicy]=useState<RefundPolicy|null>(null);
 const [checking,setChecking]=useState(false);
 const [refunding,setRefunding]=useState(false);
 const [refundNotice,setRefundNotice]=useState('');
 const filtered=useMemo(()=>articles.filter(item=>
  `${item.title} ${item.text}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR').trim())
 ),[query]);

 useEffect(()=>{
  if(view!=='refund'||!owner||p.demo)return;
  let active=true;
  setChecking(true);setError('');
  void api<RefundPolicy>('/saas/stripe/refund-policy',p.data.shop.id)
   .then(value=>{if(active)setPolicy(value);})
   .catch(()=>{if(active)setError('Não foi possível consultar sua assinatura agora. Tente novamente.');})
   .finally(()=>{if(active)setChecking(false);});
  return()=>{active=false;};
 },[view,owner,p.demo,p.data.shop.id]);

 function go(next:View){
  setError('');setSent(false);setRefundNotice('');setView(next);
 }

 async function sendMessage(event:FormEvent){
  event.preventDefault();
  if(p.demo||sending||message.trim().length<3)return;
  setSending(true);setError('');
  try{
   await api('/support/feedback',p.data.shop.id,{category:topic,message:message.trim()});
   setMessage('');setSent(true);
   p.notify('Mensagem enviada para o suporte do FIO.');
  }catch{
   setError('Não foi possível enviar. Tente novamente em instantes.');
  }finally{setSending(false);}
 }

 async function requestManualRefund(){
  if(p.demo||sending||message.trim().length<3)return;
  setSending(true);setError('');
  try{
   await api('/support/feedback',p.data.shop.id,{
    category:'question',message:`[REEMBOLSO_STRIPE_REVISAO_MANUAL] ${message.trim()}`
   });
   setMessage('');setSent(true);
   setRefundNotice('Solicitação enviada ao suporte para análise. Nenhum estorno foi realizado automaticamente.');
   p.notify('Seu pedido foi enviado para análise.');
  }catch{setError('Não foi possível enviar seu pedido. Tente novamente.');}
  finally{setSending(false);}
 }

 async function refundFirstPayment(){
  if(p.demo||!owner||refunding||!policy?.eligible)return;
  if(!window.confirm('Confirmar reembolso integral do primeiro pagamento e cancelamento imediato da assinatura Stripe?'))return;
  setRefunding(true);setError('');setRefundNotice('');
  try{
   const response=await api<RefundResult>('/saas/stripe/refund',p.data.shop.id,{confirmed:true});
   setPolicy(response.policy);
   if(response.status==='not_available'){
    setError('Esta cobrança precisa de revisão pelo suporte. Você pode enviar uma solicitação abaixo.');
   }else{
    setRefundNotice(response.message??'Pedido processado na Stripe.');
    await p.refresh();
   }
  }catch{
   setError('A Stripe não confirmou a operação. Confira o status antes de tentar novamente e avise o suporte caso necessário.');
  }finally{setRefunding(false);}
 }

 const back=<button type="button" className="fio-help-back" onClick={()=>go('home')}><ArrowLeft size={17}/> Voltar para ajuda</button>;

 return <div className="fio-help" data-testid="fio-help">
  <header className="fio-help-header">
   <div className="fio-help-overline"><LifeBuoy size={15}/> CENTRAL DE AJUDA</div>
   <h1>{view==='home'?'Como podemos ajudar?':view==='message'?'Fale com o FIO':'Cancelamento e reembolso'}</h1>
   <p>{view==='home'?'Encontre uma resposta ou fale com nossa equipe.':view==='message'?'Escolha um assunto e explique com suas palavras.':'Consulte o primeiro pagamento e as opções da sua assinatura Stripe.'}</p>
  </header>

  {view==='home'&&<>
   <label className="fio-help-search"><Search size={18} aria-hidden="true"/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar ajuda..." aria-label="Buscar na central de ajuda"/></label>
   <section className="fio-help-card" aria-label="Respostas rápidas">
    <div className="fio-help-card-heading"><h2>Dúvidas frequentes</h2><span>{filtered.length} artigos</span></div>
    <div className="fio-help-faq">
     {filtered.length===0?<p className="fio-help-muted">Nenhum artigo encontrado. Envie sua pergunta ao suporte.</p>:filtered.map(item=>{
      const index=articles.indexOf(item);
      return <div className="fio-help-item" key={item.title}>
       <button type="button" aria-expanded={opened===index} onClick={()=>setOpened(opened===index?null:index)}><span>{item.title}</span><ChevronDown size={17}/></button>
       {opened===index&&<p>{item.text}</p>}
      </div>;
     })}
    </div>
   </section>

   <section className="fio-help-actions" aria-label="Entrar em contato">
    <div><MessageSquareText size={21}/><div><h2>Não encontrou sua resposta?</h2><p>Problemas, dúvidas e sugestões em um único formulário.</p></div></div>
    <button data-tour="feedback" type="button" className="fio-help-primary" onClick={()=>go('message')}>Enviar mensagem <ArrowRight size={17}/></button>
   </section>
   {owner&&<section className="fio-help-billing"><CreditCard size={20}/><div><h2>Pagamentos e reembolso</h2><p>Veja a regra dos 7 dias, cancele renovações e consulte sua cobrança Stripe.</p></div><button type="button" onClick={()=>go('refund')}>Ver opções <ArrowRight size={16}/></button></section>}
   <div className="fio-help-links"><Link to="/termos"><FileText size={15}/> Termos de uso</Link><Link to="/privacidade"><ShieldCheck size={15}/> Privacidade</Link><button type="button" onClick={()=>window.dispatchEvent(new Event('fio-tour-restart'))}><CircleHelp size={15}/> Rever tutorial</button></div>
  </>}

  {view==='message'&&<>
   {back}
   <section className="fio-help-card fio-help-form-card">
    {sent?<div className="fio-help-success" role="status"><CheckCircle2 size={30}/><h2>Mensagem enviada!</h2><p>Recebemos sua solicitação. A equipe do FIO poderá consultar o relato.</p><button className="fio-help-secondary" type="button" onClick={()=>go('home')}>Voltar à central</button></div>:
    <form onSubmit={sendMessage}>
     <label>Assunto<select value={topic} onChange={event=>setTopic(event.target.value as Topic)}><option value="question">Dúvida</option><option value="problem">Reportar problema</option><option value="feedback">Feedback ou sugestão</option></select></label>
     <label>Mensagem<textarea data-tour="feedback-message" value={message} onChange={event=>setMessage(event.target.value)} minLength={3} maxLength={1500} required rows={6} placeholder="Conte como podemos ajudar..."/></label>
     <div className="fio-help-form-footer"><span>{message.length}/1500</span><button data-tour="feedback-send" className="fio-help-primary" type="submit" disabled={p.demo||sending||message.trim().length<3}><Send size={16}/>{sending?'Enviando...':'Enviar solicitação'}</button></div>
     {error&&<p className="fio-help-error" role="alert">{error}</p>}
    </form>}
   </section>
  </>}

  {view==='refund'&&owner&&<>
   {back}
   <section className="fio-help-card fio-help-refund">
    <div className="fio-help-refund-title"><CreditCard size={21}/><div><h2>Reembolso em até 7 dias</h2><p>Na primeira contratação online, o FIO permite solicitar a devolução integral do primeiro pagamento dentro da janela de 7 dias, quando aplicável. Outros direitos previstos em lei permanecem preservados.</p></div></div>
    {checking?<p className="fio-help-muted"><RefreshCw size={15}/> Consultando sua cobrança Stripe...</p>:policy&&<>
     {policy.status==='eligible'&&<div className="fio-help-refund-state"><strong>Seu pagamento está no prazo.</strong><p>Valor: {displayAmount(policy.amountCents,policy.currency)} · Prazo até {policy.deadline?new Date(policy.deadline).toLocaleDateString('pt-BR'):''}.</p><p>Ao confirmar, o FIO solicita o estorno pela Stripe e cancela a assinatura para evitar renovação.</p><button className="fio-help-primary fio-help-danger" type="button" disabled={p.demo||refunding} onClick={()=>void refundFirstPayment()}>{refunding?'Processando...':'Solicitar reembolso e cancelar'}</button></div>}
     {policy.status==='expired'&&<p className="fio-help-muted">A janela padrão de 7 dias terminou. Você pode cancelar renovações pela Stripe ou enviar um pedido para análise. Isso não elimina outros direitos previstos em lei.</p>}
     {policy.status==='already_requested'&&<p className="fio-help-muted">A Stripe já registra um pedido de reembolso para esse pagamento. Consulte seu extrato e o status do cancelamento.</p>}
     {policy.status==='not_paid'&&<p className="fio-help-muted">Nenhum primeiro pagamento confirmado foi encontrado nessa assinatura.</p>}
     {policy.status==='no_subscription'&&<p className="fio-help-muted">Não encontramos uma assinatura Stripe vinculada a esta barbearia.</p>}
     {policy.status==='manual_review'&&<p className="fio-help-muted">Seu pagamento exige análise da equipe antes de qualquer estorno. Envie sua solicitação abaixo.</p>}
    </>}
    {refundNotice&&<p className="fio-help-message" role="status">{refundNotice}</p>}
    {error&&<p className="fio-help-error" role="alert">{error}</p>}
    <div className="fio-help-refund-links"><Link to={`${p.base}/plano-fio`} className="fio-help-secondary">Gerenciar assinatura e cancelamento na Stripe <ArrowRight size={16}/></Link></div>
   </section>
   <section className="fio-help-card fio-help-manual">
    <h2>Precisa de uma análise?</h2>
    <p>Se o prazo expirou, houve alguma divergência ou a cobrança não apareceu, descreva o caso. O suporte verificará a operação na Stripe.</p>
    {sent?<p className="fio-help-message" role="status">Solicitação enviada para análise.</p>:
     <form onSubmit={event=>{event.preventDefault();void requestManualRefund();}}>
      <label>Detalhes do pedido<textarea value={message} minLength={3} maxLength={1400} required rows={4} placeholder="Informe a data da cobrança e o motivo da solicitação. Não envie dados do cartão." onChange={event=>setMessage(event.target.value)}/></label>
      <button className="fio-help-secondary" type="submit" disabled={p.demo||sending||message.trim().length<3}>{sending?'Enviando...':'Enviar para análise'}<Send size={15}/></button>
     </form>}
   </section>
   <div className="fio-help-safety"><ShieldCheck size={17}/><p>Reembolsos são feitos pela Stripe ao meio de pagamento original. O prazo para aparecer no extrato depende da instituição financeira. Nunca compartilhe dados de cartão com o suporte.</p></div>
  </>}
 </div>;
}
