import {describe,expect,it,afterEach,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {normalizeAnnualCardProof,annualPixLiveEnabled} from '../server/fio-annual-credit-card';
afterEach(()=>vi.unstubAllEnvs());
const order={id:'3df0319d-ecf7-455a-84c4-070aee2779c1',amountCents:143904};
const lookup=(tx:Record<string,unknown>,pix:string|null='00020126820014br.gov.bcb.pix0136teste')=>({data:{
 transaction:{reference_id:order.id,amount:1439.04,status:'pending',currency:'BRL',payment_method:'pix',paid_at:null,...tx},
 payment:{pix:{code:pix},card:null}
}});
describe('anual por Pix à vista',()=>{
 it('fica desligado sem as chaves de ativação',()=>{
  expect(annualPixLiveEnabled()).toBe(false);
  vi.stubEnv('SYNCPAY_CLIENT_ID','x');vi.stubEnv('SYNCPAY_CLIENT_SECRET','y');
  vi.stubEnv('FIO_ENABLE_ANNUAL_PIX','true');
  expect(annualPixLiveEnabled()).toBe(false);
  vi.stubEnv('FIO_ENABLE_ANNUAL_ORDER_DRAFTS','true');
  expect(annualPixLiveEnabled()).toBe(true);
 });
 it('Pix pendente devolve o código para pagar e não libera acesso',()=>{
  const proof=normalizeAnnualCardProof(lookup({}),{...order,methods:['credit_card','pix']});
  expect(proof).toMatchObject({state:'pending',paidAt:null});
  expect(proof.pixCode).toContain('br.gov.bcb.pix');
 });
 it('Pix só é aceito como pago com status completed, valor exato e data de pagamento',()=>{
  const paid=normalizeAnnualCardProof(lookup({status:'completed',paid_at:'2026-11-05T20:00:00Z'}),{...order,methods:['credit_card','pix']});
  expect(paid).toMatchObject({state:'completed',paidAt:'2026-11-05T20:00:00.000Z'});
  expect(()=>normalizeAnnualCardProof(lookup({status:'completed',paid_at:'2026-11-05T20:00:00Z',amount:1.00}),{...order,methods:['pix']})).toThrow();
  expect(()=>normalizeAnnualCardProof(lookup({status:'completed',paid_at:null}),{...order,methods:['pix']})).toThrow();
  expect(()=>normalizeAnnualCardProof(lookup({reference_id:'outro-id-12345'}),{...order,methods:['pix']})).toThrow();
 });
 it('comprovante do cartão continua recusando Pix quando o método não é permitido',()=>{
  expect(()=>normalizeAnnualCardProof(lookup({}),order)).toThrow();
 });
 it('rota exige dono e gera uma única cobrança por pedido',()=>{
  const app=readFileSync('server/app.ts','utf8');
  const start=app.indexOf("app.post('/api/saas/annual/pix'");
  expect(start).toBeGreaterThan(-1);
  expect(app.slice(start,start+200)).toContain('requireOwner(c)');
  const src=readFileSync('server/fio-annual-credit-card.ts','utf8');
  const fn=src.slice(src.indexOf('export async function submitAnnualPix'));
  expect(fn.indexOf("order.state!=='preparing'")).toBeLessThan(fn.indexOf('fio_begin_annual_submission_v1'));
  expect(fn.indexOf('fio_begin_annual_submission_v1')).toBeLessThan(fn.indexOf("'/cash-in'"));
  expect(fn).toContain('fio_bind_annual_transaction_v1');
 });
});
describe('recusa definitiva da SyncPay',()=>{
 it('fecha o pedido sem transacao para permitir nova tentativa, nunca em falha de rede',()=>{
  const src=readFileSync('server/fio-annual-credit-card.ts','utf8');
  expect(src).toContain("'ANNUAL_PROVIDER_REJECTED'");
  expect(src).toContain(".eq('state','submitting').is('provider_transaction_id',null)");
  expect(src).toContain("![408,409,429].includes(r.status)");
  // Falha de rede continua como incerta: nunca reabre o pedido.
  expect(src).toContain("'ANNUAL_UNCERTAIN'");
  expect((src.match(/\.catch\(e=>closeRejectedOrder\(order\.id,e\)\)/g)??[]).length).toBe(2);
 });
});
describe('cancelar Pix anual esquecido',()=>{
 it('so cancela Pix pendente, depois de consultar a SyncPay; se ja pago, libera em vez de cancelar',()=>{
  const src=readFileSync('server/fio-annual-credit-card.ts','utf8');
  const fn=src.slice(src.indexOf('export async function cancelAnnualPix'),src.indexOf('export async function recoverLatePaidPix'));
  expect(fn).toContain("methods:['pix']");
  expect(fn.indexOf("/api/partner/v2/transactions/")).toBeLessThan(fn.indexOf("state:'cancelled'"));
  expect(fn).toContain("if(proof.state==='completed')return checkAnnualCreditCard(ctx,row.id,fetcher);");
  expect(fn).toContain(".eq('state','review')");
 });
 it('Pix cancelado e pago depois e reaberto e liquidado, nunca perdido',()=>{
  const src=readFileSync('server/fio-annual-credit-card.ts','utf8');
  expect(src).toContain("if(row.state==='cancelled'){");
  expect(src).toContain('export async function recoverLatePaidPix');
  const app=readFileSync('server/app.ts','utf8');
  expect(app).toContain('await recoverLatePaidPix(c).catch(()=>undefined);');
  expect(app).toContain("app.post('/api/saas/annual/pix/cancel'");
 });
 it('tela nao bloqueia com pedido encerrado e oferece cancelar o Pix',()=>{
  const ui=readFileSync('src/pages/AnnualCardCheckout.tsx','utf8');
  expect(ui).toContain("const CLOSED=['failed','cancelled','refunded'];");
  expect(ui).toContain('Cancelar este Pix e gerar outro');
 });
});
