import {describe,it,expect} from 'vitest';
import {ANNUAL_CARD_SAFETY,annualCheckoutPreview,annualInstallmentAmounts,annualEntitlementDates} from '../shared/syncpay-annual-checkout.js';
import {readFileSync} from 'node:fs';

describe('FIO: compra anual cartão SyncPay (pré-lançamento seguro)',()=>{
 it('parcelamento não cria doze assinaturas',()=>{expect(ANNUAL_CARD_SAFETY.kind).toBe('one_time_annual');expect(ANNUAL_CARD_SAFETY.automaticRenewal).toBe(false);});
 it('cobra apenas após implementação de conciliação',()=>{expect(ANNUAL_CARD_SAFETY.createChargeEnabled).toBe(false);expect(ANNUAL_CARD_SAFETY.grantAccessOnlyAfterConfirmedPayment).toBe(true);});
 it('exige valor total informado previamente',()=>{expect(ANNUAL_CARD_SAFETY.customerTotalMustBeKnownBeforeConsent).toBe(true);});
 it('1x exibe preço base sem liberar compra inacabada',()=>{const q=annualCheckoutPreview(11990,1);expect(q.totalCents).toBe(11990);expect(q.canCharge).toBe(false);});
 it('2x a 12x não inventa taxas',()=>{for(let n=2;n<=12;n++){const q=annualCheckoutPreview(11990,n);expect(q.totalCents).toBe(null);expect(q.needsProviderQuote).toBe(true);expect(q.canCharge).toBe(false);}});
 it('rejeita parcelas fora de faixa',()=>{for(const n of [0,13,-1,1.5,NaN])expect(()=>annualCheckoutPreview(11990,n)).toThrow();});
 it('rejeita preço inválido',()=>{for(const p of [0,-2,1.4,NaN,Infinity])expect(()=>annualCheckoutPreview(p,3)).toThrow();});
 it('arredonda sem alterar o valor total',()=>{expect(annualInstallmentAmounts(10001,3)).toEqual([3334,3334,3333]);expect(annualInstallmentAmounts(13200,10)).toHaveLength(10);expect(annualInstallmentAmounts(10001,3).reduce((a,b)=>a+b,0)).toBe(10001);});
 it('ano de acesso inicia após pagamento aprovado',()=>{const dates=annualEntitlementDates('2026-10-08T15:00:00.000Z');expect(Date.parse(dates.endsAt)-Date.parse(dates.startsAt)).toBe(365*86400000);expect(()=>annualEntitlementDates('foo')).toThrow();});
 it('interface oferece opções de 1 a 12x e mantém compra desativada',()=>{const source=readFileSync('src/pages/FioPlans.tsx','utf8');expect(source).toContain('annualCheckoutPreview(');expect(source).toContain('aria-label="Quantidade de parcelas anuais"');expect(source).toContain('disabled>Compra anual em preparação');});
});
