import {existsSync,readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';

// Diagnóstico local: autentica e consulta planos, sem criar cobranças.
const env={};
for(const file of ['.env','.env.local'])if(existsSync(file))Object.assign(env,parseEnv(readFileSync(file,'utf8')));
Object.assign(env,process.env);
const base='https://api.syncpayments.com.br/api/partner/v1';
function fail(message){console.error(`FALHA: ${message}`);process.exitCode=1;}
async function run(){
 if(!env.SYNCPAY_CLIENT_ID||!env.SYNCPAY_CLIENT_SECRET){
  fail('Configure SYNCPAY_CLIENT_ID e SYNCPAY_CLIENT_SECRET no .env local para este teste. As variáveis da Vercel são separadas.');return;
 }
 const auth=await fetch(`${base}/auth-token`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({client_id:env.SYNCPAY_CLIENT_ID,client_secret:env.SYNCPAY_CLIENT_SECRET}),signal:AbortSignal.timeout(15000)});
 if(!auth.ok){fail(`Autenticação SyncPay retornou HTTP ${auth.status}. Confira as credenciais; se 429, aguarde antes de repetir.`);return;}
 const data=await auth.json();
 if(typeof data.access_token!=='string'||!data.access_token){fail('Resposta de autenticação sem token reconhecido.');return;}
 console.log('OK: credenciais aceitas pela SyncPay.');
 const plans=await fetch(`${base}/subscription-plans?per_page=1&page=1`,{redirect:'error',headers:{Authorization:`Bearer ${data.access_token}`,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!plans.ok){fail(`Consulta de assinaturas retornou HTTP ${plans.status}. Confira se o módulo de recorrência está habilitado e as permissões da credencial.`);return;}
 const result=await plans.json();
 if(!Array.isArray(result.data)){fail('Consulta de planos respondeu em formato inesperado.');return;}
 console.log('OK: consulta de planos de assinatura autorizada.');
 console.log('Este teste não cria plano, assinatura nem cobrança. Não comprova pagamento, webhook, configuração da Vercel ou liberação de acesso.');
 console.log('Nenhum token, segredo ou dado de cliente foi exibido.');
}
run().catch(()=>fail('Não foi possível concluir a consulta. Confira conexão e disponibilidade da SyncPay. Nenhum segredo foi exibido.'));
