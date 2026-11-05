import {describe,expect,it,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {diagnoseCreditCardPermission} from '../server/syncpay';
afterEach(()=>vi.unstubAllEnvs());
function fake(createStatus:number,archiveStatus=204){
 const seen:string[]=[];const bodies:string[]=[];
 const fetcher=vi.fn(async (input:URL|string|Request,opts?:RequestInit)=>{
  const url=String(input);const method=opts?.method||'GET';seen.push(method+' '+url);
  if(url.endsWith('/auth-token'))return new Response(JSON.stringify({access_token:'a'.repeat(32),expires_in:3600}),{status:200,headers:{'content-type':'application/json'}});
  if(method==='POST'&&url.endsWith('/subscription-plans')){bodies.push(String(opts?.body));return new Response(JSON.stringify(createStatus===201?{data:{token:'card_diag_12345'}}:{message:'Cartão indisponível para a conta'}),{status:createStatus});}
  if(method==='DELETE'&&url.endsWith('/subscription-plans/card_diag_12345'))return new Response(archiveStatus===204?null:'error',{status:archiveStatus});
  throw Error('Unexpected mock provider request');
 });
 return {fetcher,seen,bodies};
}
describe('diagnostico de permissao de cartao SyncPay',()=>{
 it('cria plano credit_card, arquiva e so entao confirma',async()=>{
  vi.stubEnv('SYNCPAY_CLIENT_ID','testing');vi.stubEnv('SYNCPAY_CLIENT_SECRET','testing');
  const x=fake(201);
  expect(await diagnoseCreditCardPermission(x.fetcher as typeof fetch)).toMatchObject({status:'capability_confirmed',createHttp:201,archiveHttp:204});
  expect(JSON.parse(x.bodies[0]).billing_method).toBe('credit_card');
  expect(x.seen.every(s=>!s.includes('/enroll')&&!s.includes('/credit-card'))).toBe(true);
 });
 it('422 da SyncPay mantem o cartao desligado',async()=>{
  vi.stubEnv('SYNCPAY_CLIENT_ID','testing');vi.stubEnv('SYNCPAY_CLIENT_SECRET','testing');
  const x=fake(422);
  expect(await diagnoseCreditCardPermission(x.fetcher as typeof fetch)).toMatchObject({status:'permission_not_confirmed',createHttp:422});
  expect(x.seen).toHaveLength(2);
 });
 it('rota fica restrita ao admin da plataforma',()=>{
  const app=readFileSync('server/app.ts','utf8');
  const start=app.indexOf("app.post('/api/platform/card-probe'");
  expect(start).toBeGreaterThan(-1);
  expect(app.slice(start,start+300)).toContain('await requirePlatformAdmin(res.locals.auth as AuthContext);');
  expect(start).toBeLessThan(app.indexOf("app.use('/api/platform',platformRouter())"));
 });
});
