import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import type {Session} from '@supabase/supabase-js';
import {api} from '../lib/api';
import './platform.css';

type Result={status:string;createHttp?:number|null;archiveHttp?:number|null};
type AnnualProbeResult={status:string;authHttp:number|null;checks:{method:string;path:string;http:number|null;meaning:string}[];note:string};
const descriptions:Record<string,string>={
 capability_confirmed:'A SyncPay aceitou criar e arquivar o plano temporario. A autorizacao bancaria real ainda precisa ser validada antes de habilitar Pix Automatico.',
 permission_not_confirmed:'A SyncPay nao confirmou a permissao de Pix Automatico. Mantenha essa modalidade desativada.',
 auth_unavailable:'A SyncPay recusou a autenticacao do servidor. Nenhuma modalidade foi habilitada.',
 not_configured:'As credenciais da SyncPay nao foram encontradas no servidor.',
 provider_error:'A SyncPay nao confirmou a operacao. O Pix Automatico permanece desativado.',
 network_error:'Falha ao comunicar com a SyncPay. Nao e possivel confirmar a permissao.',
 create_response_invalid:'Resposta inesperada na criacao. Confira planos temporarios no painel da SyncPay.',
 archive_not_confirmed:'O arquivamento do plano temporario nao foi confirmado. Confira o painel da SyncPay antes de continuar.'
};
export function PlatformPixDiagnostic({session,ready}:{session:Session|null;ready:boolean}){
 const [allowed,setAllowed]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false);
 const [tried,setTried]=useState(false);
 const [message,setMessage]=useState('');
 const [annualBusy,setAnnualBusy]=useState(false);
 const [annualTried,setAnnualTried]=useState(false);
 const [annualMessage,setAnnualMessage]=useState('');
 useEffect(()=>{
  if(!ready)return;
  if(!session){setAllowed(false);return;}
  let active=true;
  api('/platform/me').then(()=>{if(active)setAllowed(true);}).catch(()=>{if(active)setAllowed(false);});
  return()=>{active=false;};
 },[ready,session?.access_token]);
 async function run(){
  if(busy||tried||!allowed)return;
  if(!window.confirm('A SyncPay recebera a criacao de um plano temporario de teste, seguido de arquivamento. Nao havera assinante nem pagamento. Confirmar?'))return;
  setBusy(true);setTried(true);setMessage('Aguardando a resposta da SyncPay...');
  try{
   const value=await api<Result>('/platform/pix-auto-probe',undefined,{confirmed:true});
   setMessage((descriptions[value.status]??'Diagnostico inconclusivo.')+' Codigo: '+value.status+'.'+(value.createHttp?' Criacao HTTP '+value.createHttp+'.':'')+(value.archiveHttp?' Arquivamento HTTP '+value.archiveHttp+'.':''));
  }catch(error){
   setMessage(error instanceof Error?error.message:'Falha ao consultar. O Pix Automatico continua desativado.');
  }finally{setBusy(false);}
 }
 async function runAnnual(){
  if(annualBusy||annualTried||!allowed)return;
  if(!window.confirm('O FIO vai consultar a SyncPay usando apenas autenticacao, GET e OPTIONS. Nao havera cobranças, pedidos ou alteracoes. Continuar?'))return;
  setAnnualBusy(true);setAnnualTried(true);setAnnualMessage('Consultando rotas sem criar cobrancas...');
  try{
   const value=await api<AnnualProbeResult>('/platform/syncpay-annual-readonly-diagnostic',undefined,{confirmed:true});
   const rows=value.checks.map(item=>item.method+' '+item.path+' -> '+(item.http??'falha de conexao')+' ('+item.meaning+')');
   setAnnualMessage(['Resultado: '+value.status,'Autenticacao HTTP: '+(value.authHttp??'indisponivel'),...rows,value.note].join('\n'));
  }catch(error){
   setAnnualMessage(error instanceof Error?error.message:'Nao foi possivel executar o diagnostico.');
  }finally{setAnnualBusy(false);}
 }
 return <main className="pf-shell" style={{display:'block',minHeight:'100dvh',padding:'clamp(24px,5vw,72px)'}}>
  <div style={{maxWidth:680,margin:'0 auto'}}>
   <Link to="/platform" style={{display:'inline-block',marginBottom:24,textDecoration:'underline'}}>Voltar ao painel da plataforma</Link>
   <header className="pf-heading"><div><h1>Diagnostico do Pix Automatico</h1><p>Verificacao tecnica restrita ao administrador da plataforma FIO.</p></div></header>
   <section className="pf-panel" style={{padding:24}}>
    {!ready||allowed===null?<p role="status">Verificando acesso administrativo...</p>
    :!allowed?<><p role="alert">Entre com a conta de administracao da plataforma para executar este teste. A conta de uma barbearia e diferente.</p><Link to="/acesso/plataforma" style={{textDecoration:'underline'}}>Ir ao login da plataforma</Link></>
    :<>
      <p>O teste cria e arquiva um plano temporario na SyncPay. Nao cria assinante, nao gera cobranca e nao habilita o Pix Automatico.</p>
      <p>Execute apenas uma vez. O servidor limita novas tentativas por 24 horas.</p>
      <button className="primary" type="button" disabled={busy||tried} onClick={()=>void run()}>{busy?'Consultando a SyncPay...':'Verificar permissao'}</button>
      {message&&<p role="status" style={{marginTop:20,overflowWrap:'anywhere'}}>{message}</p>}
    </>}
   </section>
   <section className="pf-panel" style={{padding:24,marginTop:24}}>
    <h2>Diagnostico do checkout anual SyncPay</h2>
    <p>Somente leitura: o FIO consulta autenticacao e rotas GET/OPTIONS, sem gerar pedido, assinatura ou cobranca. Os retornos mostram apenas codigos HTTP. O status nao prova que o endpoint POST de checkout exista.</p>
    {allowed===true
     ?<button className="primary" type="button" disabled={annualBusy||annualTried} onClick={()=>void runAnnual()}>{annualBusy?'Consultando...':'Verificar API anual sem cobranca'}</button>
     :<p>Disponivel somente para administradores da plataforma.</p>}
    {annualMessage&&<pre role="status" style={{marginTop:18,whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:13}}>{annualMessage}</pre>}
   </section>
  </div>
 </main>;
}