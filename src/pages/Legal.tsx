import { Link } from 'react-router-dom';
import { ChevronLeft,FileText,ShieldCheck } from 'lucide-react';
import { PRIVACY_POLICY,TERMS_OF_USE,type LegalDocument } from '../../shared/legal';
import {
 REFUND_POLICY,PAYMENT_CONDITIONS,PIX_AUTOMATICO_GUIDE,CARD_GUIDE,CUSTOMER_RIGHTS
} from '../../shared/payment-legal';
import './legal-payments.css';

export type LegalKind='privacy'|'terms'|'refunds'|'payments'|'pix-automatico'|'cartao'|'rights';

const DOCUMENTS:Record<LegalKind,{doc:LegalDocument;path:string;label:string}>={
 terms:{doc:TERMS_OF_USE,path:'/termos',label:'Termos de Uso'},
 privacy:{doc:PRIVACY_POLICY,path:'/privacidade',label:'Privacidade'},
 refunds:{doc:REFUND_POLICY,path:'/cancelamento-e-reembolso',label:'Cancelamento e reembolso'},
 payments:{doc:PAYMENT_CONDITIONS,path:'/condicoes-de-pagamento',label:'Condições de pagamento'},
 'pix-automatico':{doc:PIX_AUTOMATICO_GUIDE,path:'/pix-automatico',label:'Pix Automático'},
 cartao:{doc:CARD_GUIDE,path:'/cartao-e-parcelamento',label:'Cartão e parcelamento'},
 rights:{doc:CUSTOMER_RIGHTS,path:'/direitos-do-cliente',label:'Seus direitos'}
};

function LegalDocumentView({kind}:{kind:LegalKind}){
 const current=DOCUMENTS[kind];
 const doc=current.doc;
 return <div className="legal-page fio-legal-page">
  <header className="legal-header fio-legal-header">
   <Link className="legal-logo" to="/login" aria-label="Voltar para o FIO">
    <img src="/FIOlogo+nome/Branco.png" alt="FIO"/>
   </Link>
   <Link className="legal-back" to="/login"><ChevronLeft size={16}/> Entrar no FIO</Link>
  </header>

  <div className="fio-legal-layout">
   <aside className="fio-legal-sidebar" aria-label="Documentos do FIO">
    <div className="fio-legal-sidebar-title"><FileText size={17}/> Documentação do FIO</div>
    <nav className="fio-legal-doc-links">
     {(Object.keys(DOCUMENTS) as LegalKind[]).map(key=>
      <Link key={key} to={DOCUMENTS[key].path} aria-current={kind===key?'page':undefined}
       className={kind===key?'is-current':''}>{DOCUMENTS[key].label}</Link>
     )}
    </nav>
    <p>Documentos públicos de contratação, pagamentos, direitos e dados pessoais.</p>
   </aside>

   <main className="legal-content fio-legal-content" id="conteudo">
    <p className="eyebrow">FIO / DOCUMENTAÇÃO PÚBLICA</p>
    <h1>{doc.title}</h1>
    <p className="legal-updated">Última atualização: {doc.updated}</p>
    <div className="legal-intro">{doc.intro.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div>
    <div className="fio-legal-micro">
     <ShieldCheck size={17}/>
     <span>Os termos precisam corresponder às funcionalidades realmente disponíveis. Direitos legais continuam válidos independentemente de disposições contratuais.</span>
    </div>

    <nav className="fio-legal-toc" aria-label="Nesta página">
     <strong>Nesta página</strong>
     <ol>{doc.sections.map((section,index)=><li key={index}>
      <a href={'#secao-'+(index+1)}>{section.title}</a>
     </li>)}</ol>
    </nav>

    {doc.sections.map((section,index)=><section key={section.title} id={'secao-'+(index+1)} className="fio-legal-section">
     <h2>{section.title}</h2>
     {section.paragraphs?.map((paragraph,i)=><p key={'p-'+i}>{paragraph}</p>)}
     {section.bullets?.length?<ul>{section.bullets.map((item,i)=><li key={'b-'+i}>{item}</li>)}</ul>:null}
    </section>)}

    <section className="legal-contact fio-legal-contact">
     <strong>Precisa de ajuda ou quer esclarecer alguma condição?</strong>
     <p>Entre em contato com o suporte do FIO. Não envie senhas, CVV ou dados bancários sigilosos.</p>
     <a className="fio-legal-text-link" href={'mailto:'+doc.contactEmail}>{doc.contactEmail}</a>
    </section>

    <nav className="fio-legal-related" aria-label="Outros documentos">
     <strong>Consulte também</strong>
     <div>{(Object.keys(DOCUMENTS) as LegalKind[]).filter(key=>key!==kind).map(key=>
      <Link key={key} to={DOCUMENTS[key].path}>{DOCUMENTS[key].label}</Link>
     )}</div>
    </nav>
    <div className="fio-legal-end">FIO · Informação clara para contratar com segurança.</div>
   </main>
  </div>
 </div>;
}

export function LegalPage({kind}:{kind:LegalKind}){
 return <LegalDocumentView kind={kind}/>;
}
