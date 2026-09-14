import express from 'express';
import { createClient } from '@supabase/supabase-js';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { z, ZodError } from 'zod';
import { authenticate, tenant, requireOwner, bootstrap, type AuthContext, type TenantContext } from './context.js';
import { ApiError,dbError } from './errors.js';
import { askAssistant } from './assistant.js';
import { bookingSchema } from '../shared/domain.js';
type Authenticator = typeof authenticate;

function serviceDb(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new ApiError(503,'SETUP_REQUIRED','A configuração segura do servidor ainda não foi concluída.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function cleanPhone(value:string){return value.trim().replace(/\s+/g,' ');}

export function createApp(authenticator: Authenticator=authenticate) {
 const app=express();
 app.disable('x-powered-by');
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],connectSrc:["'self'",'https://*.supabase.co','wss://*.supabase.co'],imgSrc:["'self'",'data:','blob:','https://*.supabase.co'],objectSrc:["'none'"],frameAncestors:["'none'"]}}}));
 app.use(express.json({limit:'12kb'}));
 app.get('/api/health',(_req,res)=>res.json({status:'ok',configured:!!(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY)}));
 app.get('/api/public/shop/:slug',async(req,res)=>{
  const slug=z.string().regex(/^[a-z0-9-]{3,60}$/).parse(req.params.slug),db=serviceDb();
  const shop=await db.from('barbershops').select('id,name,slug,public_title,public_description,logo_url,cover_url,background_url,accent_color').eq('slug',slug).maybeSingle();dbError(shop.error);
  if(!shop.data) throw new ApiError(404,'NOT_FOUND','Barbearia não encontrada.');
  const [services,team]=await Promise.all([
   db.from('services').select('id,name,duration_minutes,price_cents').eq('barbershop_id',shop.data.id).eq('active',true).order('name'),
   db.from('memberships').select('user_id,display_name,role').eq('barbershop_id',shop.data.id).in('role',['OWNER','BARBER']).eq('active',true).order('display_name')
  ]);dbError(services.error);dbError(team.error);
  res.json({shop:shop.data,services:services.data??[],team:team.data??[]});
 });
 app.get('/api/public/manifest/:slug',async(req,res)=>{
  const slug=z.string().regex(/^[a-z0-9-]{3,60}$/).parse(req.params.slug),db=serviceDb();
  const shop=await db.from('barbershops').select('name,public_title').eq('slug',slug).maybeSingle();dbError(shop.error);
  if(!shop.data) throw new ApiError(404,'NOT_FOUND','Barbearia não encontrada.');
  const name=shop.data.public_title||shop.data.name;
  res.type('application/manifest+json').set('Cache-Control','public, max-age=300').send(JSON.stringify({id:`/b/${slug}`,name,short_name:name.slice(0,24),description:`Agendamentos e cuidados de ${name}.`,start_url:`/b/${slug}`,scope:`/b/${slug}`,display:'standalone',background_color:'#000000',theme_color:'#000000',orientation:'portrait-primary',icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]}));
 });
 app.use('/api',async(req,res,next)=>{res.locals.auth=await authenticator(req);next();});
 app.get('/api/memberships',async(_req,res)=>{
  const a=res.locals.auth as AuthContext;
  const result=await a.db.from('memberships').select('*').eq('user_id',a.userId).eq('active',true);dbError(result.error);res.json(result.data);
 });
 app.post('/api/onboarding',async(req,res)=>{
  const v=z.discriminatedUnion('mode',[
   z.object({mode:z.literal('create'),name:z.string().trim().min(2).max(100),slug:z.string().regex(/^[a-z0-9-]{3,60}$/),displayName:z.string().trim().min(2).max(100)}).strict(),
   z.object({mode:z.literal('join'),slug:z.string().min(3).max(60),displayName:z.string().trim().min(2).max(100)}).strict(),
   z.object({mode:z.literal('invite'),token:z.uuid(),displayName:z.string().trim().min(2).max(100)}).strict()
  ]).parse(req.body);
  const a=res.locals.auth as AuthContext;
  const result=v.mode==='create'?await a.db.rpc('create_barbershop',{p_name:v.name,p_slug:v.slug,p_display_name:v.displayName}):v.mode==='join'?await a.db.rpc('join_barbershop',{p_slug:v.slug,p_name:v.displayName}):await a.db.rpc('accept_invitation',{p_token:v.token,p_name:v.displayName});
  dbError(result.error);res.status(201).json({barbershopId:result.data});
 });
 app.use('/api',async(req,res,next)=>{res.locals.ctx=await tenant(res.locals.auth,req);next();});
 const ctx=(res:express.Response)=>res.locals.ctx as TenantContext;
 app.get('/api/bootstrap',async(_req,res)=>res.json(await bootstrap(ctx(res))));
 app.post('/api/services',async(req,res)=>{
  const c=ctx(res);requireOwner(c);
  const v=z.object({name:z.string().trim().min(2).max(100),duration_minutes:z.number().int().min(10).max(240),price_cents:z.number().int().min(0).max(1000000)}).strict().parse(req.body);
  const r=await c.db.from('services').insert({...v,barbershop_id:c.shopId}).select().single();dbError(r.error);res.status(201).json(r.data);
 });
 app.patch('/api/services/:id',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const id=z.uuid().parse(req.params.id);
  const v=z.object({name:z.string().trim().min(2).max(100).optional(),duration_minutes:z.number().int().min(10).max(240).optional(),price_cents:z.number().int().min(0).max(1000000).optional(),active:z.boolean().optional()}).strict().parse(req.body);
  const r=await c.db.from('services').update(v).eq('id',id).eq('barbershop_id',c.shopId).select().single();dbError(r.error);res.json(r.data);
 });
 app.post('/api/customers',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({name:z.string().trim().min(2).max(100),phone:z.string().trim().min(8).max(24).optional()}).strict().parse(req.body);
  const r=await c.db.from('customers').insert({...v,phone:v.phone?cleanPhone(v.phone):null,barbershop_id:c.shopId}).select().single();dbError(r.error);res.status(201).json(r.data);
 });
 app.patch('/api/profile/contact',async(req,res)=>{
  const c=ctx(res),v=z.object({phone:z.string().trim().max(24)}).strict().parse(req.body);
  const r=await c.db.rpc('update_own_contact',{p_shop:c.shopId,p_phone:v.phone});dbError(r.error);res.json({ok:true});
 });
 app.patch('/api/shop/branding',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({title:z.string().trim().max(100).default(''),description:z.string().trim().max(280).default(''),logoUrl:z.string().trim().max(500).default(''),coverUrl:z.string().trim().max(500).default(''),backgroundUrl:z.string().trim().max(500).default(''),accentColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#ffffff')}).strict().parse(req.body);
  const r=await c.db.rpc('update_shop_branding',{p_shop:c.shopId,p_title:v.title,p_description:v.description,p_logo_url:v.logoUrl,p_cover_url:v.coverUrl,p_background_url:v.backgroundUrl,p_accent_color:v.accentColor});dbError(r.error);res.json({ok:true});
 });
 app.post('/api/staff',async(req,res)=>{
  const c=ctx(res);requireOwner(c);
  const v=z.object({name:z.string().trim().min(2).max(100),email:z.email().max(254),temporaryPassword:z.string().min(8).max(128),phone:z.string().trim().min(8).max(24)}).strict().parse(req.body);
  const admin=serviceDb();
  const created=await admin.auth.admin.createUser({email:v.email,password:v.temporaryPassword,email_confirm:true,user_metadata:{display_name:v.name}});
  if(created.error||!created.data.user) throw new ApiError(400,'STAFF_CREATE_FAILED','Não foi possível criar o acesso. Confira se o e-mail já está em uso.');
  const userId=created.data.user.id;
  const membership=await admin.from('memberships').insert({barbershop_id:c.shopId,user_id:userId,role:'BARBER',display_name:v.name,phone:cleanPhone(v.phone),active:true});
  if(membership.error){await admin.auth.admin.deleteUser(userId);dbError(membership.error);}
  res.status(201).json({userId});
 });
 app.post('/api/reviews',async(req,res)=>{
  const c=ctx(res),v=z.object({appointmentId:z.uuid(),rating:z.number().int().min(1).max(5),comment:z.string().trim().max(1000).default('')}).strict().parse(req.body);
  const r=await c.db.rpc('submit_review',{p_shop:c.shopId,p_appointment:v.appointmentId,p_rating:v.rating,p_comment:v.comment});dbError(r.error);res.status(201).json({id:r.data});
 });
 app.get('/api/slots',async(req,res)=>{
  const c=ctx(res);const v=z.object({barberId:z.uuid(),serviceId:z.uuid(),day:z.iso.date()}).parse(req.query);
  const r=await c.db.rpc('available_slots',{p_shop:c.shopId,p_barber:v.barberId,p_service:v.serviceId,p_day:v.day});dbError(r.error);res.json(r.data);
 });
 app.post('/api/appointments',async(req,res)=>{
  const c=ctx(res),v=bookingSchema.parse(req.body);
  const r=await c.db.rpc('book_appointment',{p_shop:c.shopId,p_client:v.clientId,p_barber:v.barberId,p_service:v.serviceId,p_start:v.startsAt,p_use_subscription:v.useSubscription});dbError(r.error);res.status(201).json({id:r.data});
 });
 app.patch('/api/appointments/:id',async(req,res)=>{
  const c=ctx(res),id=z.uuid().parse(req.params.id),v=z.object({status:z.enum(['confirmed','in_service','completed','cancelled','no_show']),confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('transition_appointment',{p_shop:c.shopId,p_id:id,p_status:v.status});dbError(r.error);res.json({ok:true});
 });
 app.post('/api/payments',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({appointmentId:z.uuid(),method:z.enum(['cash','pix','card','other']).default('pix'),confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('record_payment',{p_shop:c.shopId,p_appointment:v.appointmentId,p_method:v.method});dbError(r.error);res.status(201).json({ok:true});
 });
 app.post('/api/invitations',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({role:z.enum(['BARBER','CLIENT'])}).strict().parse(req.body);
  const r=await c.db.rpc('create_invitation',{p_shop:c.shopId,p_role:v.role});dbError(r.error);res.status(201).json({token:r.data});
 });
 app.post('/api/subscriptions',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({clientId:z.uuid(),name:z.string().trim().min(2).max(100),cuts:z.number().int().min(1).max(1000),expiresAt:z.iso.datetime({offset:true}),confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('issue_subscription',{p_shop:c.shopId,p_client:v.clientId,p_name:v.name,p_cuts:v.cuts,p_expires:v.expiresAt});dbError(r.error);res.status(201).json({id:r.data});
 });
 app.post('/api/subscription-plans',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({name:z.string().trim().min(2).max(100),cuts:z.number().int().min(1).max(1000),validityDays:z.number().int().min(1).max(730),priceCents:z.number().int().min(0).max(10000000)}).strict().parse(req.body);
  const r=await c.db.from('subscription_plans').insert({barbershop_id:c.shopId,name:v.name,cuts:v.cuts,validity_days:v.validityDays,price_cents:v.priceCents}).select().single();dbError(r.error);res.status(201).json(r.data);
 });
 app.post('/api/subscriptions/from-plan',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({clientId:z.uuid(),planId:z.uuid(),confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('issue_subscription_from_plan',{p_shop:c.shopId,p_client:v.clientId,p_plan:v.planId});dbError(r.error);res.status(201).json({id:r.data});
 });
 app.patch('/api/subscriptions/:id/cancel',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const id=z.uuid().parse(req.params.id);z.object({confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('cancel_subscription',{p_shop:c.shopId,p_subscription:id});dbError(r.error);res.json({ok:true});
 });
 app.post('/api/campaigns',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({title:z.string().trim().min(2).max(120),body:z.string().trim().min(1).max(1000),audience:z.enum(['CLIENT','BARBER','ALL']).default('CLIENT')}).strict().parse(req.body);
  const r=await c.db.from('campaigns').insert({barbershop_id:c.shopId,created_by:c.userId,title:v.title,body:v.body,audience:v.audience,status:'draft'}).select().single();dbError(r.error);res.status(201).json(r.data);
 });
 app.post('/api/campaigns/:id/publish',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const id=z.uuid().parse(req.params.id);z.object({confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('publish_campaign',{p_shop:c.shopId,p_campaign:id});dbError(r.error);res.json({ok:true});
 });
 app.patch('/api/notifications/:id/read',async(req,res)=>{
  const c=ctx(res),id=z.uuid().parse(req.params.id);
  const r=await c.db.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('barbershop_id',c.shopId).eq('user_id',c.userId);dbError(r.error);res.json({ok:true});
 });
 app.post('/api/posts',async(req,res)=>{
  const c=ctx(res);
  if(!['OWNER','BARBER'].includes(c.member.role)) throw new ApiError(403,'FORBIDDEN','Somente a equipe pode publicar no feed.');
  const v=z.object({caption:z.string().trim().max(500).default(''),imagePath:z.string().min(5).max(500)}).strict().parse(req.body);
  const expected=`${c.shopId}/${c.userId}/`;
  if(!v.imagePath.startsWith(expected)||! /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(v.imagePath.slice(expected.length))) throw new ApiError(400,'INVALID_IMAGE','O arquivo enviado não pertence a este perfil.');
  const r=await c.db.from('feed_posts').insert({barbershop_id:c.shopId,author_id:c.userId,author_name:c.member.display_name,caption:v.caption,image_path:v.imagePath}).select('id,author_id,author_name,caption,image_path,created_at').single();
  dbError(r.error);res.status(201).json(r.data);
 });
 app.delete('/api/posts/:id',async(req,res)=>{
  const c=ctx(res),id=z.uuid().parse(req.params.id);
  if(!['OWNER','BARBER'].includes(c.member.role)) throw new ApiError(403,'FORBIDDEN','Somente a equipe pode remover publicações.');
  const existing=await c.db.from('feed_posts').select('id,author_id,image_path').eq('id',id).eq('barbershop_id',c.shopId).maybeSingle();dbError(existing.error);
  if(!existing.data) throw new ApiError(404,'NOT_FOUND','Publicação não encontrada.');
  if(c.member.role!=='OWNER'&&existing.data.author_id!==c.userId) throw new ApiError(403,'FORBIDDEN','Você só pode remover suas próprias publicações.');
  const r=await c.db.from('feed_posts').delete().eq('id',id).eq('barbershop_id',c.shopId);dbError(r.error);res.json({ok:true,imagePath:existing.data.image_path});
 });
 app.get('/api/conversations',async(_req,res)=>{
  const c=ctx(res);const r=await c.db.from('assistant_conversations').select('id,title,created_at').eq('barbershop_id',c.shopId).eq('user_id',c.userId).order('created_at',{ascending:false}).limit(50);dbError(r.error);res.json(r.data);
 });
 app.get('/api/conversations/:id',async(req,res)=>{
  const c=ctx(res),id=z.uuid().parse(req.params.id);
  const r=await c.db.from('assistant_messages').select('id,role,content').eq('conversation_id',id).eq('barbershop_id',c.shopId).eq('user_id',c.userId).order('created_at').limit(200);dbError(r.error);res.json(r.data);
 });
 app.post('/api/assistant',async(req,res)=>res.json(await askAssistant(ctx(res),req.body)));
 app.use('/api',(_req,res)=>res.status(404).json({code:'NOT_FOUND',message:'Recurso não encontrado.'}));
 if(process.env.NODE_ENV==='production') {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));
 }
 app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(error instanceof ZodError) {res.status(400).json({code:'INVALID_INPUT',message:'Confira os campos informados.'});return;}
  if(error instanceof ApiError) {if(error.status===429)res.setHeader('Retry-After',error.code==='DAILY_LIMIT'?'86400':'60');res.status(error.status).json({code:error.code,message:error.message});return;}
  res.status(500).json({code:'INTERNAL_ERROR',message:'Não foi possível concluir. Tente novamente.'});
 });
 return app;
}
