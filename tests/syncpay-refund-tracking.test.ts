import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {refundStatusDisplay} from '../shared/syncpay-refund-status.js';

describe('FIO - acompanhamento de reembolso SyncPay',()=>{
 it('não trata pedido pendente como dinheiro devolvido',()=>{
  for(const value of ['requested','pending','approved','processing','UNKNOWN'])expect(refundStatusDisplay(value).success).toBe(false);
 });
 it('só marca conclusão após status final positivo',()=>{
  expect(refundStatusDisplay('completed')).toMatchObject({finished:true,success:true});
  expect(refundStatusDisplay('refunded')).toMatchObject({finished:true,success:true});
  expect(refundStatusDisplay('rejected')).toMatchObject({finished:true,success:false});
 });
 it('confere consulta autenticada por protocolo no backend',()=>{
  const sync=readFileSync('server/syncpay.ts','utf8');
  const app=readFileSync('server/app.ts','utf8');
  expect(sync).toContain('export async function getSyncpayRefundTracking');
  expect(sync).toContain("ctx.member.role!=='OWNER'");
  expect(sync).toContain("providerRequest(fetcher,'/refunds/'+encodeURIComponent(existing.data.refund_code))");
  expect(app).toContain("'/api/saas/syncpay/refund-status'");
  expect(app).toContain('requireOwner(c)');
 });
 it('não afirma cancelamento antes de conferência do provedor',()=>{
  const page=readFileSync('src/pages/FioPlans.tsx','utf8');
  expect(page).toContain("result.subscription?.providerStatus==='cancelled'");
  expect(page).toContain('A SyncPay ainda está confirmando o cancelamento');
  expect(page).toContain('refundStatusDisplay(refundTracking.status)');
 });
});
