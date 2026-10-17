import {describe,it,expect,vi} from 'vitest';
import {tokenizeAnnualCard} from '../src/lib/syncpay-public-card';
const key='pk_live_abcdefghijklmnop';
const card={number:'4111111111111111',holder_name:'TESTE AUTORIZADO',expiry_month:'11',expiry_year:'2031',cvv:'123'};
describe('FIO anual V12: cartao nunca passa pelo servidor FIO',()=>{
 it('envia PAN/CVV somente ao endpoint publico de tokenizacao da SyncPay',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{token:'card_token.abcdefghi1234',brand:'visa',last4:'1111'}}),{status:200}));
  const token=await tokenizeAnnualCard(key,card,fetcher);
  expect(token).toEqual({token:'card_token.abcdefghi1234',brand:'visa',last4:'1111'});
  const [url,request]=fetcher.mock.calls[0];
  expect(url).toBe('https://api.syncpayments.com.br/api/public/v1/card-tokens');
  expect(request.headers['X-Public-Key']).toBe(key);
  expect(JSON.parse(request.body).card.number).toBe(card.number);
  expect(JSON.parse(request.body).card.cvv).toBe(card.cvv);
 });
 it('nao aceita resposta com token invalido',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{token:'card_token.no'}}),{status:200}));
  await expect(tokenizeAnnualCard(key,card,fetcher)).rejects.toThrow('TOKEN_CARTAO_INVALIDO');
 });
 it('nunca envia cartao quando a chave publica esta ausente',async()=>{
  const fetcher=vi.fn();
  await expect(tokenizeAnnualCard('',card,fetcher)).rejects.toThrow('CHAVE_PUBLICA_INDISPONIVEL');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('recusa cartao incompleto antes do envio',async()=>{
  const fetcher=vi.fn();
  await expect(tokenizeAnnualCard(key,{...card,cvv:'1'},fetcher)).rejects.toThrow('DADOS_CARTAO_INVALIDOS');
  expect(fetcher).not.toHaveBeenCalled();
 });
});
