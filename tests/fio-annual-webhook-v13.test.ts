import {createHmac} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {annualWebhookAuthenticated} from '../server/fio-annual-credit-card.js';

describe('FIO V14 - webhook anual SyncPay HMAC',()=>{
 const secret='test-secret-webhook-annual-123456789';
 const now=1792260000;
 const body=Buffer.from('{"event":"transaction.updated","transaction":{"reference_id":"abc-def"}}','utf8');
 function signature(input:Buffer|string=body,time=now,key=secret){
  return `t=${time},v1=${createHmac('sha256',key).update(String(time)).update('.').update(input).digest('hex')}`;
 }
 it('falha sem segredo, assinatura ou formato correto',()=>{
  expect(annualWebhookAuthenticated(signature(),undefined,body,now)).toBe(false);
  expect(annualWebhookAuthenticated(undefined,secret,body,now)).toBe(false);
  expect(annualWebhookAuthenticated('Bearer '+secret,secret,body,now)).toBe(false);
  expect(annualWebhookAuthenticated('t=123,v1=abc',secret,body,now)).toBe(false);
 });
 it('aceita somente HMAC correto do corpo bruto',()=>{
  expect(annualWebhookAuthenticated(signature(),secret,body,now)).toBe(true);
  expect(annualWebhookAuthenticated(signature(),secret,Buffer.from(body.toString()+' '),now)).toBe(false);
  expect(annualWebhookAuthenticated(signature(),secret+'wrong',body,now)).toBe(false);
  expect(annualWebhookAuthenticated(signature(body,now,secret+'wrong'),secret,body,now)).toBe(false);
 });
 it('rejeita assinatura muito antiga ou futura',()=>{
  expect(annualWebhookAuthenticated(signature(body,now-301),secret,body,now)).toBe(false);
  expect(annualWebhookAuthenticated(signature(body,now+301),secret,body,now)).toBe(false);
  expect(annualWebhookAuthenticated(signature(body,now-300),secret,body,now)).toBe(true);
 });
 it('nao autentica corpo alterado por normalizacao de JSON',()=>{
  const formatted=Buffer.from('{ "event": "transaction.updated", "transaction": { "reference_id": "abc-def" } }');
  expect(annualWebhookAuthenticated(signature(formatted),secret,formatted,now)).toBe(true);
  expect(annualWebhookAuthenticated(signature(formatted),secret,body,now)).toBe(false);
 });
});
