import { Link } from 'react-router-dom';
import {
 PRIVACY_POLICY,
 TERMS_OF_USE,
 type LegalDocument
} from '../../shared/legal';

function LegalDocumentView({doc}:{doc:LegalDocument}){
 return <div className="legal-page">
  <header className="legal-header">
   <Link className="legal-logo" to="/login">
    <img src="/FIOlogo+nome/Branco.png" alt="FIO"/>
   </Link>
   <Link className="legal-back" to="/login">Entrar no FIO</Link>
  </header>

  <main className="legal-content">
   <p className="eyebrow">FIO / DOCUMENTO PÚBLICO</p>
   <h1>{doc.title}</h1>
   <p className="legal-updated">Última atualização: {doc.updated}</p>

   <div className="legal-intro">
    {doc.intro.map((text,index)=><p key={index}>{text}</p>)}
   </div>

   {doc.sections.map(section=><section key={section.title}>
    <h2>{section.title}</h2>

    {section.paragraphs?.map((text,index)=>
     <p key={'p-'+index}>{text}</p>
    )}

    {section.bullets?.length?<ul>
     {section.bullets.map((text,index)=>
      <li key={'b-'+index}>{text}</li>
     )}
    </ul>:null}
   </section>)}

   <div className="legal-contact">
    <strong>Contato</strong>
    <a href={'mailto:'+doc.contactEmail}>{doc.contactEmail}</a>
   </div>
  </main>
 </div>;
}

export function LegalPage({kind}:{kind:'privacy'|'terms'}){
 return <LegalDocumentView
  doc={kind==='privacy'?PRIVACY_POLICY:TERMS_OF_USE}
 />;
}
