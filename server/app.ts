import express from 'express';
import { platformRouter } from './platform.js';
import { createClient } from '@supabase/supabase-js';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { z, ZodError } from 'zod';
import { authenticate, tenant, requireOwner, requireFioFeature, bootstrap, type AuthContext, type TenantContext } from './context.js';
import { ApiError,dbError } from './errors.js';
import { askAssistant } from './assistant.js';
import { bookingSchema } from '../shared/domain.js';
import { changeSyncpayPlan,manageSyncpayCharge,createSyncpaySubscription,getSyncpayBilling,handleSyncpayWebhook,requestSyncpayRefund,recoverSyncpayEnrollment,syncpayPixAutomaticoConfigured,sealSyncpayCard,syncpayCardConfigured,getSyncpayRefundTracking,syncpayLegacyPixCheckoutConfigured } from './syncpay.js';
import { createStripeCheckoutSession,createStripeBillingPortal,getStripeBilling,handleStripeWebhook,stripeCheckoutConfigured,getStripeRefundPolicy,requestStripeRefund } from './stripe.js';
import { createHash,randomUUID,timingSafeEqual } from 'node:crypto';
import { rateLimit,rateLimitByUser } from './rate-limit.js';
import {dispatchPlatformPush,publicPushConfig,validPushEndpoint} from './platform-push.js';
import {dispatchAppointmentPush} from './appointment-push.js';
type Authenticator = typeof authenticate;

function serviceDb(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new ApiError(503,'SETUP_REQUIRED','A configuração segura do servidor ainda não foi concluída.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function cleanPhone(value:string){return value.trim().replace(/\s+/g,' ');}
function normalizeAccountPhone(value:string){
 const digits=value.replace(/\D/g,'');
 const normalized=digits.length===10||digits.length===11?`55${digits}`:digits;
 if(!/^55\d{10,11}$/.test(normalized))throw new ApiError(400,'INVALID_PHONE','Confira o telefone informado.');
 return normalized;
}
function publicStorageUrl(bucket:string,path:string){
 const base=process.env.SUPABASE_URL;
 return base?`${base}/storage/v1/object/public/${bucket}/${path}`:'';
}
function secureLog(requestId:string,error:unknown){
 // Never write headers, tokens, request bodies, database errors, or provider responses to logs.
 if(!(error instanceof ApiError)&&!(error instanceof ZodError))console.error(JSON.stringify({event:'api_error',requestId,status:500,code:'INTERNAL_ERROR'}));
}


function secureSecretEqual(a:string,b:string){
 const left=createHash('sha256').update(a).digest();
 const right=createHash('sha256').update(b).digest();
 return timingSafeEqual(left,right);
}

function normalizedOrigin(value:string|undefined){
 if(!value)return '';
 try{return new URL(value).origin.toLowerCase();}catch{return '';}
}

function allowedBrowserWriteOrigin(req:express.Request){
 if(['GET','HEAD','OPTIONS'].includes(req.method.toUpperCase()))return true;

 // SyncPay é servidor-servidor e possui validação própria de assinatura.
 if(req.originalUrl.startsWith('/api/webhooks/syncpay'))return true;
 if(req.originalUrl.startsWith('/api/webhooks/stripe'))return true;

 const rawOrigin=req.get('origin');
 if(!rawOrigin)return true;

 const origin=normalizedOrigin(rawOrigin);
 if(!origin)return false;

 const host=(req.get('x-forwarded-host')||req.get('host')||'')
  .split(',')[0].trim().toLowerCase();

 const proto=(req.get('x-forwarded-proto')||(req.secure?'https':'http'))
  .split(',')[0].trim().toLowerCase();

 const sameHost=host?normalizedOrigin(proto+'://'+host):'';

 const configured=(process.env.FIO_ALLOWED_ORIGINS??'')
  .split(',')
  .map(item=>normalizedOrigin(item.trim()))
  .filter(Boolean);

 const local=process.env.NODE_ENV==='production'
  ?[]
  :['http://localhost:5173','http://127.0.0.1:5173'];

 return [sameHost,...configured,...local]
  .filter(Boolean)
  .includes(origin);
}

export function createApp(authenticator: Authenticator=authenticate) {
 const app=express();
 app.disable('x-powered-by');
 app.use(helmet({referrerPolicy:{policy:'strict-origin-when-cross-origin'},strictTransportSecurity:process.env.NODE_ENV==='production'?undefined:false,contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",'https://challenges.cloudflare.com'],styleSrc:["'self'","'unsafe-inline'"],connectSrc:["'self'",'https://*.supabase.co','wss://*.supabase.co'],imgSrc:["'self'",'data:','blob:','https://*.supabase.co'],frameSrc:['https://challenges.cloudflare.com'],objectSrc:["'none'"],frameAncestors:["'none'"]}}}));
 app.use((_,res,next)=>{res.setHeader('X-Request-Id',randomUUID());res.setHeader('Cache-Control','no-store');next();});
 app.use('/api',(req,res,next)=>{
  if(!allowedBrowserWriteOrigin(req)){
   res.status(403).json({
    code:'ORIGIN_FORBIDDEN',
    message:'Origem não autorizada.'
   });
   return;
  }
  next();
 });
 app.use('/api',rateLimit('api-ingress',{windowMs:60_000,max:300}));
 // O webhook precisa do corpo bruto para validar a assinatura antes do JSON parser global.
 app.post('/api/webhooks/syncpay',express.raw({type:'*/*',limit:'64kb'}),async(req,res)=>handleSyncpayWebhook(req,res));
 app.post('/api/webhooks/stripe',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>handleStripeWebhook(req,res));
 app.use(express.json({limit:'12kb'}));
 app.get('/api/health',rateLimit('health',{windowMs:60_000,max:30}), (_req, res) =>res.set('Cache-Control','no-store').json({status:'ok'}));
 app.post('/api/internal/push/dispatch',rateLimit('push-dispatch',{windowMs:60_000,max:12}),async(req,res)=>{
  const expected=process.env.PUSH_DISPATCH_SECRET?.trim()??'';
  const authorization=req.get('authorization')??'';
  const token=authorization.startsWith('Bearer ')
   ?authorization.slice(7).trim()
   :'';

  if(
   !expected||
   !token||
   !secureSecretEqual(token,expected)
  ){
   res.status(401).json({
    code:'UNAUTHORIZED',
    message:'Acesso negado.'
   });
   return;
  }

  const db=serviceDb();

  const [platform,appointments]=await Promise.all([
   dispatchPlatformPush(db),
   dispatchAppointmentPush(db)
  ]);

  res.json({
   ok:true,
   platform,
   appointments
  });
 });

 app.get('/api/public/shop/:slug',rateLimit('public-shop',{windowMs:60_000,max:60}),async(req,res)=>{
  const slug=z.string().regex(/^[a-z0-9-]{3,60}$/).parse(req.params.slug),db=serviceDb();
  const shop=await db.from('barbershops').select('id,name,slug,operation_mode,public_title,public_description,logo_url,cover_url,background_url,accent_color,logo_asset_path,cover_asset_path,background_asset_path,theme_mode,palette_key,custom_accent,whatsapp,instagram,address').eq('slug',slug).eq('onboarding_completed',true).neq('platform_status','suspended').maybeSingle();dbError(shop.error);
  if(!shop.data) throw new ApiError(404,'NOT_FOUND','Barbearia não encontrada.');
  const [services,team,palette,billing]=await Promise.all([
   db.from('services').select('id,name,description,duration_minutes,price_cents').eq('barbershop_id',shop.data.id).eq('active',true).order('name'),
   db.from('memberships').select('user_id,display_name,role,avatar_url').eq('barbershop_id',shop.data.id).in('role',['OWNER','BARBER']).eq('active',true).order('display_name'),
   db.from('shop_palettes').select('*').eq('palette_key',shop.data.palette_key??'fio-black').maybeSingle(),
   db.from('saas_subscriptions').select('plan,status,expires_at').eq('barbershop_id',shop.data.id).maybeSingle()
  ]);dbError(services.error);dbError(team.error);dbError(palette.error);dbError(billing.error);
  const entitlement=billing.data&&['active','trialing','past_due'].includes(billing.data.status)&&(!billing.data.expires_at||new Date(billing.data.expires_at)>new Date());
  const publicPlans=entitlement&&['SOLO','SOLO_PREMIUM','PRO','PLUS','PREMIUM'].includes(billing.data?.plan??'')
   ?await db.from('subscription_plans').select('id,name,description,cuts,validity_days,price_cents,active').eq('barbershop_id',shop.data.id).eq('active',true).order('name')
   :{data:[],error:null};
  dbError(publicPlans.error);
  const asset=(path:string|null)=>path&&process.env.SUPABASE_URL?`${process.env.SUPABASE_URL}/storage/v1/object/public/branding-assets/${path}`:null;
  const instagram=shop.data.instagram?`@${String(shop.data.instagram).replace(/^@+/,'').trim()}`:null;
  res.set('Cache-Control','no-store').json({shop:{...shop.data,instagram,logo_url:shop.data.logo_url||asset(shop.data.logo_asset_path),cover_url:shop.data.cover_url||asset(shop.data.cover_asset_path),background_url:shop.data.background_url||asset(shop.data.background_asset_path)},palette:palette.data,services:services.data??[],team:team.data??[],subscriptionPlans:publicPlans.data??[]});
 });

 app.get('/api/public/share/:slug',rateLimit('public-share',{windowMs:60_000,max:60}),async(req,res)=>{
  const slug=z.string().regex(/^[a-z0-9-]{3,60}$/).parse(req.params.slug);
  const db=serviceDb();

  const shop=await db
   .from('barbershops')
   .select('name,public_title,public_description,logo_url,logo_asset_path,custom_accent,accent_color')
   .eq('slug',slug)
   .eq('onboarding_completed',true)
   .neq('platform_status','suspended')
   .maybeSingle();

  dbError(shop.error);

  if(!shop.data)
   throw new ApiError(404,'NOT_FOUND','Barbearia não encontrada.');

  const esc=(value:unknown)=>
   String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");

  const name=
   shop.data.public_title||
   shop.data.name;

  const description=
   shop.data.public_description||
   `Agende seu horário com ${name}.`;

  const image=
   shop.data.logo_url||
   (
    shop.data.logo_asset_path
     ?publicStorageUrl(
       'branding-assets',
       shop.data.logo_asset_path
      )
     :''
   );

  const accent=
   shop.data.custom_accent||
   shop.data.accent_color||
   '#000000';

  const proto=
   (
    req.get('x-forwarded-proto')||
    req.protocol||
    'https'
   )
    .split(',')[0]
    .trim();

  const host=
   (
    req.get('x-forwarded-host')||
    req.get('host')||
    ''
   )
    .split(',')[0]
    .trim();

  if(!host)
   throw new ApiError(
    503,
    'SHARE_PREVIEW_UNAVAILABLE',
    'Prévia temporariamente indisponível.'
   );

  const origin=`${proto}://${host}`;
  const canonical=`${origin}/${slug}`;

  let html='';

  try{
   html=readFileSync(
    resolve('dist/index.html'),
    'utf8'
   );
  }catch{
   const shell=await fetch(
    `${origin}/index.html`,
    {headers:{accept:'text/html'}}
   );

   if(!shell.ok)
    throw new ApiError(
     503,
     'SHARE_PREVIEW_UNAVAILABLE',
     'Prévia temporariamente indisponível.'
    );

   html=await shell.text();
  }

  html=html
   .replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${esc(name)} · Agendamento</title>`
   )
   .replace(
    /<meta\s+name="description"[\s\S]*?\/>/i,
    `<meta name="description" content="${esc(description)}" />`
   )
   .replace(
    /<meta\s+name="theme-color"[\s\S]*?\/>/i,
    `<meta name="theme-color" content="${esc(accent)}" />`
   );

  if(image){
   html=html
    .replace(
     /<link\s+rel="apple-touch-icon"[\s\S]*?\/>/i,
     `<link rel="apple-touch-icon" href="${esc(image)}" />`
    )
    .replace(
     /<link\s+rel="icon"[\s\S]*?\/>/i,
     `<link rel="icon" href="${esc(image)}" />`
    );
  }

  const social=[
   `<meta property="og:type" content="website" />`,
   `<meta property="og:title" content="${esc(name)}" />`,
   `<meta property="og:description" content="${esc(description)}" />`,
   `<meta property="og:url" content="${esc(canonical)}" />`,
   image
    ?`<meta property="og:image" content="${esc(image)}" />`
    :'',
   `<meta name="twitter:card" content="summary" />`,
   `<meta name="twitter:title" content="${esc(name)}" />`,
   `<meta name="twitter:description" content="${esc(description)}" />`,
   image
    ?`<meta name="twitter:image" content="${esc(image)}" />`
    :''
  ]
   .filter(Boolean)
   .join('\n    ');

  html=html.replace(
   '</head>',
   `    ${social}\n  </head>`
  );

  res
   .type('html')
   .set(
    'Cache-Control',
    'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
   )
   .send(html);
 });
 app.get('/api/public/manifest/:slug',rateLimit('public-manifest',{windowMs:60_000,max:30}),async(req,res)=>{
  const slug=z.string().regex(/^[a-z0-9-]{3,60}$/).parse(req.params.slug),db=serviceDb();
  const shop=await db.from('barbershops').select('name,public_title,logo_url,logo_asset_path,accent_color,custom_accent').eq('slug',slug).eq('onboarding_completed',true).neq('platform_status','suspended').maybeSingle();dbError(shop.error);
  if(!shop.data) throw new ApiError(404,'NOT_FOUND','Barbearia não encontrada.');
  const name=shop.data.public_title||shop.data.name;
  const icon=shop.data.logo_url||(shop.data.logo_asset_path&&process.env.SUPABASE_URL?`${process.env.SUPABASE_URL}/storage/v1/object/public/branding-assets/${shop.data.logo_asset_path}`:null);
  if(!icon) throw new ApiError(409,'SHOP_LOGO_REQUIRED','A barbearia precisa de uma logo antes de disponibilizar o aplicativo.');
  const theme=shop.data.custom_accent||shop.data.accent_color||'#000000';
  res.type('application/manifest+json').set('Cache-Control','no-store').send(JSON.stringify({id:`/client-app/${slug}`,name,short_name:name.slice(0,24),description:`Agendamentos e cuidados de ${name}.`,start_url:`/login?shop=${encodeURIComponent(slug)}&audience=client`,scope:'/',display:'standalone',background_color:'#000000',theme_color:theme,orientation:'portrait-primary',icons:[{src:icon,sizes:'any',purpose:'any'},{src:icon,sizes:'any',purpose:'maskable'}]}));
 });
 app.use('/api',async(req,res,next)=>{res.locals.auth=await authenticator(req);res.set('Cache-Control','private, no-store');next();});
 app.use('/api',rateLimitByUser('authenticated-api',60_000,180));
 app.get('/api/memberships',async(_req,res)=>{
  const a=res.locals.auth as AuthContext;

  const result=await a.db
   .from('memberships')
   .select('*')
   .eq('user_id',a.userId)
   .eq('active',true);

  dbError(result.error);

  const memberships=result.data??[];
  const shopIds=[
   ...new Set(
    memberships.map(item=>String(item.barbershop_id))
   )
  ];

  let brandByShop=new Map<string,{
   id:string;
   name:string;
   slug:string;
   logo_url:string|null;
   logo_asset_path:string|null;
  }>();

  if(shopIds.length){
   const brands=await serviceDb()
    .from('barbershops')
    .select('id,name,slug,logo_url,logo_asset_path')
    .in('id',shopIds);

   dbError(brands.error);

   brandByShop=new Map(
    (brands.data??[]).map(shop=>[
     String(shop.id),
     {
      id:String(shop.id),
      name:String(shop.name),
      slug:String(shop.slug),
      logo_url:shop.logo_url?String(shop.logo_url):null,
      logo_asset_path:shop.logo_asset_path?String(shop.logo_asset_path):null
     }
    ])
   );
  }

  res.json(
   memberships.map(item=>({
    ...item,
    shop_brand:brandByShop.get(String(item.barbershop_id))??null
   }))
  );
 });
 app.post('/api/onboarding',rateLimitByUser('onboarding',600_000,8),async(req,res)=>{
  const v=z.discriminatedUnion('mode',[
   z.object({mode:z.literal('create'),name:z.string().trim().min(2).max(100),slug:z.string().regex(/^[a-z0-9-]{3,60}$/),displayName:z.string().trim().min(2).max(100),phone:z.string().trim().min(8).max(24),operationMode:z.enum(['SHOP','SOLO']).default('SHOP')}).strict(),
   z.object({mode:z.literal('join'),slug:z.string().min(3).max(60),displayName:z.string().trim().min(2).max(100),phone:z.string().trim().min(8).max(24).optional()}).strict(),
   z.object({mode:z.literal('invite'),token:z.uuid(),displayName:z.string().trim().min(2).max(100)}).strict()
  ]).parse(req.body);
  const a=res.locals.auth as AuthContext;
   if(v.mode==='create'){const claimed=await a.db.rpc('claim_account_phone',{p_phone:v.phone});dbError(claimed.error);}
  const result=v.mode==='create'
   ?await a.db.rpc('create_workspace',{p_name:v.name,p_slug:v.slug,p_display_name:v.displayName,p_operation_mode:v.operationMode})
   :v.mode==='join'&&v.phone
    ?await a.db.rpc('join_barbershop_with_profile',{p_slug:v.slug,p_name:v.displayName,p_phone:v.phone})
    :v.mode==='join'
     ?await a.db.rpc('join_barbershop',{p_slug:v.slug,p_name:v.displayName})
     :await a.db.rpc('accept_invitation',{p_token:v.token,p_name:v.displayName});
  if(result.error?.message?.includes('PHONE_ALREADY_IN_USE'))throw new ApiError(409,'PHONE_ALREADY_IN_USE','Este telefone já está vinculado a outra conta FIO.');
  if(result.error?.message?.includes('INVALID_PHONE'))throw new ApiError(400,'INVALID_PHONE','Informe um WhatsApp/telefone válido.');
  dbError(result.error);res.status(201).json({barbershopId:result.data});
 });
 app.get('/api/onboarding/progress',async(req,res)=>{
  const a=res.locals.auth as AuthContext,c=await tenant(a,req);requireOwner(c);
  const [progress,shop,services,hours,amenities,palettes]=await Promise.all([
   a.db.from('onboarding_progress').select('*').eq('barbershop_id',c.shopId).maybeSingle(),
   a.db.from('barbershops').select('id,name,slug,timezone,operation_mode,public_title,public_description,logo_url,cover_url,background_url,accent_color,onboarding_step,onboarding_completed,whatsapp,instagram,address,theme_mode,palette_key,custom_accent,logo_asset_path,cover_asset_path,background_asset_path').eq('id',c.shopId).single(),
   a.db.from('services').select('id,name,description,duration_minutes,price_cents,active').eq('barbershop_id',c.shopId).order('name'),
   a.db.from('business_hours').select('weekday,opens_at,closes_at').eq('barbershop_id',c.shopId).order('weekday'),
   a.db.from('shop_amenities').select('amenity_key,enabled').eq('barbershop_id',c.shopId).eq('enabled',true),
   a.db.from('shop_palettes').select('*').order('palette_key')
  ]);[progress,shop,services,hours,amenities,palettes].forEach(r=>dbError(r.error));
  res.json({progress:progress.data,shop:shop.data,services:services.data??[],hours:hours.data??[],amenities:amenities.data?.map(x=>x.amenity_key)??[],palettes:palettes.data??[],owner:c.member});
 });
 app.post('/api/onboarding/setup',async(req,res)=>{
  const a=res.locals.auth as AuthContext,c=await tenant(a,req);requireOwner(c);
  const v=z.object({setup:z.object({name:z.string().trim().min(2).max(100).optional(),slug:z.string().regex(/^[a-z0-9-]{3,60}$/).optional(),whatsapp:z.string().trim().max(24).optional(),instagram:z.string().trim().max(120).optional(),address:z.string().trim().max(240).optional(),themeMode:z.enum(['light','dark']).optional(),paletteKey:z.string().regex(/^[a-z][a-z0-9-]{1,40}$/).optional(),customAccent:z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),amenities:z.array(z.string().regex(/^[a-z][a-z0-9-]{1,40}$/)).max(30).optional(),logoAssetPath:z.string().max(500).nullable().optional(),coverAssetPath:z.string().max(500).nullable().optional(),backgroundAssetPath:z.string().max(500).nullable().optional()}).strict(),step:z.number().int().min(1).max(5),completedSteps:z.array(z.number().int().min(1).max(5)).max(5),draft:z.record(z.string(),z.unknown()).default({})}).strict().parse(req.body);
  const saved=await a.db.rpc('save_owner_setup',{p_shop:c.shopId,p_setup:v.setup});dbError(saved.error);
  const progress=await a.db.rpc('save_onboarding_progress',{p_shop:c.shopId,p_step:v.step,p_completed:v.completedSteps,p_draft:v.draft});dbError(progress.error);res.json({ok:true});
 });
 app.post('/api/onboarding/services',async(req,res)=>{
  const a=res.locals.auth as AuthContext,c=await tenant(a,req);requireOwner(c);const v=z.object({id:z.uuid().optional(),name:z.string().trim().min(2).max(100),description:z.string().trim().max(500).default(''),durationMinutes:z.number().int().min(10).max(240),priceCents:z.number().int().min(0).max(1000000),active:z.boolean().default(true)}).strict().parse(req.body);
  const q=v.id?a.db.from('services').update({name:v.name,description:v.description||null,duration_minutes:v.durationMinutes,price_cents:v.priceCents,active:v.active}).eq('id',v.id).eq('barbershop_id',c.shopId):a.db.from('services').insert({barbershop_id:c.shopId,name:v.name,description:v.description||null,duration_minutes:v.durationMinutes,price_cents:v.priceCents});
  const r=await q.select().single();dbError(r.error);res.status(v.id?200:201).json(r.data);
 });
 app.post('/api/onboarding/hours',async(req,res)=>{
  const a=res.locals.auth as AuthContext,c=await tenant(a,req);requireOwner(c);
  const clock=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
  const legacy=z.object({weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(7),opensAt:clock,closesAt:clock,breakStart:clock.nullable().optional(),breakEnd:clock.nullable().optional()}).strict();
  const perDay=z.object({days:z.array(z.object({weekday:z.number().int().min(0).max(6),enabled:z.boolean(),opensAt:clock,closesAt:clock}).strict()).min(1).max(7)}).strict();
  const v=z.union([legacy,perDay]).parse(req.body);
  const rows='days' in v?v.days.filter(day=>day.enabled).map(day=>{
   if(day.opensAt>=day.closesAt)throw new ApiError(400,'INVALID_DATA',`Confira o horário do dia ${day.weekday}.`);
   return {barbershop_id:c.shopId,weekday:day.weekday,opens_at:day.opensAt,closes_at:day.closesAt};
  }):v.weekdays.map(weekday=>{
   if(v.opensAt>=v.closesAt)throw new ApiError(400,'INVALID_DATA','O fechamento deve ser depois da abertura.');
   return {barbershop_id:c.shopId,weekday,opens_at:v.opensAt,closes_at:v.closesAt};
  });
  if(!rows.length)throw new ApiError(400,'INVALID_DATA','Escolha pelo menos um dia de funcionamento.');
  if(new Set(rows.map(row=>row.weekday)).size!==rows.length)throw new ApiError(400,'INVALID_DATA','Cada dia deve aparecer apenas uma vez.');
  const r=await a.db.rpc('replace_business_hours',{p_shop:c.shopId,p_days:rows.map(({weekday,opens_at,closes_at})=>({weekday,opens_at,closes_at}))});dbError(r.error);res.json({ok:true});
 });
 app.post('/api/onboarding/activate',async(req,res)=>{const a=res.locals.auth as AuthContext,c=await tenant(a,req);requireOwner(c);const r=await a.db.rpc('activate_owner_onboarding',{p_shop:c.shopId});dbError(r.error);res.json({ok:true,shopId:c.shopId});});
 app.use('/api/platform',platformRouter());
 app.use('/api',async(req,res,next)=>{res.locals.ctx=await tenant(res.locals.auth,req);next();});
 const ctx=(res:express.Response)=>res.locals.ctx as TenantContext;
 app.get('/api/bootstrap',async(_req,res)=>res.json(await bootstrap(ctx(res))));
 app.post('/api/saas/trial',rateLimitByUser('trial',3_600_000,3),async(req,res)=>{
  const c=ctx(res);requireOwner(c);z.object({confirmed:z.literal(true)}).strict().parse(req.body);
  // A SyncPay ainda nao confirmou um checkout com autorizacao de cobranca apos 14 dias.
  // Nao habilitar renovacao silenciosa nem iniciar trial sem o mandato aceito.
  throw new ApiError(503,'TRIAL_PAYMENT_AUTH_REQUIRED','O teste com renovação automática depende da habilitação de cartão recorrente ou Pix Automático. Nenhuma cobrança será realizada sem sua autorização.');
 });
 app.post('/api/saas/stripe/checkout',rateLimitByUser('stripe-checkout',600_000,6),async(req,res)=>{
  const c=ctx(res);requireOwner(c);res.status(201).json(await createStripeCheckoutSession(c,req.body));
 });
 app.post('/api/saas/stripe/portal',rateLimitByUser('stripe-portal',600_000,8),async(req,res)=>{
  const c=ctx(res);requireOwner(c);res.json(await createStripeBillingPortal(c,req.body));
 });
 app.get('/api/saas/stripe/refund-policy',async(_req,res)=>{
  const c=ctx(res);requireOwner(c);res.json(await getStripeRefundPolicy(c));
 });
 app.post('/api/saas/stripe/refund',rateLimitByUser('stripe-refund',3600000,2),async(req,res)=>{
  const c=ctx(res);requireOwner(c);res.json(await requestStripeRefund(c,req.body));
 });
 app.post('/api/saas/syncpay/card-token',rateLimitByUser('billing-card-token',900_000,4),async(req,res)=>{const c=ctx(res);requireOwner(c);res.status(201).json(await sealSyncpayCard(c,req.body));});
 app.post('/api/saas/subscribe',rateLimitByUser('billing-subscribe',600_000,8),async(req,res)=>{
  const c=ctx(res);requireOwner(c);res.status(201).json(await createSyncpaySubscription(c,req.body));
 });
 app.post('/api/saas/recover-enrollment',rateLimitByUser('billing-recover',300_000,3),async(req,res)=>{const c=ctx(res);requireOwner(c);res.json(await recoverSyncpayEnrollment(c,req.body));});
 app.post('/api/saas/change-plan',rateLimitByUser('billing-change',600_000,3),async(req,res)=>{const c=ctx(res);requireOwner(c);res.json(await changeSyncpayPlan(c,req.body));});
 app.post('/api/saas/charge',rateLimitByUser('billing-charge',600_000,3),async(req,res)=>{const c=ctx(res);requireOwner(c);res.json(await manageSyncpayCharge(c,req.body));});
 app.post('/api/saas/refund',rateLimitByUser('billing-refund',3_600_000,2),async(req,res)=>{const c=ctx(res);requireOwner(c);res.json(await requestSyncpayRefund(c,req.body));});
 app.get('/api/saas/syncpay/refund-status',rateLimitByUser('billing-refund-status',60000,12),async(_req,res)=>{const c=ctx(res);requireOwner(c);res.json(await getSyncpayRefundTracking(c));});
 app.get('/api/saas/billing',async(_req,res)=>{
  const c=ctx(res);requireOwner(c);
  const stripe=await getStripeBilling(c);
  if(stripe){
   res.json({configured:false,stripeConfigured:stripeCheckoutConfigured(),pixAutomaticoConfigured:syncpayPixAutomaticoConfigured(),syncpayCardConfigured:syncpayCardConfigured(),legacyPixCheckoutConfigured:syncpayLegacyPixCheckoutConfigured(),subscription:stripe});
   return;
  }
  const billing=await getSyncpayBilling(c);
  res.json({...billing,stripeConfigured:stripeCheckoutConfigured(),pixAutomaticoConfigured:syncpayPixAutomaticoConfigured(),syncpayCardConfigured:syncpayCardConfigured(),legacyPixCheckoutConfigured:syncpayLegacyPixCheckoutConfigured()});
 });
 app.post('/api/services',async(req,res)=>{
  const c=ctx(res);requireOwner(c);
  const v=z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().max(500).default(''),duration_minutes:z.number().int().min(10).max(240),price_cents:z.number().int().min(0).max(1000000)}).strict().parse(req.body);
  const r=await c.db.from('services').insert({...v,barbershop_id:c.shopId}).select().single();dbError(r.error);res.status(201).json(r.data);
 });
 app.patch('/api/services/:id',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const id=z.uuid().parse(req.params.id);
  const v=z.object({name:z.string().trim().min(2).max(100).optional(),description:z.string().trim().max(500).optional(),duration_minutes:z.number().int().min(10).max(240).optional(),price_cents:z.number().int().min(0).max(1000000).optional(),active:z.boolean().optional()}).strict().parse(req.body);
  const r=await c.db.from('services').update(v).eq('id',id).eq('barbershop_id',c.shopId).select().single();dbError(r.error);res.json(r.data);
 });
 app.post('/api/customers',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({name:z.string().trim().min(2).max(100),phone:z.string().trim().min(8).max(24).optional()}).strict().parse(req.body);
  const r=await c.db.from('customers').insert({...v,phone:v.phone?cleanPhone(v.phone):null,barbershop_id:c.shopId}).select().single();dbError(r.error);res.status(201).json(r.data);
 });
 app.patch('/api/profile/contact',async(req,res)=>{
  const c=ctx(res),v=z.object({displayName:z.string().trim().min(2).max(100),phone:z.string().trim().max(24)}).strict().parse(req.body);
  const r=await c.db.rpc('update_own_profile',{p_shop:c.shopId,p_display_name:v.displayName,p_phone:v.phone});dbError(r.error);res.json({ok:true});
 });
 app.patch('/api/profile/avatar',async(req,res)=>{
  const c=ctx(res),v=z.object({avatarUrl:z.string().trim().max(700),avatarPath:z.string().trim().max(500)}).strict().parse(req.body);
  const expected=`${c.shopId}/${c.userId}/`;
  if(!v.avatarPath.startsWith(expected)||!/^avatar-\d{13}\.webp$/.test(v.avatarPath.slice(expected.length))||v.avatarUrl!==publicStorageUrl('profile-avatars',v.avatarPath))throw new ApiError(400,'INVALID_IMAGE','Não foi possível usar esta imagem.');
  const r=await c.db.rpc('update_own_avatar',{p_shop:c.shopId,p_avatar_url:v.avatarUrl,p_avatar_path:v.avatarPath});dbError(r.error);res.json({ok:true});
 });
 app.patch('/api/shop/branding',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({title:z.string().trim().max(100).default(''),description:z.string().trim().max(280).default(''),logoUrl:z.string().trim().max(500).default(''),coverUrl:z.string().trim().max(500).default(''),backgroundUrl:z.string().trim().max(500).default(''),accentColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#ffffff')}).strict().parse(req.body);
  const r=await c.db.rpc('update_shop_branding',{p_shop:c.shopId,p_title:v.title,p_description:v.description,p_logo_url:v.logoUrl,p_cover_url:v.coverUrl,p_background_url:v.backgroundUrl,p_accent_color:v.accentColor});dbError(r.error);
  const theme=await c.db.rpc('save_owner_setup',{p_shop:c.shopId,p_setup:{customAccent:v.accentColor}});dbError(theme.error);
  res.set('Cache-Control','no-store').json({ok:true});
 });
 app.get('/api/shop/closures',async(req,res)=>{
  const c=ctx(res);requireOwner(c);
  const v=z.object({from:z.iso.date(),to:z.iso.date()}).parse(req.query);
  if(v.to<v.from)throw new ApiError(400,'INVALID_DATA','Período inválido.');
  const r=await c.db.from('shop_closures').select('day').eq('barbershop_id',c.shopId).gte('day',v.from).lte('day',v.to).order('day');
  dbError(r.error);
  res.json({days:(r.data??[]).map(row=>String(row.day))});
 });
 app.post('/api/shop/closures',async(req,res)=>{
  const c=ctx(res);requireOwner(c);
  const v=z.object({days:z.array(z.iso.date()).min(1).max(30),confirmed:z.literal(true)}).strict().parse(req.body);
  const unique=[...new Set(v.days)];
  const rows=unique.map(day=>({barbershop_id:c.shopId,day,created_by:c.userId}));
  const r=await c.db.from('shop_closures').upsert(rows,{onConflict:'barbershop_id,day'});
  dbError(r.error);
  res.status(201).json({days:unique});
 });
 app.delete('/api/shop/closures/:day',async(req,res)=>{
  const c=ctx(res);requireOwner(c);
  const day=z.iso.date().parse(req.params.day);
  const r=await c.db.from('shop_closures').delete().eq('barbershop_id',c.shopId).eq('day',day);
  dbError(r.error);
  res.json({ok:true});
 });
 app.get('/api/staff/:id/access',rateLimitByUser('staff-access',60_000,15),async(req,res)=>{
  const c=ctx(res);requireOwner(c);const id=z.uuid().parse(req.params.id);
  const member=await c.db.from('memberships').select('user_id').eq('barbershop_id',c.shopId).eq('user_id',id).eq('role','BARBER').eq('active',true).maybeSingle();dbError(member.error);
  if(!member.data)throw new ApiError(404,'NOT_FOUND','Profissional não encontrado nesta barbearia.');
  const result=await serviceDb().auth.admin.getUserById(id);
  if(result.error||!result.data.user)throw new ApiError(404,'NOT_FOUND','Acesso não encontrado.');
  res.json({email:result.data.user.email??''});
 });
 app.post('/api/staff',rateLimitByUser('staff-provisioning',3_600_000,3),async(req,res)=>{
  const c=ctx(res);requireOwner(c);
  const v=z.object({name:z.string().trim().min(2).max(100),email:z.email().max(254),temporaryPassword:z.string().min(8).max(128),phone:z.string().trim().min(8).max(24)}).strict().parse(req.body);
  const admin=serviceDb();
  const created=await admin.auth.admin.createUser({email:v.email,password:v.temporaryPassword,email_confirm:true,user_metadata:{display_name:v.name}});
  if(created.error||!created.data.user) throw new ApiError(400,'STAFF_CREATE_FAILED','Não foi possível criar o acesso. Confira se o e-mail já está em uso.');
  const userId=created.data.user.id;
   const phoneClaim=await admin.from('account_phone_registry').insert({user_id:userId,phone_e164:normalizeAccountPhone(v.phone)});
   if(phoneClaim.error){
    await admin.auth.admin.deleteUser(userId);
    if(phoneClaim.error.code==='23505')throw new ApiError(409,'PHONE_ALREADY_IN_USE','Este telefone já está vinculado a outra conta FIO.');
    dbError(phoneClaim.error);
   }
  const membership=await admin.rpc('platform_attach_provisioned_staff',{p_shop:c.shopId,p_user:userId,p_name:v.name,p_phone:cleanPhone(v.phone),p_actor:c.userId});
  if(membership.error){await admin.auth.admin.deleteUser(userId);dbError(membership.error);}
  res.status(201).json({userId});
 });
 app.post('/api/reviews',async(req,res)=>{
  const c=ctx(res),v=z.object({appointmentId:z.uuid(),rating:z.number().int().min(1).max(5),comment:z.string().trim().max(1000).default('')}).strict().parse(req.body);
  const r=await c.db.rpc('submit_review',{p_shop:c.shopId,p_appointment:v.appointmentId,p_rating:v.rating,p_comment:v.comment});dbError(r.error);res.status(201).json({id:r.data});
 });
 app.get('/api/slots/month',async(req,res)=>{
  const c=ctx(res);
  const v=z.object({
   barberId:z.union([z.uuid(),z.literal('any')]),
   serviceId:z.uuid(),
   monthStart:z.iso.date()
  }).parse(req.query);

  const r=await c.db.rpc('calendar_day_availability',{
   p_shop:c.shopId,
   p_barber:v.barberId==='any'?null:v.barberId,
   p_service:v.serviceId,
   p_month:v.monthStart
  });
  dbError(r.error);
  res.json(r.data??[]);
 });
 app.get('/api/slots',async(req,res)=>{
  const c=ctx(res);const v=z.object({barberId:z.union([z.uuid(),z.literal('any')]),serviceId:z.uuid(),day:z.iso.date()}).parse(req.query);
  const r=await c.db.rpc('available_slots',{p_shop:c.shopId,p_barber:v.barberId==='any'?null:v.barberId,p_service:v.serviceId,p_day:v.day});dbError(r.error);res.json(r.data);
 });
 app.post('/api/appointments',rateLimitByUser('appointment-create',60_000,20),async(req,res)=>{
  const c=ctx(res),v=bookingSchema.parse(req.body);
  if(c.member.role==='BARBER')throw new ApiError(403,'FORBIDDEN','Profissionais gerenciam a agenda, mas não criam agendamentos para clientes.');
  if(c.member.role==='OWNER'){
   const shop=await c.db.from('barbershops').select('operation_mode').eq('id',c.shopId).single();
   dbError(shop.error);
   if(!shop.data)throw new ApiError(404,'NOT_FOUND','Barbearia não encontrada.');
   if(shop.data.operation_mode==='SOLO')throw new ApiError(403,'FORBIDDEN','No modo solo, novos agendamentos são criados pelo cliente.');
  }
  const r=await c.db.rpc('book_appointment',{p_shop:c.shopId,p_client:v.clientId,p_barber:v.barberId,p_service:v.serviceId,p_start:v.startsAt,p_use_subscription:v.useSubscription});dbError(r.error);
  const assigned=await c.db.from('appointments').select('barber_id').eq('barbershop_id',c.shopId).eq('id',r.data).maybeSingle();
  res.status(201).json({id:r.data,barberId:assigned.data?.barber_id??null});
 });
 app.get('/api/appointments/period',async(req,res)=>{
  const c=ctx(res),v=z.object({from:z.iso.date(),to:z.iso.date(),barberId:z.uuid().optional()}).parse(req.query);
  const r=await c.db.rpc('appointment_period',{p_shop:c.shopId,p_from:v.from,p_to:v.to,p_barber:v.barberId??null});dbError(r.error);res.json(r.data);
 });
 // Histórico paginado: apenas proprietário e profissionais da própria barbearia.
 // Nunca excluir registros antigos só para deixar a agenda leve.
 app.get('/api/appointments/history',rateLimitByUser('appointment-history',60_000,30),async(req,res)=>{
  const c=ctx(res);
  if(!['OWNER','BARBER'].includes(c.member.role))throw new ApiError(403,'FORBIDDEN','Histórico disponível apenas para o profissional.');
  const input=z.object({month:z.string().regex(/^(20\d{2})-(0[1-9]|1[0-2])$/),offset:z.coerce.number().int().min(0).max(50000).default(0)}).strict().parse(req.query);
  const shop=await c.db.from('barbershops').select('timezone').eq('id',c.shopId).single();dbError(shop.error);
  const zone=shop.data?.timezone||'America/Sao_Paulo';
  const [year,month]=input.month.split('-').map(Number);
  // A meia-noite da barbearia, inclusive em fusos diferentes de UTC.
  const localMidnight=(y:number,m:number)=>{
   const naive=Date.UTC(y,m-1,1);
   let value=naive;
   for(let i=0;i<3;i++){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(new Date(value));
    const raw=parts.find(part=>part.type==='timeZoneName')?.value||'GMT';
    const match=raw.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    const mins=match?(match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]||0)):0;
    value=naive-mins*60000;
   }
   return new Date(value).toISOString();
  };
  let query=c.db.from('appointments')
   .select('id,client_id,barber_id,service_id,starts_at,ends_at,status,price_cents,subscription_id',{count:'exact'})
   .eq('barbershop_id',c.shopId)
   .gte('starts_at',localMidnight(year,month))
   .lt('starts_at',localMidnight(year,month+1));
  if(c.member.role==='BARBER')query=query.eq('barber_id',c.userId);
  const page=await query.order('starts_at',{ascending:false}).order('id',{ascending:false}).range(input.offset,input.offset+99);
  dbError(page.error);
  const appointments=page.data??[];
  const clientIds=[...new Set(appointments.map(a=>a.client_id).filter(Boolean))];
  const serviceIds=[...new Set(appointments.map(a=>a.service_id).filter(Boolean))];
  const [clients,services]=await Promise.all([
   clientIds.length?c.db.from('customers').select('id,name').eq('barbershop_id',c.shopId).in('id',clientIds):Promise.resolve({data:[],error:null}),
   serviceIds.length?c.db.from('services').select('id,name').eq('barbershop_id',c.shopId).in('id',serviceIds):Promise.resolve({data:[],error:null})
  ]);
  dbError(clients.error);dbError(services.error);
  const clientNames=new Map((clients.data??[]).map(item=>[item.id,item.name]));
  const serviceNames=new Map((services.data??[]).map(item=>[item.id,item.name]));
  res.json({total:page.count??0,items:appointments.map(a=>({...a,customer_name:clientNames.get(a.client_id)??'Cliente',service_name:serviceNames.get(a.service_id)??'Serviço'}))});
 });
 app.post('/api/appointments/:id/reschedule',rateLimitByUser('appointment-reschedule',60_000,20),async(req,res)=>{
  const c=ctx(res),id=z.uuid().parse(req.params.id),v=z.object({startsAt:z.iso.datetime({offset:true}),confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('reschedule_appointment',{p_shop:c.shopId,p_id:id,p_start:v.startsAt});dbError(r.error);res.json({ok:true});
 });
 app.get('/api/staff-schedule',async(_req,res)=>{
  const c=ctx(res);requireOwner(c);
  const [hours,blocks,rules]=await Promise.all(['staff_hours','staff_blocks','staff_service_rules'].map(table=>c.db.from(table).select('*').eq('barbershop_id',c.shopId)));
  [hours,blocks,rules].forEach(r=>dbError(r.error));res.json({hours:hours.data,blocks:blocks.data,rules:rules.data});
 });
 app.post('/api/staff-schedule',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({barberId:z.uuid(),hours:z.array(z.object({weekday:z.number().int().min(0).max(6),opens_at:z.string().regex(/^\d{2}:\d{2}$/),closes_at:z.string().regex(/^\d{2}:\d{2}$/)}).strict()).max(28),disabledServices:z.array(z.uuid()).max(500)}).strict().parse(req.body);
  const r=await c.db.rpc('configure_staff_schedule',{p_shop:c.shopId,p_barber:v.barberId,p_hours:v.hours,p_disabled_services:v.disabledServices});dbError(r.error);res.json({ok:true});
 });
 app.post('/api/staff-blocks',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({barberId:z.uuid(),startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true})}).strict().parse(req.body);
  const r=await c.db.rpc('add_staff_block',{p_shop:c.shopId,p_barber:v.barberId,p_start:v.startsAt,p_end:v.endsAt});dbError(r.error);res.json({id:r.data});
 });
 app.delete('/api/staff-blocks/:id',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const r=await c.db.from('staff_blocks').delete().eq('barbershop_id',c.shopId).eq('id',z.uuid().parse(req.params.id));dbError(r.error);res.json({ok:true});
 });
 app.get('/api/appointments/:id',async(req,res)=>{const c=ctx(res);const r=await c.db.from('appointments').select('id,client_id,barber_id,service_id,starts_at,ends_at,status,price_cents,subscription_id').eq('barbershop_id',c.shopId).eq('id',z.uuid().parse(req.params.id)).maybeSingle();dbError(r.error);if(!r.data)throw new ApiError(404,'NOT_FOUND','Agendamento não encontrado no seu acesso.');res.json(r.data);});
 app.get('/api/push/config',async(_req,res)=>res.json(publicPushConfig()));
 app.get('/api/push/preferences',async(_req,res)=>{const c=ctx(res);const r=await c.db.from('appointment_push_devices').select('endpoint,enabled,changes,reminders').eq('barbershop_id',c.shopId).eq('user_id',c.userId);dbError(r.error);res.json(r.data);});
 app.post('/api/push/devices',rateLimitByUser('push',60_000,10),async(req,res)=>{
  const c=ctx(res),v=z.object({optIn:z.literal(true),endpoint:z.string().max(2048).refine(validPushEndpoint),keys:z.object({p256dh:z.string(),auth:z.string()}).strict(),changes:z.boolean(),reminders:z.boolean()}).strict().parse(req.body);
  const r=await c.db.rpc('register_appointment_push',{p_shop:c.shopId,p_endpoint:v.endpoint,p_keys:v.keys,p_changes:v.changes,p_reminders:v.reminders});dbError(r.error);res.json({ok:true});
 });
 app.delete('/api/push/devices',async(req,res)=>{
  const c=ctx(res),v=z.object({endpoint:z.string().max(2048)}).strict().parse(req.body);const r=await c.db.rpc('disable_appointment_push',{p_shop:c.shopId,p_endpoint:v.endpoint});dbError(r.error);res.json({ok:true});
 });
 app.patch('/api/appointments/:id',rateLimitByUser('appointment-status',60_000,30),async(req,res)=>{
  const c=ctx(res),id=z.uuid().parse(req.params.id),v=z.object({status:z.enum(['confirmed','in_service','completed','cancelled','no_show']),confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('transition_appointment',{p_shop:c.shopId,p_id:id,p_status:v.status});dbError(r.error);res.json({ok:true});
 });
 app.post('/api/invitations',rateLimitByUser('invitations',600_000,10),async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({role:z.enum(['BARBER','CLIENT'])}).strict().parse(req.body);
  const r=await c.db.rpc('create_invitation',{p_shop:c.shopId,p_role:v.role});dbError(r.error);res.status(201).json({token:r.data});
 });
 app.post('/api/subscriptions',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const v=z.object({clientId:z.uuid(),name:z.string().trim().min(2).max(100),cuts:z.number().int().min(1).max(1000),expiresAt:z.iso.datetime({offset:true}),confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('issue_subscription',{p_shop:c.shopId,p_client:v.clientId,p_name:v.name,p_cuts:v.cuts,p_expires:v.expiresAt});dbError(r.error);res.status(201).json({id:r.data});
 });
 app.post('/api/subscription-plans',async(req,res)=>{
  const c=ctx(res);requireOwner(c);requireFioFeature(c,'client_plans');const v=z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().max(700).default(''),cuts:z.number().int().min(1).max(1000),validityDays:z.number().int().min(1).max(730),priceCents:z.number().int().min(0).max(10000000)}).strict().parse(req.body);
  const r=await c.db.from('subscription_plans').insert({barbershop_id:c.shopId,name:v.name,description:v.description||null,cuts:v.cuts,validity_days:v.validityDays,price_cents:v.priceCents}).select().single();dbError(r.error);res.status(201).json(r.data);
 });
 app.post('/api/subscriptions/from-plan',async(req,res)=>{
  const c=ctx(res);requireOwner(c);requireFioFeature(c,'client_plans');const v=z.object({clientId:z.uuid(),planId:z.uuid(),confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('issue_subscription_from_plan',{p_shop:c.shopId,p_client:v.clientId,p_plan:v.planId});dbError(r.error);res.status(201).json({id:r.data});
 });
 app.patch('/api/subscriptions/:id/cancel',async(req,res)=>{
  const c=ctx(res);requireOwner(c);const id=z.uuid().parse(req.params.id);z.object({confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('cancel_subscription',{p_shop:c.shopId,p_subscription:id});dbError(r.error);res.json({ok:true});
 });
 app.post('/api/campaigns',async(req,res)=>{
  const c=ctx(res);requireOwner(c);await requireFioFeature(c,'communication');const v=z.object({title:z.string().trim().min(2).max(120),body:z.string().trim().min(1).max(1000),audience:z.enum(['CLIENT','BARBER','ALL']).default('CLIENT')}).strict().parse(req.body);
  const r=await c.db.from('campaigns').insert({barbershop_id:c.shopId,created_by:c.userId,title:v.title,body:v.body,audience:v.audience,status:'draft'}).select().single();dbError(r.error);res.status(201).json(r.data);
 });
 app.post('/api/campaigns/:id/publish',async(req,res)=>{
  const c=ctx(res);requireOwner(c);await requireFioFeature(c,'communication');const id=z.uuid().parse(req.params.id);z.object({confirmed:z.literal(true)}).strict().parse(req.body);
  const r=await c.db.rpc('publish_campaign',{p_shop:c.shopId,p_campaign:id});dbError(r.error);res.json({ok:true});
 });
 app.patch('/api/notifications/:id/read',async(req,res)=>{
  const c=ctx(res),id=z.uuid().parse(req.params.id);
  const r=await c.db.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('barbershop_id',c.shopId).eq('user_id',c.userId);dbError(r.error);res.json({ok:true});
 });
 app.get('/api/feed/professionals',async(_req,res)=>{
  const c=ctx(res);requireFioFeature(c,'feed');
  const r=await c.db.rpc('feed_professional_profiles',{p_shop:c.shopId});
  dbError(r.error);res.json(r.data??[]);
 });
 app.post('/api/posts',rateLimitByUser('feed-posts',600_000,12),async(req,res)=>{
  const c=ctx(res);requireFioFeature(c,'feed');
  if(!['OWNER','BARBER'].includes(c.member.role)) throw new ApiError(403,'FORBIDDEN','Somente a equipe pode publicar no feed.');
  const v=z.object({caption:z.string().trim().max(500).default(''),imagePath:z.string().min(5).max(500)}).strict().parse(req.body);
  const expected=`${c.shopId}/${c.userId}/`;
  if(!v.imagePath.startsWith(expected)||! /^[0-9a-f-]{36}\.webp$/i.test(v.imagePath.slice(expected.length))) throw new ApiError(400,'INVALID_IMAGE','O arquivo enviado não pertence a este perfil.');
  const r=await c.db.from('feed_posts').insert({barbershop_id:c.shopId,author_id:c.userId,author_name:c.member.display_name,caption:v.caption,image_path:v.imagePath}).select('id,author_id,author_name,caption,image_path,created_at').single();
  dbError(r.error);res.status(201).json(r.data);
 });
 app.delete('/api/posts/:id',async(req,res)=>{
  const c=ctx(res),id=z.uuid().parse(req.params.id);requireFioFeature(c,'feed');
  if(!['OWNER','BARBER'].includes(c.member.role)) throw new ApiError(403,'FORBIDDEN','Somente a equipe pode remover publicações.');
  const existing=await c.db.from('feed_posts').select('id,author_id,image_path').eq('id',id).eq('barbershop_id',c.shopId).maybeSingle();dbError(existing.error);
  if(!existing.data) throw new ApiError(404,'NOT_FOUND','Publicação não encontrada.');
  if(c.member.role!=='OWNER'&&existing.data.author_id!==c.userId) throw new ApiError(403,'FORBIDDEN','Você só pode remover suas próprias publicações.');
  const r=await c.db.from('feed_posts').delete().eq('id',id).eq('barbershop_id',c.shopId);dbError(r.error);res.json({ok:true,imagePath:existing.data.image_path});
 });
 app.post('/api/support/feedback',rateLimitByUser('feedback',600_000,5),async(req,res)=>{
  const c=ctx(res),v=z.object({category:z.enum(['feedback','problem','question']),message:z.string().trim().min(3).max(1500)}).strict().parse(req.body);
  const r=await c.db.from('support_feedback').insert({barbershop_id:c.shopId,user_id:c.userId,role:c.member.role,category:v.category,message:v.message});dbError(r.error);res.status(201).json({ok:true});
 });
 app.get('/api/conversations',async(_req,res)=>{
  const c=ctx(res);if(c.member.role==='CLIENT')throw new ApiError(403,'FORBIDDEN','Assistente disponível apenas para a equipe.');requireFioFeature(c,'assistant');const r=await c.db.from('assistant_conversations').select('id,title,created_at').eq('barbershop_id',c.shopId).eq('user_id',c.userId).order('created_at',{ascending:false}).limit(50);dbError(r.error);res.json(r.data);
 });
 app.get('/api/conversations/:id',async(req,res)=>{
  const c=ctx(res),id=z.uuid().parse(req.params.id);if(c.member.role==='CLIENT')throw new ApiError(403,'FORBIDDEN','Assistente disponível apenas para a equipe.');requireFioFeature(c,'assistant');
  const r=await c.db.from('assistant_messages').select('id,role,content').eq('conversation_id',id).eq('barbershop_id',c.shopId).eq('user_id',c.userId).order('created_at').limit(200);dbError(r.error);res.json(r.data);
 });
 app.post('/api/assistant',rateLimitByUser('assistant',60_000,12),async(req,res)=>{const c=ctx(res);if(c.member.role==='CLIENT')throw new ApiError(403,'FORBIDDEN','Assistente disponível apenas para a equipe.');requireFioFeature(c,'assistant');res.json(await askAssistant(c,req.body));});
 app.use('/api',(_req,res)=>res.status(404).json({code:'NOT_FOUND',message:'Recurso não encontrado.'}));
 if(process.env.NODE_ENV==='production') {
  const reservedPublicSlugs=new Set([
   'owner',
   'barber',
   'client',
   'login',
   'reset-password',
   'confirm-email',
   'privacidade',
   'termos',
   'acesso',
   'b',
   'barbearia',
   'platform',
   'api'
  ]);

  app.get('/:publicSlug',async(req,res,next)=>{
   const slug=String(req.params.publicSlug??'').toLowerCase();

   if(
    reservedPublicSlugs.has(slug)||
    !/^[a-z0-9-]{3,60}$/.test(slug)
   ){
    next();
    return;
   }

   const db=serviceDb();

   const shop=await db
    .from('barbershops')
    .select(
     'name,public_title,public_description,logo_url,logo_asset_path,custom_accent,accent_color'
    )
    .eq('slug',slug)
    .eq('onboarding_completed',true)
    .neq('platform_status','suspended')
    .maybeSingle();

   dbError(shop.error);

   if(!shop.data){
    next();
    return;
   }

   const esc=(value:unknown)=>
    String(value??'')
     .replaceAll('&','&amp;')
     .replaceAll('<','&lt;')
     .replaceAll('>','&gt;')
     .replaceAll('"','&quot;')
     .replaceAll("'","&#39;");

   const name=
    shop.data.public_title||
    shop.data.name;

   const description=
    shop.data.public_description||
    `Agende seu horário com ${name}.`;

   const rawImage=
    shop.data.logo_url||
    (
     shop.data.logo_asset_path
      ?publicStorageUrl(
       'branding-assets',
       shop.data.logo_asset_path
      )
      :''
    );

   const proto=
    (
     req.get('x-forwarded-proto')||
     (req.secure?'https':'http')
    )
     .split(',')[0]
     .trim();

   const host=
    (
     req.get('x-forwarded-host')||
     req.get('host')||
     ''
    )
     .split(',')[0]
     .trim();

   const canonical=
    host
     ?`${proto}://${host}/${slug}`
     :`/${slug}`;

   const image=
    rawImage&&/^https?:\/\//i.test(rawImage)
     ?rawImage
     :rawImage&&host
      ?`${proto}://${host}${rawImage.startsWith('/')?'':'/'}${rawImage}`
      :rawImage;

   const accent=
    shop.data.custom_accent||
    shop.data.accent_color||
    '#000000';

   let html=
    readFileSync(
     resolve('dist/index.html'),
     'utf8'
    );

   html=html
    .replace(
     /<title>[\s\S]*?<\/title>/i,
     `<title>${esc(name)} · Agendamento</title>`
    )
    .replace(
     /<meta\s+name="description"[\s\S]*?\/>/i,
     `<meta name="description" content="${esc(description)}" />`
    )
    .replace(
     /<meta\s+name="theme-color"[\s\S]*?\/>/i,
     `<meta name="theme-color" content="${esc(accent)}" />`
    );

   if(image){
    html=html
     .replace(
      /<link\s+rel="apple-touch-icon"[\s\S]*?\/>/i,
      `<link rel="apple-touch-icon" href="${esc(image)}" />`
     )
     .replace(
      /<link\s+rel="icon"[\s\S]*?\/>/i,
      `<link rel="icon" href="${esc(image)}" />`
     );
   }

   const social=[
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(name)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    image
     ?`<meta property="og:image" content="${esc(image)}" />`
     :'',
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(name)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    image
     ?`<meta name="twitter:image" content="${esc(image)}" />`
     :''
   ]
    .filter(Boolean)
    .join('\n    ');

   html=html.replace(
    '</head>',
    `    ${social}\n  </head>`
   );

   res
    .type('html')
    .set('Cache-Control','no-store')
    .send(html);
  });

  app.use(express.static(resolve('dist')));
  app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));
 }
 app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  const parserError=error as {type?:string};
  if(parserError?.type==='entity.too.large'){res.status(413).json({code:'PAYLOAD_TOO_LARGE',message:'O conteúdo enviado excede o limite permitido.'});return;}
  if(parserError?.type==='entity.parse.failed'){res.status(400).json({code:'INVALID_JSON',message:'O conteúdo enviado é inválido.'});return;}
  secureLog(String(res.getHeader('X-Request-Id')??''),error);
  if(error instanceof ZodError) {res.status(400).json({code:'INVALID_INPUT',message:'Confira os campos informados.'});return;}
  if(error instanceof ApiError) {if(error.status===429&&!res.hasHeader('Retry-After'))res.setHeader('Retry-After',error.code==='DAILY_LIMIT'?'86400':'60');res.status(error.status).json({code:error.code,message:error.message});return;}
  res.status(500).json({code:'INTERNAL_ERROR',message:'Não foi possível concluir. Tente novamente.'});
 });
 return app;
}
