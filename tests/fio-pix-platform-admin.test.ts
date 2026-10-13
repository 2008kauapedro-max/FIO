import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
describe('Pix Automatico: caminho restrito a plataforma',()=>{
 it('a rota nao exige o usuario ser proprietario de uma barbearia',()=>{
  const app=readFileSync('server/app.ts','utf8');
  expect(app).toContain("app.post('/api/platform/pix-auto-probe'");
  expect(app).toContain('await requirePlatformAdmin(res.locals.auth as AuthContext);');
  expect(app.indexOf("app.post('/api/platform/pix-auto-probe'")).toBeLessThan(app.indexOf("app.use('/api/platform',platformRouter())"));
  expect(app).not.toContain("app.post('/api/saas/syncpay/pix-auto-probe'");
 });
 it('a tela tecnica fica na area da plataforma, nao nos planos das barbearias',()=>{
  const app=readFileSync('src/App.tsx','utf8');
  const plans=readFileSync('src/pages/FioPlans.tsx','utf8');
  expect(app).toContain("location.pathname==='/platform/pix-diagnostico'");
  expect(plans).not.toContain('fioPixDiag=1');
  const page=readFileSync('src/pages/PlatformPixDiagnostic.tsx','utf8');
  expect(page).toContain("api('/platform/me')");
  expect(page).toContain("api<Result>('/platform/pix-auto-probe'");
 });
});