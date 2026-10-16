/** Public merchant-account snapshot supplied 2026-10-16. Rates can change.
 * An estimate is NEVER a provider quote or permission to charge.
 */
const rates:Readonly<Record<number,number>>={1:0,2:789,3:889,4:959,5:1069,6:1149,7:1399,8:1499,9:1569,10:1649,11:1679,12:1739};
export function fioAnnualCardEstimate(baseCents:number,installments:number){
 if(!Number.isSafeInteger(baseCents)||baseCents<=0||!Number.isInteger(installments)||!(installments in rates))
  throw new Error('Simulacao de parcelamento invalida');
 const interestBasisPoints=rates[installments];
 const totalCents=Math.round(baseCents*(10000+interestBasisPoints)/10000);
 const floor=Math.floor(totalCents/installments),rem=totalCents%installments;
 return {baseCents,installments,interestBasisPoints,interestCents:totalCents-baseCents,totalCents,
  parts:Array.from({length:installments},(_,i)=>floor+(i<rem?1:0)),
  isEstimate:true as const,providerQuoteConfirmed:false as const,canCharge:false as const};
}
