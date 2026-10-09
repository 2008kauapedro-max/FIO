import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {explicitClientSlug,isManagementPath} from '../src/lib/branding-scope';

describe('FIO: logo não vaza entre gestão e aplicativo dos clientes',()=>{
 it('área do gestor/solo/equipe nunca herda logo de loja',()=>{
  expect(explicitClientSlug('/','')).toBeNull();
  expect(explicitClientSlug('/owner','')).toBeNull();
  expect(explicitClientSlug('/barber/agenda','')).toBeNull();
  expect(explicitClientSlug('/login','?audience=owner&shop=joao')).toBeNull();
  expect(explicitClientSlug('/login','?audience=staff&shop=rafael')).toBeNull();
  expect(isManagementPath('/owner/agenda','')).toBe(true);
 });
 it('cada mini site e login de cliente tem sua própria loja, sem fallback para a anterior',()=>{
  expect(explicitClientSlug('/b/joao','')).toBe('joao');
  expect(explicitClientSlug('/barbearia/rafael','')).toBe('rafael');
  expect(explicitClientSlug('/joao','')).toBe('joao');
  expect(explicitClientSlug('/login','?shop=rafael&audience=client')).toBe('rafael');
  expect(explicitClientSlug('/login','?shop=joao&audience=client')).toBe('joao');
  expect(explicitClientSlug('/login','?audience=client')).toBeNull();
  expect(explicitClientSlug('/b/joao/agenda','')).toBeNull();
 });
 it('documentos e rotas técnicas não são barbearias',()=>{
  for(const path of ['/termos','/privacidade','/direitos-do-cliente','/cancelamento-e-reembolso','/pix-automatico','/cartao-e-parcelamento','/api']){
   expect(explicitClientSlug(path,'')).toBeNull();
  }
 });
 it('gestão usa FIO e PWA de cliente preserva o manifesto específico',()=>{
  const app=readFileSync('src/App.tsx','utf8');
  const auth=readFileSync('src/pages/Auth.tsx','utf8');
  const bootstrap=readFileSync('public/pwa-manifest-bootstrap.js','utf8');
  expect(app).toContain("role==='CLIENT'?(data.shop.public_title||data.shop.name):'FIO'");
  expect(app).toContain("if(membership.role!=='CLIENT')continue");
  expect(app).toContain('/manifest-owner.webmanifest');
  expect(app).toContain('/manifest-staff.webmanifest');
  expect(auth).toContain("audience==='client'&&shop?<ShopIdentity");
  expect(readFileSync('src/components/ShopIdentity.tsx','utf8')).toContain("shop?.logo_url||'/icons/icon-192.png'");
  expect(bootstrap).toContain('/api/public/manifest/');
  expect(bootstrap).toContain('direitos-do-cliente');
  const plans=readFileSync('src/pages/FioPlans.tsx','utf8');
  expect(plans).toContain('Aguardando homologação da SyncPay');
  expect(plans).toContain('role="radio" aria-checked={false} disabled');
 });
 it('tema claro mantém texto e campo legíveis, inclusive preenchimento automático',()=>{
  const css=readFileSync('src/styles.css','utf8');
  expect(css).toContain(".auth-page .auth-card input:-webkit-autofill");
  expect(css).toContain('background:#ebebe7!important');
  expect(css).toContain('-webkit-text-fill-color:#151515!important');
 });
});
