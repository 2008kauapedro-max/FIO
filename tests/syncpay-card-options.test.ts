import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {annualCardQuote,CARD_PAYMENT_RULES} from '../shared/syncpay-card-options.js';
describe('SyncPay: cartão recorrente vs compra anual',()=>{
 it('anual parcelado não é recorrência mensal',()=>{expect(CARD_PAYMENT_RULES.monthly.renewal).toBe(true);expect(CARD_PAYMENT_RULES.annual.renewal).toBe(false);expect(CARD_PAYMENT_RULES.annual.maxInstallments).toBe(12);});
 it('impede inventar taxas de parcelamento',()=>{expect(annualCardQuote(12000,12).canConfirm).toBe(false);expect(annualCardQuote(12000,12).totalCents).toBeNull();});
 it('representa total com taxa real sem alterar o preço base',()=>{const q=annualCardQuote(12000,10,13200);expect(q.priceCents).toBe(12000);expect(q.totalCents).toBe(13200);expect(q.installmentCents).toBe(1320);});
 it('recusa número de parcelas inválido',()=>{expect(()=>annualCardQuote(12000,13)).toThrow();expect(()=>annualCardQuote(12000,0)).toThrow();});
 it('o cartão não libera acesso antes do webhook',()=>{const s=readFileSync('server/syncpay.ts','utf8');expect(s).toContain("input.method==='credit_card'");expect(s).toContain("method:'POST',body:JSON.stringify({card:input.card})");expect(s).toContain("providerStatus:detail.status");expect(s).not.toContain("cardPaymentStatus==='approved'?'active'");});
});
