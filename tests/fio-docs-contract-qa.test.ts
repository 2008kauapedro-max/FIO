import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {annualVerifiedBuyerIp} from '../server/fio-annual-credit-card';
import {ApiError} from '../server/errors';
describe('Contrato documentado SyncPay: QA sem cobranca',()=>{
 it('anual nao envia IP privado, loopback ou malformado para antifraude',()=>{
  expect(annualVerifiedBuyerIp('8.8.8.8')).toBe('8.8.8.8');
  for(const ip of ['127.0.0.1','192.168.0.1','10.0.0.1','999.999.999.999','::1','']){
   expect(()=>annualVerifiedBuyerIp(ip)).toThrow(ApiError);
  }
 });
 it('checkout anual usa callback da transacao e nao libera por POST do webhook',()=>{
  const s=readFileSync('server/fio-annual-credit-card.ts','utf8');
  expect(s).toContain("webhook_url:'https://usefio.vercel.app/api/webhooks/syncpay-annual'");
  expect(s).toContain("normalizeAnnualCardProof(external");
  expect(s).toContain("if(proof.state!=='completed')");
 });
 it('troca de plano nao chama recurso nao suportado no Pix Automatico nem cartao',()=>{
  const s=readFileSync('server/syncpay.ts','utf8');
  const guard=s.indexOf('SYNCPAY_CHANGE_UNSUPPORTED_METHOD');
  const mutation=s.indexOf('const target=await ensureProviderPlan(db,input.plan,input.cycle,fetcher)',guard);
  expect(guard).toBeGreaterThan(0);
  expect(mutation).toBeGreaterThan(guard);
  expect(s.slice(guard-350,guard)).toContain("existingMethod.data?.billing_method!=='qr_code'");
 });
});
