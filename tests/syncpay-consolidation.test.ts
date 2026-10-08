import {describe,expect,it,vi,afterEach} from 'vitest';
import {sameSyncpayOffer,syncpayCardConfigured,syncpayLegacyPixCheckoutConfigured} from '../server/syncpay';
import {readFileSync} from 'node:fs';
afterEach(()=>vi.unstubAllEnvs());
describe('FIO checkout consolidado',()=>{
 it('não reaproveita assinatura por modalidade diferente',()=>{
  const old={plan:'PRO',cycle:'monthly',billingMethod:'qr_code'};
  expect(sameSyncpayOffer(old,{plan:'PRO',cycle:'monthly',method:'pix_automatico'})).toBe(false);
  expect(sameSyncpayOffer(old,{plan:'PRO',cycle:'monthly',method:'credit_card'})).toBe(false);
  expect(sameSyncpayOffer(old,{plan:'PRO',cycle:'monthly',method:'qr_code'})).toBe(true);
 });
 it('bloqueia novos QR manuais sem flag expressa',()=>{
  vi.stubEnv('SYNCPAY_CLIENT_ID','fake');vi.stubEnv('SYNCPAY_CLIENT_SECRET','fake');
  expect(syncpayLegacyPixCheckoutConfigured()).toBe(false);
  vi.stubEnv('FIO_ENABLE_LEGACY_PIX_CHECKOUT','true');
  expect(syncpayLegacyPixCheckoutConfigured()).toBe(true);
 });
 it('impede ativar cartão que manipula PAN/CVV sem segundo gate PCI',()=>{
  vi.stubEnv('SYNCPAY_CLIENT_ID','fake');vi.stubEnv('SYNCPAY_CLIENT_SECRET','fake');
  vi.stubEnv('FIO_ENABLE_SYNCPAY_CARD','true');
  expect(syncpayCardConfigured()).toBe(false);
  vi.stubEnv('FIO_CARD_PCI_REVIEWED','true');
  expect(syncpayCardConfigured()).toBe(true);
 });
 it('não libera parcelas anuais sem cotação oficial e conciliação',()=>{
  const ui=readFileSync('src/pages/FioPlans.tsx','utf8');
  expect(ui).toContain('Compra anual em preparação');
  expect(ui).toContain('disabled>Compra anual em preparação');
 });
});
