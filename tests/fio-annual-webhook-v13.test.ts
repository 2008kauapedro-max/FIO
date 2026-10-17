import {describe,it,expect} from 'vitest';
import {annualWebhookAuthenticated} from '../server/fio-annual-credit-card.js';
describe('FIO V13 - webhook anual autenticado',()=>{
 const secret='test-secret-webhook-annual-123456789';
 it('nao aceita endpoint sem segredo configurado',()=>{
  expect(annualWebhookAuthenticated(`Bearer ${secret}`,undefined)).toBe(false);
 });
 it('nao aceita segredo divergente, parcial ou outro esquema',()=>{
  expect(annualWebhookAuthenticated('Bearer abc',secret)).toBe(false);
  expect(annualWebhookAuthenticated(`Basic ${secret}`,secret)).toBe(false);
  expect(annualWebhookAuthenticated(undefined,secret)).toBe(false);
 });
 it('aceita apenas o Bearer exato',()=>{
  expect(annualWebhookAuthenticated(`Bearer ${secret}`,secret)).toBe(true);
 });
});
