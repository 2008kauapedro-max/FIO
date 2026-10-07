import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('push dispatcher seguro',()=>{
 const app=readFileSync('server/app.ts','utf8');

 it('exige segredo server-side para executar o dispatcher',()=>{
  expect(app).toContain("process.env.PUSH_DISPATCH_SECRET");
  expect(app).toContain("secureSecretEqual(token,expected)");
  expect(app).toContain("'/api/internal/push/dispatch'");
 });

 it('executa as duas filas de push',()=>{
  expect(app).toContain('dispatchPlatformPush(db)');
  expect(app).toContain('dispatchAppointmentPush(db)');
 });

 it('segredo e VAPID ficam documentados apenas como variaveis server-side',()=>{
  const env=readFileSync('.env.example','utf8');
  expect(env).toContain('PUSH_DISPATCH_SECRET=');
  expect(env).toContain('VAPID_PUBLIC_KEY=');
  expect(env).toContain('VAPID_PRIVATE_KEY=');
  expect(env).not.toContain('VITE_PUSH_DISPATCH_SECRET');
  expect(env).not.toContain('VITE_VAPID_PRIVATE_KEY');
 });
});
