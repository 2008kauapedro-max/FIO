import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { z } from 'zod';
import type { Membership, Bootstrap } from '../shared/domain.js';
import { ApiError, dbError } from './errors.js';
export interface AuthContext { db: SupabaseClient; userId: string }
export interface TenantContext extends AuthContext { shopId: string; member: Membership }
export async function authenticate(req: Request): Promise<AuthContext> {
 const token=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
 if(!token) throw new ApiError(401,'AUTH_REQUIRED','Entre para continuar.');
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key) throw new ApiError(503,'SETUP_REQUIRED','A conexão da barbearia ainda não foi configurada.');
 const db=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.getUser(token);
 if(error||!data.user) throw new ApiError(401,'AUTH_REQUIRED','Sua sessão expirou. Entre novamente.');
 return {db,userId:data.user.id};
}
export async function tenant(auth: AuthContext, req: Request): Promise<TenantContext> {
 const shopId=z.uuid().parse(req.headers['x-barbershop-id']);
 const {data,error}=await auth.db.from('memberships').select('*').eq('barbershop_id',shopId).eq('user_id',auth.userId).eq('active',true).maybeSingle();
 dbError(error);
 if(!data) throw new ApiError(403,'FORBIDDEN','Você não tem acesso a esta barbearia.');
 return {...auth,shopId,member:data as Membership};
}
export function requireOwner(ctx: TenantContext) { if(ctx.member.role!=='OWNER') throw new ApiError(403,'FORBIDDEN','Esta ação é exclusiva do responsável pela barbearia.'); }
export async function bootstrap(ctx: TenantContext): Promise<Bootstrap> {
 const {db,shopId}=ctx;
 const from=new Date(Date.now()-30*86400000).toISOString();
 const results=await Promise.all([
  db.from('barbershops').select('*').eq('id',shopId).single(),
  db.from('services').select('*').eq('barbershop_id',shopId).order('name'),
  db.from('appointments').select('*').eq('barbershop_id',shopId).gte('starts_at',from).order('starts_at').limit(500),
  db.from('customers').select('id,name,phone,user_id').eq('barbershop_id',shopId).order('name').limit(500),
  db.from('memberships').select('*').eq('barbershop_id',shopId).eq('active',true),
  db.from('client_subscriptions').select('*').eq('barbershop_id',shopId).order('expires_at').limit(500),
  db.from('saas_subscriptions').select('*').eq('barbershop_id',shopId).single(),
  db.from('memberships').select('*').eq('user_id',ctx.userId).eq('active',true),
  ctx.member.role==='OWNER'?db.rpc('weekly_revenue',{p_shop:shopId}):Promise.resolve({data:null,error:null}),
  db.from('plan_features').select('plan,ai_enabled'),
  db.from('feed_posts').select('id,author_id,author_name,caption,image_path,created_at').eq('barbershop_id',shopId).order('created_at',{ascending:false}).limit(100),
  db.from('subscription_plans').select('id,name,cuts,validity_days,price_cents,active').eq('barbershop_id',shopId).order('name'),
  ctx.member.role==='OWNER'?db.from('payments').select('appointment_id,amount_cents,created_at').eq('barbershop_id',shopId).order('created_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
  db.from('campaigns').select('id,title,body,audience,status,created_at,published_at').eq('barbershop_id',shopId).order('created_at',{ascending:false}).limit(100),
  db.from('notifications').select('id,title,body,read_at,created_at').eq('barbershop_id',shopId).eq('user_id',ctx.userId).order('created_at',{ascending:false}).limit(50),
  db.from('reviews').select('id,appointment_id,client_id,barber_id,rating,comment,created_at').eq('barbershop_id',shopId).order('created_at',{ascending:false}).limit(500)
 ]);
 results.forEach(r=>dbError(r.error));
 const [shop,services,appointments,customers,team,subscriptions,billing,memberships,revenue,features,posts,subscriptionPlans,payments,campaigns,notifications,reviews]=results.map(r=>r.data);
 const entitlementActive=['active','trialing'].includes(billing.status)&&(!billing.expires_at||new Date(billing.expires_at)>new Date());
 const plan=entitlementActive?billing.plan:'FREE';
 const aiEnabled=entitlementActive&&(features as {plan:string;ai_enabled:boolean}[]).some(f=>f.plan===billing.plan&&f.ai_enabled);
 const fioSubscription={plan:billing.plan,status:billing.status,starts_at:billing.starts_at,current_period_end:billing.current_period_end,trial_ends_at:billing.trial_ends_at,cancelled_at:billing.cancelled_at};
 return {shop,membership:ctx.member,memberships,services,appointments,customers,team,subscriptions,subscriptionPlans,payments,campaigns,notifications,posts,reviews,fioSubscription,plan,aiEnabled,revenue} as Bootstrap;
}
// The provider receives a deliberately small, role-scoped data projection, never a frontend snapshot.
export function assistantContext(data: Bootstrap) {
 const role=data.membership.role;
 return {
  role, barbershop:{name:data.shop.name,timezone:data.shop.timezone}, current_time:new Date().toISOString(),
  coverage:'Agenda: últimos 30 dias e próximos 60 dias, até 500 registros. Clientes e assinaturas: até 500 registros. Não inferir totais fora deste recorte.',
  services:data.services.filter(s=>s.active).map(s=>({name:s.name,duration_minutes:s.duration_minutes,price_cents:s.price_cents})),
  appointments:data.appointments.map(a=>({start:a.starts_at,end:a.ends_at,status:a.status,service:data.services.find(s=>s.id===a.service_id)?.name,client:data.customers.find(c=>c.id===a.client_id)?.name})),
  ...(role==='OWNER'?{received_this_week_cents:data.revenue,customers:data.customers.map(c=>({name:c.name})),subscriptions:data.subscriptions.map(s=>({name:s.name,remaining_cuts:s.remaining_cuts,expires_at:s.expires_at,status:s.status}))}:{}),
  ...(role==='CLIENT'?{subscriptions:data.subscriptions.map(s=>({name:s.name,remaining_cuts:s.remaining_cuts,expires_at:s.expires_at,status:s.status}))}:{}),
  cancellation_policy:'Cliente pode cancelar até 2 horas antes. Nenhuma ação é executada pelo chat.'
 };
}
