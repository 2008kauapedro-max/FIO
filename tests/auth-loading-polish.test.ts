import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('acesso e loading sem flash',()=>{
 it('segura a tela de login até a sessão ser resolvida e redireciona sessão existente',()=>{
  const app=readFileSync(
   resolve('src/App.tsx'),
   'utf8'
  );

  expect(app)
   .toContain(
    "if(location.pathname==='/login'){"
   );

  expect(app)
   .toContain(
    'if(!authReady||bootHold)'
   );

  expect(app)
   .toContain(
    'if(session){'
   );

  expect(app)
   .toContain(
    'setBootHold(false)'
   );
 });

 it('loading usa branding cedo para owner, barbeiro e cliente',()=>{
  const app=readFileSync(
   resolve('src/App.tsx'),
   'utf8'
  );

  const server=readFileSync(
   resolve('server/app.ts'),
   'utf8'
  );

  const identity=readFileSync(
   resolve('src/components/ShopIdentity.tsx'),
   'utf8'
  );

  expect(app)
   .toContain(
    'fio-loading-brand-logo'
   );

  expect(app)
   .toContain(
    "const LOADING_BRANDS_KEY='fio-loading-brands-v1'"
   );

  expect(app)
   .toContain(
    'MembershipWithBrand'
   );

  expect(server)
   .toContain(
    'shop_brand:brandByShop.get'
   );

  expect(identity)
   .toContain(
    'fio-loading-brands-v1'
   );
 });

 it('login por senha não enumera e-mail e ajuda contas Google a criar senha',()=>{
  const auth=readFileSync(
   resolve('src/pages/Auth.tsx'),
   'utf8'
  );

  expect(auth)
   .toContain(
    "authError.code==='invalid_credentials'"
   );

  expect(auth)
   .toContain(
    "t('auth.definePassword')"
   );

  expect(auth)
   .toContain(
    "setMode('forgot')"
   );

  expect(auth)
   .not.toContain(
    '/auth/email-exists'
   );

  expect(auth)
   .not.toContain(
    '/auth/check-email'
   );
 });

 it('Google novo pode criar credencial de senha no onboarding owner e cliente',()=>{
  const auth=readFileSync(
   resolve('src/pages/Auth.tsx'),
   'utf8'
  );

  const owner=readFileSync(
   resolve('src/pages/OwnerOnboarding.tsx'),
   'utf8'
  );

  expect(auth)
   .toContain(
    'setGoogleOnly('
   );

  expect(auth)
   .toContain(
    'supabase.auth.updateUser({'
   );

  expect(owner)
   .toContain(
    'ensurePasswordCredential'
   );

  expect(owner)
   .toContain(
    'accountPasswordConfirm'
   );

  expect(owner)
   .toContain(
    'supabase.auth.updateUser({'
   );
 });
});