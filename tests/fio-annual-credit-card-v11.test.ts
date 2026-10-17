import {describe,it,expect,afterEach} from 'vitest';
import {annualCreditCardLiveEnabled,normalizeAnnualCardProof} from '../server/fio-annual-credit-card.js';
const order={id:'a-12345678',amountCents:149990};
const verified=(changes:Record<string,unknown>={})=>({data:{transaction:{
 reference_id:order.id,amount:1499.90,status:'completed',currency:'BRL',payment_method:'credit_card',
 paid_at:'2026-10-17T14:00:00Z',...changes
}}});
afterEach(()=>{delete process.env.FIO_ENABLE_ANNUAL_API_CHARGES;delete process.env.FIO_ENABLE_ANNUAL_ORDER_DRAFTS;});
describe('FIO compra anual V12.1 - prova de pagamento forte, sem cobranca real',()=>{
 it('gate de cobranca real permanece desligado por padrao',()=>{
  delete process.env.FIO_ENABLE_ANNUAL_API_CHARGES;
  expect(annualCreditCardLiveEnabled()).toBe(false);
 });
 it('exige gates independentes',()=>{
  process.env.FIO_ENABLE_ANNUAL_API_CHARGES='true';
  expect(annualCreditCardLiveEnabled()).toBe(false);
 });
 it('nao libera acesso por cobranca pendente',()=>{
  expect(normalizeAnnualCardProof(verified({status:'pending',paid_at:null}),order).state).toBe('pending');
 });
 it('exige transacao correta e valor base exato',()=>{
  expect(()=>normalizeAnnualCardProof(verified({reference_id:'b-12345678'}),order)).toThrow();
  expect(()=>normalizeAnnualCardProof(verified({amount:1498.90}),order)).toThrow();
 });
 it('recusa outra moeda ou outro meio de pagamento',()=>{
  expect(()=>normalizeAnnualCardProof(verified({currency:'USD'}),order)).toThrow();
  expect(()=>normalizeAnnualCardProof(verified({payment_method:'pix'}),order)).toThrow();
  expect(()=>normalizeAnnualCardProof(verified({payment_method:undefined}),order)).toThrow();
 });
 it('nao aceita horario de criacao no lugar de paid_at',()=>{
  expect(()=>normalizeAnnualCardProof(verified({paid_at:null,transaction_date:'2026-10-17T14:00:00Z'}),order)).toThrow();
 });
 it('so aceita resposta V2 com transaction envelopada',()=>{
  expect(()=>normalizeAnnualCardProof({data:{reference_id:order.id,amount:1499.90,status:'completed',currency:'BRL',transaction_date:'2026-10-17T14:00:00Z'}},order)).toThrow();
 });
 it('aceita V2 concluida com pagamento validado',()=>{
  expect(normalizeAnnualCardProof(verified(),order)).toEqual({state:'completed',paidAt:'2026-10-17T14:00:00.000Z'});
 });
});
