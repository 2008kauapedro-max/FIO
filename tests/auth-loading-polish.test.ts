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

 it('login por senha usa erro genérico e encaminha cadastro sem enumerar conta',()=>{
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
    "setMessage(t('auth.loginFailed'))"
   );

  expect(auth)
   .toContain(
    "setMode('signup')"
   );

  expect(auth)
   .not.toContain(
    'loginHelp'
   );

  expect(auth)
   .not.toContain(
    'passwordProviderHelp'
   );

  expect(auth)
   .not.toContain(
    'passwordAccessTitle'
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

 it('onboarding não revela provedor nem força senha por causa do Google',()=>{
  const auth=readFileSync(
   resolve('src/pages/Auth.tsx'),
   'utf8'
  );

  const owner=readFileSync(
   resolve('src/pages/OwnerOnboarding.tsx'),
   'utf8'
  );

  const dict=readFileSync(
   resolve('src/i18n/dictionaries.ts'),
   'utf8'
  );

  expect(auth)
   .not.toContain(
    'setGoogleOnly('
   );

  expect(auth)
   .not.toContain(
    'auth.googlePassword'
   );

  expect(owner)
   .not.toContain(
    'ensurePasswordCredential'
   );

  expect(owner)
   .not.toContain(
    'accountPasswordConfirm'
   );

  expect(owner)
   .not.toContain(
    'auth.googlePassword'
   );

  expect(dict)
   .not.toContain(
    'auth.passwordProviderHelp'
   );

  expect(dict)
   .not.toContain(
    'auth.googlePasswordTitle'
   );
 });
});
