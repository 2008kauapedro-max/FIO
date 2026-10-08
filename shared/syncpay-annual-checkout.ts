/**
 * Contratação ANUAL no cartão SyncPay.
 * Uma única compra em até 12 parcelas NÃO É uma assinatura mensal recorrente.
 * Este módulo prepara os dados e mantém a compra bloqueada até que exista
 * uma cotação oficial verificável da taxa/total e um checkout conciliável.
 */
export type AnnualCheckoutPreview = {
  kind: 'one_time_annual';
  installments: number;
  basePriceCents: number;
  installmentTotalCents: number | null;
  totalCents: number | null;
  estimatedInstallmentCents: number | null;
  canCharge: false;
  needsProviderQuote: boolean;
  renewalAutomatic: false;
  explanation: string;
};

export function annualCheckoutPreview(basePriceCents:number,installments:number):AnnualCheckoutPreview {
  if (!Number.isSafeInteger(basePriceCents) || basePriceCents < 1)
    throw new Error('Valor anual inválido');
  if (!Number.isInteger(installments) || installments < 1 || installments > 12)
    throw new Error('A quantidade de parcelas deve estar entre 1 e 12');
  const extra=installments>1;
  return {
    kind:'one_time_annual',installments,basePriceCents,
    installmentTotalCents:extra?null:basePriceCents,
    totalCents:extra?null:basePriceCents,
    estimatedInstallmentCents:extra?null:basePriceCents,
    canCharge:false,needsProviderQuote:extra,renewalAutomatic:false,
    explanation:extra
      ?'Os juros e o valor total das parcelas ainda precisam ser confirmados pela SyncPay antes do pagamento.'
      :'Compra única de um ano de acesso, sem renovação automática. A cobrança ainda não está habilitada.'
  };
}

/** Distribui os centavos do total EXATO entre parcelas, sem arredondar para cima o total. */
export function annualInstallmentAmounts(totalCents:number,installments:number):number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents<1)
    throw new Error('Total inválido');
  if (!Number.isInteger(installments)||installments<1||installments>12||totalCents<installments)
    throw new Error('Parcelamento inválido');
  const base=Math.floor(totalCents/installments);
  const remainder=totalCents%installments;
  return Array.from({length:installments},(_,i)=>base+(i<remainder?1:0));
}

/** O início do período depende da confirmação do pagamento, nunca de um HTTP 200. */
export function annualEntitlementDates(approvedAt:string){
  const paid=new Date(approvedAt);
  if(!Number.isFinite(paid.getTime()))throw new Error('Confirmação inválida');
  const endsAt=new Date(paid.getTime()+365*86_400_000);
  return {startsAt:paid.toISOString(),endsAt:endsAt.toISOString()};
}

export const ANNUAL_CARD_SAFETY={
  provider:'syncpay',kind:'one_time_annual',automaticRenewal:false,
  maxInstallments:12,createChargeEnabled:false,
  customerTotalMustBeKnownBeforeConsent:true,
  grantAccessOnlyAfterConfirmedPayment:true,
  refundDoesNotDependOnCardInstallmentDueDates:true,
} as const;
