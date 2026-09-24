import {demoData} from '../../src/lib/demo';
import type {Role} from '../../shared/domain';
const role=(new URLSearchParams(location.search).get('role')||'OWNER') as Role;
const data=demoData(role);
export class RequestError extends Error{constructor(public code:string,message:string){super(message);}}
const session={user:{id:data.membership.user_id,email:'teste@example.test'}};
export const supabase={auth:{getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:session.user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})}};
export function setRememberSession(){}
export function getRememberSession(){return true;}
export async function api<T>(path:string,_shop?:string,body?:unknown):Promise<T>{
 if(path==='/memberships')return [data.membership] as T;
 if(path==='/bootstrap')return data as T;
 if(path==='/onboarding/progress')return {shop:{onboarding_completed:true}} as T;
 if(path==='/saas/billing')return {configured:true,subscription:null} as T;
 if(path==='/support/feedback'&&body)return {ok:true} as T;
 throw new Error('Fixture does not implement '+path);
}
