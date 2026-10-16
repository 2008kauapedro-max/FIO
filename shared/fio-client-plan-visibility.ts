import type {Plan} from './domain.js';
/** Visibility only: archived excess plans are never deleted or mutated. */
export function fioClientPlanLimit(plan:Plan):number{
 return ({FREE:0,SOLO:5,SOLO_PREMIUM:Number.POSITIVE_INFINITY,PRO:5,PLUS:5,PREMIUM:15} as Record<Plan,number>)[plan];
}
export function fioVisibleClientPlans<T extends {id?:string|number;active?:boolean}>(plans:readonly T[],plan:Plan,priority:readonly string[]=[]):T[]{
 const limit=fioClientPlanLimit(plan);
 const ranking=new Map(priority.map((id,i)=>[id,i] as const));
 return plans.filter(item=>item.active!==false).sort((a,b)=>{
  const aRank=ranking.get(String(a.id??''))??Number.MAX_SAFE_INTEGER;
  const bRank=ranking.get(String(b.id??''))??Number.MAX_SAFE_INTEGER;
  return aRank-bRank;
 }).slice(0,limit);
}
