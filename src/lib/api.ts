import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase=url&&key?createClient(url,key):null;
export class RequestError extends Error { constructor(public code:string,message:string){super(message);} }
export async function api<T>(path:string,shopId?:string,body?:unknown,method?:string):Promise<T> {
 if(!supabase) throw new RequestError('SETUP_REQUIRED','A conexão com a barbearia ainda não está configurada.');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)throw new RequestError('AUTH_REQUIRED','Entre para continuar.');
 let response:Response;
 try {response=await fetch(`/api${path}`,{method:method??(body?'POST':'GET'),headers:{Authorization:`Bearer ${session.access_token}`,...(shopId?{'X-Barbershop-Id':shopId}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(40000)});}
 catch {throw new RequestError('OFFLINE','Não foi possível conectar. Confira sua conexão e tente novamente.');}
 const data=await response.json();
 if(!response.ok)throw new RequestError(data.code,data.message);
 return data as T;
}
