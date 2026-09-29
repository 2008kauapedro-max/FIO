import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

describe('billing refund and recovery UX',()=>{
 it('exposes refund and cancellation actions without hiding legal exceptions',()=>{
  const page=readFileSync(resolve('src/pages/FioPlans.tsx'),'utf8');
  expect(page).toContain('Cancelar e solicitar reembolso');
  expect(page).toContain('não gera reembolso automático do período já pago, sem prejuízo dos direitos previstos em lei');
  expect(page).toContain("manageCharge('cancel_active')");
 });
 it('registers the refund API route',()=>{
  const app=readFileSync(resolve('server/app.ts'),'utf8');
  expect(app).toContain("/api/saas/refund");
  expect(app).toContain('requestSyncpayRefund');
 });
});
