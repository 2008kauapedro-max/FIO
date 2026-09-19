import { createHmac } from 'node:crypto';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { syncpayInternals,verifySyncpayWebhook } from '../server/syncpay';

afterEach(()=>vi.unstubAllEnvs());

describe('SyncPay billing boundary',()=>{
 it('derives the provider price from the trusted FIO catalog',()=>{
  expect(syncpayInternals.planConfig('PRO','monthly')).toMatchObject({amountCents:11990,periodicityDays:30});
  expect(syncpayInternals.planConfig('PREMIUM','annual')).toMatchObject({amountCents:189990,periodicityDays:365});
 });

 it('accepts valid CPF/CNPJ and rejects malformed documents',()=>{
  expect(syncpayInternals.validDocument('52998224725')).toBe(true);
  expect(syncpayInternals.validDocument('11222333000181')).toBe(true);
  expect(syncpayInternals.validDocument('11111111111')).toBe(false);
 });

 it('keeps overdue access only through the configured grace period',()=>{
  const detail={status:'overdue',next_charge_at:'2026-09-18T12:00:00Z',plan:{grace_period_days:5}} as Parameters<typeof syncpayInternals.accessUntil>[0];
  expect(syncpayInternals.accessUntil(detail)).toBe('2026-09-23T12:00:00.000Z');
 });

 it('validates HMAC on the raw body and rejects replay timestamps',()=>{
  vi.stubEnv('SYNCPAY_WEBHOOK_SECRET','whsec_test_123456');
  const raw=Buffer.from('{"event":"assinatura_ativada"}');
  const t=1_800_000_000;
  const v1=createHmac('sha256','whsec_test_123456').update(`${t}.${raw.toString('utf8')}`).digest('hex');
  const headers={'x-syncpay-signature':`t=${t},v1=${v1}`} as never;
  expect(verifySyncpayWebhook(raw,headers,t)).toBe(true);
  expect(verifySyncpayWebhook(raw,headers,t+301)).toBe(false);
 });

 it('supports bearer-secret deliveries while subscription HMAC remains provider-dependent',()=>{
  vi.stubEnv('SYNCPAY_WEBHOOK_SECRET','whsec_test_123456');
  const raw=Buffer.from('{}');
  expect(verifySyncpayWebhook(raw,{authorization:'Bearer whsec_test_123456'} as never,1)).toBe(true);
  expect(verifySyncpayWebhook(raw,{authorization:'Bearer wrong'} as never,1)).toBe(false);
 });

 it('accepts event-specific webhook secrets without exposing them to the client',()=>{
  vi.stubEnv('SYNCPAY_WEBHOOK_SECRET_ACTIVATED','whsec_activated_123456');
  vi.stubEnv('SYNCPAY_WEBHOOK_SECRET_RENEWED','whsec_renewed_123456');
  const raw=Buffer.from('{}');
  expect(verifySyncpayWebhook(raw,{authorization:'Bearer whsec_activated_123456'} as never,1)).toBe(true);
  expect(verifySyncpayWebhook(raw,{authorization:'Bearer whsec_renewed_123456'} as never,1)).toBe(true);
 });

 it('recognizes SyncPay dashboard test payload wrappers as no-op pings',()=>{
  expect(syncpayInternals.isSyncpayDashboardTest(Buffer.from('This is a test webhook payload.'))).toBe(true);
  expect(syncpayInternals.isSyncpayDashboardTest(Buffer.from('\"This is a test webhook payload.\"'))).toBe(true);
  expect(syncpayInternals.isSyncpayDashboardTest(Buffer.from('{\"message\":\"This is a test webhook payload.\"}'))).toBe(true);
  expect(syncpayInternals.isSyncpayDashboardTest(Buffer.from('message=This+is+a+test+webhook+payload.'))).toBe(true);
  expect(syncpayInternals.isSyncpayDashboardTest(Buffer.from('{\"event\":\"assinatura_ativada\"}'))).toBe(false);
  expect(syncpayInternals.isSyncpayDashboardTest(Buffer.from('{\"message\":\"This is a test webhook payload.\",\"event\":\"assinatura_ativada\"}'))).toBe(true);
 });
});
