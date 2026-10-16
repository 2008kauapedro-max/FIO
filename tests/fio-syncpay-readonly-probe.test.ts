import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {diagnoseSyncpayAnnualReadonly,rejectAnnualDiagnosticWrite} from '../server/fio-syncpay-readonly-probe.js';

afterEach(()=>vi.unstubAllEnvs());
function credentials(){vi.stubEnv('SYNCPAY_CLIENT_ID','test-id');vi.stubEnv('SYNCPAY_CLIENT_SECRET','very-private-test-secret');}
function makeFetch(authStatus=200,routeStatus=404){
 const calls:{url:string;method:string;authorization?:string;redirect?:RequestRedirect;body?:BodyInit|null}[]=[];
 const fn=vi.fn(async (url:URL|string|Request,init?:RequestInit)=>{
  const route=String(url),method=init?.method??'GET';
  calls.push({url:route,method,authorization:new Headers(init?.headers).get('authorization')??undefined,redirect:init?.redirect,body:init?.body});
  if(route.endsWith('/auth-token'))return new Response(authStatus===200?JSON.stringify({access_token:'top-secret-provider-token'}):'unauthorized',{status:authStatus,headers:{'Content-Type':'application/json'}});
  return new Response('PRIVATE PROVIDER RESPONSE',{status:routeStatus});
 });
 return {fetcher:fn as typeof fetch,calls};
}
describe('SyncPay annual read-only probe V6',()=>{
 it('sem credenciais nao acessa nenhum endpoint',async()=>{
  vi.stubEnv('SYNCPAY_CLIENT_ID','');vi.stubEnv('SYNCPAY_CLIENT_SECRET','');
  const m=makeFetch();const r=await diagnoseSyncpayAnnualReadonly(m.fetcher);
  expect(r).toMatchObject({status:'not_configured',checks:[]});expect(m.calls).toHaveLength(0);
 });
 it('autenticacao rejeitada nao envia token nem realiza outras requisicoes',async()=>{
  credentials();const m=makeFetch(401);
  expect(await diagnoseSyncpayAnnualReadonly(m.fetcher)).toMatchObject({status:'auth_rejected',authHttp:401,checks:[]});
  expect(m.calls).toHaveLength(1);
 });
 it('so POST de auth, GET e OPTIONS nas rotas fixas, nunca cria pedido',async()=>{
  credentials();const m=makeFetch();const r=await diagnoseSyncpayAnnualReadonly(m.fetcher);
  expect(r.status).toBe('completed');expect(r.checks).toHaveLength(5);
  expect(m.calls[0].method).toBe('POST');expect(m.calls[0].url.endsWith('/auth-token')).toBe(true);
  expect(m.calls.slice(1).every(x=>['GET','OPTIONS'].includes(x.method)&&x.url.startsWith('https://api.syncpayments.com.br/'))).toBe(true);
  expect(m.calls.every(x=>x.redirect==='manual')).toBe(true);
 });
 it('nao retorna token, segredo, corpos do provedor nem seus headers',async()=>{
  credentials();const m=makeFetch();const r=await diagnoseSyncpayAnnualReadonly(m.fetcher);
  const output=JSON.stringify(r);
  for(const text of ['very-private-test-secret','top-secret-provider-token','PRIVATE PROVIDER RESPONSE','test-id'])expect(output).not.toContain(text);
 });
 it('nao segue redirecionamentos do provedor',async()=>{
  credentials();const m=makeFetch(200,302);const r=await diagnoseSyncpayAnnualReadonly(m.fetcher);
  expect(r.checks.every(x=>x.meaning==='redirect_not_followed')).toBe(true);
 });
 it('404 por GET/OPTIONS nao confirma ausencia do POST',async()=>{
  credentials();const m=makeFetch();const r=await diagnoseSyncpayAnnualReadonly(m.fetcher);
  expect(r.note).toContain('nao confirma que POST /orders funciona');
  expect(r.checks.filter(x=>x.http===404).every(x=>x.meaning==='not_found_for_method')).toBe(true);
 });
 it('resposta auth com token invalido interrompe sem chamadas GET',async()=>{
  credentials();const m=makeFetch();
  const fetcher=vi.fn(async(url:URL|string|Request,options?:RequestInit)=>{
   if(String(url).endsWith('/auth-token'))return new Response('{"access_token":"x"}',{status:200});
   return m.fetcher(url,options);
  }) as typeof fetch;
  expect(await diagnoseSyncpayAnnualReadonly(fetcher)).toMatchObject({status:'auth_invalid_response',checks:[]});
  expect(m.calls).toHaveLength(0);
 });
 it('falhas de rede sao retornadas sem detalhes sigilosos',async()=>{
  credentials();let n=0;
  const fetcher=vi.fn(async()=>{
   n++;
   if(n===1)return new Response(JSON.stringify({access_token:'valid-token-abcdef'}),{status:200});
   throw new Error('PRIVATE ERROR WITH TOKENS');
  }) as typeof fetch;
  const r=await diagnoseSyncpayAnnualReadonly(fetcher);
  expect(r.checks.every(x=>x.http===null&&x.meaning==='network_error')).toBe(true);
  expect(JSON.stringify(r)).not.toContain('PRIVATE ERROR');
 });
 it('metodo de escrita e proibido em qualquer outro probe de pedidos',()=>{
  expect(()=>rejectAnnualDiagnosticWrite('POST')).toThrow();
  expect(()=>rejectAnnualDiagnosticWrite('PATCH')).toThrow();
  expect(()=>rejectAnnualDiagnosticWrite('DELETE')).toThrow();
  expect(()=>rejectAnnualDiagnosticWrite('GET')).not.toThrow();
 });
 it('rota somente para admin, confirmada e limitada; UI distingue teste de Pix',()=>{
  const app=readFileSync('server/app.ts','utf8');
  const view=readFileSync('src/pages/PlatformPixDiagnostic.tsx','utf8');
  expect(app).toContain("app.post('/api/platform/syncpay-annual-readonly-diagnostic',rateLimitByUser('syncpay-annual-readonly-diagnostic'");
  expect(app).toContain('await requirePlatformAdmin(res.locals.auth as AuthContext);');
  expect(app).toContain("res.set('Cache-Control','private, no-store').json(await diagnoseSyncpayAnnualReadonly());");
  expect(view).toContain("api<AnnualProbeResult>('/platform/syncpay-annual-readonly-diagnostic'");
  expect(view).toContain('Somente leitura');
 });
});
