import type {Plan} from './domain.js';
export const FIO_RENEWAL_GRACE_MS=2*24*60*60*1000;
export type FioPaymentState={
 plan:Plan;status:string;expires_at:string|null;
 starts_at?:string|null;retained_paid_until?:string|null;verified_paid_until?:string|null;
};
const timestamp=(s:string|null|undefined)=>s?Date.parse(s):NaN;
/** Never grant a new purchase from a checkout return URL or a pending initial charge. */
export function fioEffectivePlan(state:FioPaymentState|null|undefined,now=Date.now()):Plan{
 if(!state||state.plan==='FREE')return 'FREE';
 const due=timestamp(state.expires_at);
 if(['active','trialing'].includes(state.status))
  return (!state.expires_at||Number.isFinite(due)&&due>now)?state.plan:'FREE';
 if(state.status==='past_due'&&state.starts_at&&Number.isFinite(due)&&timestamp(state.verified_paid_until)===due&&due<=now&&now<due+FIO_RENEWAL_GRACE_MS)
  return state.plan;
 const retained=timestamp(state.retained_paid_until);
 if(state.status==='cancelled'&&Number.isFinite(retained)&&retained>now&&timestamp(state.verified_paid_until)===retained)
  return state.plan;
 return 'FREE';
}
export function graceEndsAt(state:FioPaymentState|null|undefined):string|null{
 if(!state||state.status!=='past_due'||!state.starts_at||timestamp(state.verified_paid_until)!==timestamp(state.expires_at))return null;
 const due=timestamp(state.expires_at);
 return Number.isFinite(due)?new Date(due+FIO_RENEWAL_GRACE_MS).toISOString():null;
}
