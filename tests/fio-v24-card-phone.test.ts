import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
describe('V24 cartão recorrente exige contato do comprador antes da tokenização',()=>{
 const server=readFileSync('server/syncpay.ts','utf8');
 const ui=readFileSync('src/pages/FioPlans.tsx','utf8');
 it('requires phone before one-use token, never sends PAN/CVV to FIO',()=>{
  expect(server).toContain('phone:z.string().regex(/^\\d{10,13}$/).optional()');
  expect(server).toContain("const phone=digits(input.phone??ctx.member.phone??'')");
  expect(server).toContain('SYNCPAY_CARD_PHONE_REQUIRED');
  expect(server.indexOf('SYNCPAY_CARD_PHONE_REQUIRED')).toBeLessThan(server.indexOf('ensureProviderPlan(db,input.plan'));
  expect(server.indexOf('SYNCPAY_CARD_PHONE_REQUIRED')).toBeLessThan(server.indexOf('begin_syncpay_enrollment'));
  expect(ui).toContain('Telefone com DDD');
  expect(ui).toContain('Informe um telefone válido com DDD para pagar com cartão.');
  expect(ui.indexOf('Informe um telefone válido com DDD para pagar com cartão.')).toBeLessThan(ui.indexOf('const sealed=await tokenizeAnnualCard('));
  expect(ui).toContain("phone:payerPhone.replace(/\\D/g,'')");
  expect(ui).not.toContain("'/saas/syncpay/card-token',p.data.shop.id,{card:");
 });
});
