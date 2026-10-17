import {createHmac} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {annualWebhookAuthenticated,annualDashboardWebhookTest,handleAnnualCreditCardWebhook} from '../server/fio-annual-credit-card.js';

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

describe('FIO V15 - ping do dashboard SyncPay',()=>{
 const ping=()=>Buffer.from(JSON.stringify({test:true,message:'This is a test webhook payload.',timestamp:'2026-10-17T21:12:46.923786Z'}));
 it('reconhece apenas o formato oficial do teste',()=>{
  expect(annualDashboardWebhookTest(ping())).toBe(true);
  expect(annualDashboardWebhookTest(Buffer.from('{}'))).toBe(false);
  expect(annualDashboardWebhookTest(Buffer.from('This is a test webhook payload.'))).toBe(false);
  expect(annualDashboardWebhookTest(Buffer.from(JSON.stringify({test:true,message:'This is a test webhook payload.',timestamp:'2026-10-17T21:12:46.923786Z',event:'transaction.updated'})))).toBe(false);
  expect(annualDashboardWebhookTest(Buffer.from(JSON.stringify({test:true,message:'This is a test webhook payload.',timestamp:'2026-10-17T21:12:46.923786Z',transaction:{reference_id:'tx12345678'}})))).toBe(false);
 });
 it('retorna 200 no ping sem pedir segredo nem consultar pagamentos',async()=>{
  const result:{status?:number;body?:unknown}={};
  const res={status:(code:number)=>{result.status=code;return res;},json:(data:unknown)=>{result.body=data;return res;},end:()=>res};
  const req={body:ping(),get:(_name:string)=>undefined};
  const forbiddenFetch=async()=>{throw new Error('Nao deve consultar API nem cobrancas durante o ping.');};
  await handleAnnualCreditCardWebhook(req as never,res as never,forbiddenFetch as never);
  expect(result).toEqual({status:200,body:{received:true,test:true}});
 });
 it('evento falso nao assinado continua rejeitado',async()=>{
  const result:{status?:number}={};
  const res={status:(code:number)=>{result.status=code;return res;},end:()=>res,json:()=>res};
  const req={body:Buffer.from(JSON.stringify({event:'transaction.updated',transaction:{reference_id:'abc-def-12345'}})),get:(_name:string)=>undefined};
  const forbiddenFetch=async()=>{throw new Error('Nao deve chamar gateway.');};
  await handleAnnualCreditCardWebhook(req as never,res as never,forbiddenFetch as never);
  expect(result.status).toBe(401);
 });
});
