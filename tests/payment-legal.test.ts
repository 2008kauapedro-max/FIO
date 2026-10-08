import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REFUND_POLICY,PAYMENT_CONDITIONS,PIX_AUTOMATICO_GUIDE,CARD_GUIDE,CUSTOMER_RIGHTS } from '../shared/payment-legal';

const documents=[REFUND_POLICY,PAYMENT_CONDITIONS,PIX_AUTOMATICO_GUIDE,CARD_GUIDE,CUSTOMER_RIGHTS];

const source=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

describe('FIO: informações contratuais de pagamento',()=>{
 it('possui documentos acessíveis, completos e com contato',()=>{
  for(const document of documents){
   expect(document.title.length).toBeGreaterThan(12);
   expect(document.updated).toMatch(/2026/);
   expect(document.sections.length).toBeGreaterThanOrEqual(5);
   expect(document.contactEmail).toMatch(/@/);
   for(const section of document.sections)
    expect(Boolean(section.paragraphs?.length||section.bullets?.length)).toBe(true);
  }
 });

 it('não anuncia QR Code como Pix Automático nem garante devolução imediata',()=>{
  const automatic=PIX_AUTOMATICO_GUIDE.intro.join(' ');
  expect(automatic).toContain('não é Pix Automático');
  const refund=JSON.stringify(REFUND_POLICY);
  expect(refund).toContain('Não prometemos que a devolução seja instantânea');
 });

 it('prevê direitos depois dos sete dias e separa cancelamento de reembolso',()=>{
  const policy=JSON.stringify(REFUND_POLICY);
  expect(policy).toContain('Após o prazo inicial');
  expect(policy).toContain('Diferença entre cancelamento e reembolso');
  expect(policy).toContain('cobrança');
 });

 it('expõe páginas públicas na aplicação e nas regras da Vercel',()=>{
  const app=source('src/App.tsx');
  const routes=JSON.parse(source('vercel.json')) as {rewrites:{source:string;destination:string}[]};
  const paths=['/direitos-do-cliente','/cancelamento-e-reembolso','/condicoes-de-pagamento','/pix-automatico','/cartao-e-parcelamento'];
  for(const route of paths){
   expect(app).toContain(`location.pathname==='${route}'`);
   expect(routes.rewrites.some(r=>r.source===route&&r.destination==='/index.html')).toBe(true);
  }
 });

 it('consulta reembolso automaticamente a partir do estado de cobrança do servidor',()=>{
  const page=source('src/pages/FioPlans.tsx');
  expect(page).toContain("billing.refund?.eligible===true");
  expect(page).toContain('Ler termos do reembolso');
  expect(page).toContain('Solicitar análise ao suporte');
 });
});
