/** Browser-only tokenization, NEVER proxy PAN/CVV through the FIO server. */
const TOKEN_URL='https://api.syncpayments.com.br/api/public/v1/card-tokens';
const CARD_TOKEN=/^card_token\.[A-Za-z0-9._-]{8,260}$/;

export type RawCard={number:string;holder_name:string;expiry_month:string;expiry_year:string;cvv:string};
export type SealedCard={token:string;brand:string|null;last4:string|null};

export async function tokenizeAnnualCard(
 publicKey:string, card:RawCard, fetcher:typeof fetch=fetch
):Promise<SealedCard>{
 if(!/^pk_live_[A-Za-z0-9._-]{8,}$/.test(publicKey))throw new Error('CHAVE_PUBLICA_INDISPONIVEL');
 const number=card.number.replace(/\D/g,'');
 if(!/^\d{13,19}$/.test(number)||!/^\d{3,4}$/.test(card.cvv)||
  !/^(0[1-9]|1[0-2])$/.test(card.expiry_month)||!/^20\d{2}$/.test(card.expiry_year)||
  card.holder_name.trim().length<5)throw new Error('DADOS_CARTAO_INVALIDOS');
 const response=await fetcher(TOKEN_URL,{
  method:'POST',
  headers:{'Content-Type':'application/json','X-Public-Key':publicKey},
  body:JSON.stringify({card:{number,holder_name:card.holder_name.trim(),expiry_month:card.expiry_month,expiry_year:card.expiry_year,cvv:card.cvv}}),
  redirect:'error',signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw new Error(response.status===403?'CARTAO_NAO_AUTORIZADO_NA_SYNCPAY':'FALHA_TOKENIZACAO');
 const json:unknown=await response.json();
 const root=(json&&typeof json==='object'?json:{}) as Record<string,unknown>;
 const data=(root.data&&typeof root.data==='object'?root.data:{}) as Record<string,unknown>;
 if(typeof data.token!=='string'||!CARD_TOKEN.test(data.token))throw new Error('TOKEN_CARTAO_INVALIDO');
 return {
  token:data.token,
  brand:typeof data.brand==='string'&&data.brand.length<30?data.brand:null,
  last4:typeof data.last4==='string'&&/^\d{4}$/.test(data.last4)?data.last4:null
 };
}
