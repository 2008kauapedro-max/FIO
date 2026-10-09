import type { Plan } from '../../shared/domain';
import type { BillingCycle } from '../../shared/fio-plans';
import { fioPlanPublicName } from '../../shared/fio-plans';

export function planBadgeLabel(plan:Plan,subscription:{status:string;trial_ends_at?:string|null},now=Date.now()):string{
 if(subscription.status!=='trialing')return fioPlanPublicName(plan);
 const end=Date.parse(subscription.trial_ends_at??'');
 return Number.isFinite(end)&&end<=now?'Teste encerrado':'Teste grátis';
}

export function premiumInitialPlan(soloMode:boolean):Plan{
 return soloMode?'SOLO_PREMIUM':'PREMIUM';
}

type PaymentAvailability={
 billingConfigured:boolean;
 stripeConfigured:boolean;
 pixAutomaticoConfigured:boolean;
 syncpayCardConfigured:boolean;
 legacyPixCheckoutConfigured:boolean;
};

export function canStartPaidCheckout(flags:PaymentAvailability,cycle:BillingCycle):boolean{
 if(flags.stripeConfigured)return true;
 if(!flags.billingConfigured)return false;
 return flags.pixAutomaticoConfigured||
  flags.legacyPixCheckoutConfigured||
  (cycle==='monthly'&&flags.syncpayCardConfigured);
}
