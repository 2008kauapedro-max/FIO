import { ApiError } from './errors.js';

/**
 * Diagnostico apenas de descoberta. Nao executa POST de pedidos nem pagamentos.
 * Nunca serializa credenciais, bearer token ou corpo de resposta do provedor.
 * GET/OPTIONS de uma rota nao prova disponibilidade do POST correspondente.
 */
const ORIGIN='https://api.syncpayments.com.br';
const AUTH_PATH='/api/partner/v1/auth-token';
const ROUTES=[
 {method:'GET',path:'/api/partner/v1/subscription-plans?page=1&per_page=1'},
 {method:'GET',path:'/api/v1/orders'},
 {method:'OPTIONS',path:'/api/v1/orders'},
 {method:'GET',path:'/api/partner/v1/orders'},
 {method:'OPTIONS',path:'/api/partner/v1/orders'}
] as const;

type Check={method:'GET'|'OPTIONS';path:string;http:number|null;meaning:string};
function meaning(http:number|null){
 if(http===null)return 'network_error';
 if(http>=200&&http<300)return 'responded';
 if(http===401)return 'unauthorized';
 if(http===403)return 'forbidden';
 if(http===404)return 'not_found_for_method';
 if(http===405)return 'method_not_allowed';
 if(http>=300&&http<400)return 'redirect_not_followed';
 return 'other_response';
}

export async function diagnoseSyncpayAnnualReadonly(fetcher:typeof fetch=fetch){
 const id=process.env.SYNCPAY_CLIENT_ID;
 const secret=process.env.SYNCPAY_CLIENT_SECRET;
 const note='Somente GET e OPTIONS. O codigo HTTP nao confirma que POST /orders funciona, nem que o provedor suporta checkout hospedado.';
 if(!id||!secret)return {status:'not_configured',authHttp:null,checks:[] as Check[],note};
 let auth:Response;
 try{
  auth=await fetcher(`${ORIGIN}${AUTH_PATH}`,{
   method:'POST',
   headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({client_id:id,client_secret:secret}),
   redirect:'manual',signal:AbortSignal.timeout(12000)
  });
 }catch{return {status:'auth_connection_error',authHttp:null,checks:[] as Check[],note};}
 if(auth.status!==200)return {status:'auth_rejected',authHttp:auth.status,checks:[] as Check[],note};
 let token:string|undefined;
 try{
  const payload:unknown=await auth.json();
  const record=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};
  if(typeof record.access_token==='string'&&record.access_token.length>=10)token=record.access_token;
 }catch{ /* Do not return or log response body. */ }
 if(!token)return {status:'auth_invalid_response',authHttp:auth.status,checks:[] as Check[],note};
 const checks:Check[]=await Promise.all(ROUTES.map(async route=>{
  let http:number|null=null;
  try{
   const response=await fetcher(`${ORIGIN}${route.path}`,{
    method:route.method,
    headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},
    redirect:'manual',signal:AbortSignal.timeout(12000)
   });
   http=response.status;
  }catch{ /* Hide provider errors, headers and bodies. */ }
  return {method:route.method,path:route.path,http,meaning:meaning(http)};
 }));
 return {status:'completed',authHttp:auth.status,checks,note};
}

/** Explicitly reject routes that could create payments through this module. */
export function rejectAnnualDiagnosticWrite(method:string):void{
 if(method!=='GET'&&method!=='OPTIONS')throw new ApiError(405,'DIAGNOSTIC_READ_ONLY','Diagnostico restrito a GET e OPTIONS.');
}
