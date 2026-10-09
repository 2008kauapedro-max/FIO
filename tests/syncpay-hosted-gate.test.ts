import {afterEach,describe,expect,it} from 'vitest';
import {syncpayHostedCardConfigured,safeHostedUrl} from '../server/syncpay';
const previous={...process.env};
afterEach(()=>{process.env={...previous};});
describe('checkout SyncPay hospedado - habilitação',()=>{
 it('fica fechado por padrão',()=>{delete process.env.FIO_ENABLE_SYNCPAY_HOSTED_CARD;process.env.SYNCPAY_CLIENT_ID='test';process.env.SYNCPAY_CLIENT_SECRET='test';expect(syncpayHostedCardConfigured()).toBe(false);});
 it('não abre sem credenciais',()=>{process.env.FIO_ENABLE_SYNCPAY_HOSTED_CARD='true';delete process.env.SYNCPAY_CLIENT_ID;delete process.env.SYNCPAY_CLIENT_SECRET;expect(syncpayHostedCardConfigured()).toBe(false);});
 it('requer habilitação explícita do checkout sem PAN/CVV',()=>{process.env.FIO_ENABLE_SYNCPAY_HOSTED_CARD='true';process.env.SYNCPAY_CLIENT_ID='test';process.env.SYNCPAY_CLIENT_SECRET='test';expect(syncpayHostedCardConfigured()).toBe(true);});
 it('aceita somente URL HTTPS do checkout do plano esperado',()=>{
  const t='12345678-1234-1234-1234-123456789abc';
  expect(safeHostedUrl('https://app.syncpayments.com.br/subscription/'+t,t)).toBe('https://app.syncpayments.com.br/subscription/'+t);
  expect(safeHostedUrl('http://app.syncpayments.com.br/subscription/'+t,t)).toBeNull();
  expect(safeHostedUrl('https://evil.example/subscription/'+t,t)).toBeNull();
  expect(safeHostedUrl('https://app.syncpayments.com.br.evil.example/subscription/'+t,t)).toBeNull();
  expect(safeHostedUrl('https://app.syncpayments.com.br/subscription/outro',t)).toBeNull();
  expect(safeHostedUrl('https://app.syncpayments.com.br/subscription/'+t+'?next=https://evil.example',t)).toBeNull();
 });
});
