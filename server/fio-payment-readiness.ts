/**
 * Owner-only read-only configuration snapshot.
 * Never checks out, registers mandates, charges cards, or returns credentials.
 * Configuration is NOT proof that SyncPay has approved live operations.
 */
export function fioPaymentReadiness(env:NodeJS.ProcessEnv=process.env){
 const hasCredentials=Boolean(env.SYNCPAY_CLIENT_ID?.trim()&&env.SYNCPAY_CLIENT_SECRET?.trim());
 const publicCardKey=/^pk_live_[A-Za-z0-9._-]{8,}$/.test(env.VITE_SYNCPAY_PUBLIC_KEY??'');
 const recurringWebhook=Boolean([
  env.SYNCPAY_WEBHOOK_SECRET,env.SYNCPAY_WEBHOOK_SECRET_ACTIVATED,
  env.SYNCPAY_WEBHOOK_SECRET_RENEWED,env.SYNCPAY_WEBHOOK_SECRETS
 ].some(x=>typeof x==='string'&&x.trim().length>0));
 const annualWebhook=Boolean(env.SYNCPAY_ANNUAL_WEBHOOK_SECRET?.trim());
 const monthlyPixAutomatico=hasCredentials&&env.FIO_ENABLE_PIX_AUTOMATICO==='true';
 const monthlyHostedCard=hasCredentials&&env.FIO_ENABLE_SYNCPAY_HOSTED_CARD==='true';
 const monthlyDirectCard=hasCredentials&&publicCardKey&&env.FIO_ENABLE_SYNCPAY_CARD==='true';
 const annualDrafts=env.FIO_ENABLE_ANNUAL_ORDER_DRAFTS==='true';
 const annualSingleCharge=hasCredentials&&publicCardKey&&annualDrafts&&env.FIO_ENABLE_ANNUAL_API_CHARGES==='true';
 return {
  requiresProviderApproval:true,
  noCardTrial:{configured:true,automaticRenewal:false},
  monthly:{
   pixAutomaticoConfigured:monthlyPixAutomatico,
   hostedCardConfigured:monthlyHostedCard,
   directCardConfigured:monthlyDirectCard,
   webhookSecretConfigured:recurringWebhook,
   providerLivePaymentVerified:false
  },
  annual:{
   singleChargeConfigured:annualSingleCharge,
   webhookSecretConfigured:annualWebhook,
   maxVerifiedInstallments:1,
   installmentQuoteConfigured:false,
   automaticRenewal:false,
   providerLivePaymentVerified:false
  },
  safeToDeclareLive:false,
  note:'Configuração não comprova permissão da adquirente nem pagamento aprovado. Só homologação real da SyncPay permite liberar vendas.'
 };
}
