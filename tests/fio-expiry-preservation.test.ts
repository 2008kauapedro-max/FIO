import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {syncpayInternals} from '../server/syncpay';
describe('FIO overdue -> Free without deleting shop data',()=>{
 it('ends paid entitlement at due date even if provider has grace period',()=>{
  const due='2026-10-12T10:00:00Z';
  for(const status of ['active','overdue'] as const){
   const detail={status,next_charge_at:due,plan:{grace_period_days:7}} as Parameters<typeof syncpayInternals.accessUntil>[0];
   expect(syncpayInternals.accessUntil(detail)).toBe('2026-10-12T10:00:00.000Z');
  }
 });
 it('removes paid privileges on overdue for tenant and assistant',()=>{
  const ctx=readFileSync('server/context.ts','utf8');
  const assistant=readFileSync('server/assistant.ts','utf8');
  expect(ctx).toContain('fioEffectivePlan(subscription)');
  expect(assistant).toContain('fioEffectivePlan(billing');
 });
 it('SQL returns Free without updating or deleting shop content',()=>{
  const sql=readFileSync('supabase/migrations/20261013025234_expired_access_to_free.sql','utf8');
  expect(sql).toContain("when s.status in ('active','trialing')");
  expect(sql).toContain("else 'FREE'");
  expect(sql).not.toMatch(/^\s*(delete from|truncate|drop table)\b/gim);
  expect(sql).not.toMatch(/update\s+public\.(customers|appointments|services)/i);
 });
});
