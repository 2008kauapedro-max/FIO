/** Regras de compra ANUAL no cartão - sem simular taxas da adquirente. */
export type AnnualCardQuote={priceCents:number;installments:number;totalCents:number|null;installmentCents:number|null;canConfirm:boolean;reason:string|null};
export function annualCardQuote(priceCents:number,installments:number,confirmedTotalCents?:number):AnnualCardQuote{
 if(!Number.isInteger(priceCents)||priceCents<=0)throw Error('Preço anual inválido');
 if(!Number.isInteger(installments)||installments<1||installments>12)throw Error('Parcelas devem estar entre 1 e 12');
 if(installments===1)return {priceCents,installments,totalCents:priceCents,installmentCents:priceCents,canConfirm:true,reason:null};
 if(!Number.isInteger(confirmedTotalCents)||confirmedTotalCents===undefined||confirmedTotalCents<priceCents) return {priceCents,installments,totalCents:null,installmentCents:null,canConfirm:false,reason:'Aguardando taxa e total final confirmados pela SyncPay'};
 return {priceCents,installments,totalCents:confirmedTotalCents,installmentCents:Math.ceil(confirmedTotalCents/installments),canConfirm:true,reason:null};
}
export const CARD_PAYMENT_RULES={monthly:{kind:'subscription',billingMethod:'credit_card',renewal:true},annual:{kind:'one_time_purchase',maxInstallments:12,renewal:false}} as const;
