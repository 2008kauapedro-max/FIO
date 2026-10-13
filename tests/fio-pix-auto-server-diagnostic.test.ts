import {describe,expect,it,vi,afterEach} from 'vitest';
import {diagnosePixAutomaticoPermission} from '../server/syncpay';
afterEach(()=>vi.unstubAllEnvs());
const validPlan={data:{token:'pix_auto_diag_12345'}};
function fake(createStatus:number,archiveStatus=204){
 const seen:string[]=[];
 const fetcher=vi.fn(async (input:URL|string|Request,opts?:RequestInit)=>{
  const url=String(input);const method=opts?.method||'GET';seen.push(method+' '+url);
  if(url.endsWith('/auth-token'))return new Response(JSON.stringify({access_token:'a'.repeat(32),expires_in:3600}),{status:200,headers:{'content-type':'application/json'}});
  if(method==='POST'&&url.endsWith('/subscription-plans'))return new Response(JSON.stringify(createStatus===201?validPlan:{code:'not_enabled'}),{status:createStatus});
  if(method==='DELETE'&&url.endsWith('/subscription-plans/pix_auto_diag_12345'))return new Response(archiveStatus===204?null:'error',{status:archiveStatus});
  throw Error('Unexpected mock provider request');
 });
 return {fetcher,seen};
}
describe('server-only SyncPay Pix Automático diagnostic',()=>{
 it('returns confirmed only after creation and deletion, never subscriber/payment calls',async()=>{
  vi.stubEnv('SYNCPAY_CLIENT_ID','testing');vi.stubEnv('SYNCPAY_CLIENT_SECRET','testing');
  const x=fake(201);
  expect(await diagnosePixAutomaticoPermission(x.fetcher as typeof fetch)).toMatchObject({status:'capability_confirmed',createHttp:201,archiveHttp:204});
  expect(x.seen).toHaveLength(3);
  expect(x.seen.every(s=>!s.includes('/subscribers')&&!s.includes('/subscriptions/'))).toBe(true);
 });
 it('never enables Pix on rejection',async()=>{
  vi.stubEnv('SYNCPAY_CLIENT_ID','testing');vi.stubEnv('SYNCPAY_CLIENT_SECRET','testing');
  const x=fake(422);
  expect(await diagnosePixAutomaticoPermission(x.fetcher as typeof fetch)).toMatchObject({status:'permission_not_confirmed',createHttp:422});
  expect(x.seen).toHaveLength(2);
 });
 it('fails closed if the temporary plan cannot be archived',async()=>{
  vi.stubEnv('SYNCPAY_CLIENT_ID','testing');vi.stubEnv('SYNCPAY_CLIENT_SECRET','testing');
  const x=fake(201,500);
  expect(await diagnosePixAutomaticoPermission(x.fetcher as typeof fetch)).toMatchObject({status:'archive_not_confirmed',archiveHttp:500});
 });
});
