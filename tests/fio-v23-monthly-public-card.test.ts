import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
describe('V23 monthly credit card privacy',()=>{
 const ui=readFileSync('src/pages/FioPlans.tsx','utf8');
 const server=readFileSync('server/app.ts','utf8');
 it('sends card to public SyncPay tokenization, not FIO server',()=>{
  expect(ui).toContain('tokenizeAnnualCard(import.meta.env.VITE_SYNCPAY_PUBLIC_KEY');
  expect(ui).not.toContain("'/saas/syncpay/card-token',p.data.shop.id,{card:");
  expect(server).toContain('PUBLIC_CARD_TOKENIZATION_REQUIRED');
 });
});
