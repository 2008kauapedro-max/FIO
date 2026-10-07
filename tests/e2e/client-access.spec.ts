import {test,expect} from '@playwright/test';
import {demoData} from '../../src/lib/demo';
const data=demoData('CLIENT');
data.shop.name='Barbearia Aurora';data.shop.public_title='Barbearia Aurora';data.shop.slug='barbearia-aurora';data.shop.logo_url='/icons/icon-192.png';
test.beforeEach(async({page})=>{
 let joined=false;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let body:unknown;
  if(path.startsWith('/api/public/shop/'))body={shop:data.shop,services:data.services,team:[],subscriptionPlans:[]};
  else if(path==='/api/memberships')body=joined?[data.membership]:[];
  else if(path==='/api/onboarding'){expect(route.request().postDataJSON()).toMatchObject({mode:'join',slug:'barbearia-aurora'});joined=true;body={barbershopId:data.shop.id};}
  else if(path==='/api/bootstrap')body=data;
  else if(path.match(/^\/api\/appointments\/[^/]+$/)){
   const id=path.split('/').pop();
   body=data.appointments.find(a=>a.id===id)??{};
  }
  else if(path==='/api/assistant')body={conversationId:'test',message:'Confira seus horários na agenda.'};
  else body={};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
});
test('old shop-only link creates client and retains branding on navigation/reload',async({page},info)=>{
 await page.goto('/login?shop=barbearia-aurora');
 await expect(page.locator('.client-auth-brand')).toContainText('Barbearia Aurora');
 await page.screenshot({path:`docs/reorganization-evidence/auth-client-login-${info.project.name}.png`});
 await page.getByRole('button',{name:'Criar conta na Barbearia Aurora',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Faça parte da Barbearia Aurora.'})).toBeVisible();
 await page.getByLabel('E-mail',{exact:true}).fill('client@example.test');
 await page.getByLabel(/WhatsApp \/ telefone/).fill('(61) 99999-9999');
 await page.locator('input[type="password"]').nth(0).fill('Test-password!');
 await page.locator('input[type="password"]').nth(1).fill('Test-password!');
 await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('test-signup')!).options.emailRedirectTo)).toContain('audience=client');
 await page.getByRole('button',{name:'Já tenho uma conta'}).click();
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Como podemos te chamar?'})).toBeVisible();
 await page.getByLabel('Seu nome').fill('João Cliente');await page.getByRole('button',{name:'Entrar na barbearia',exact:true}).click();
 await expect(page).toHaveURL(/(\/client(?:[/?]|$)|\/\?shop=barbearia-aurora&audience=client)/);
 await expect(page.getByText('Barbearia Aurora',{exact:true}).first()).toBeVisible();
 await page.screenshot({path:`docs/reorganization-evidence/auth-client-home-${info.project.name}.png`});
 await page.reload();
 await expect(page.getByText('Barbearia Aurora',{exact:true}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`docs/reorganization-evidence/auth-client-${info.project.name}.png`});
});
test('Google callback preserves client audience and shop; owner stays owner',async({page})=>{
 await page.goto('/login?shop=barbearia-aurora');await page.getByRole('button',{name:'Continuar com Google'}).click();
 const callback=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('test-oauth')!).options.redirectTo);
 expect(callback).toContain('audience=client');expect(callback).toContain('shop=barbearia-aurora');
 await page.goto('/login?audience=owner&mode=signup');await expect(page.getByRole('heading',{name:'Crie sua barbearia com o FIO.'})).toBeVisible();await expect(page.locator('.client-auth-brand')).toHaveCount(0);
});
test('public portal direciona agendamento para instalacao do app da barbearia',async({page})=>{
 await page.goto('/barbearia-aurora');
 await expect(page.getByRole('button',{name:'Baixar app',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Agendar',exact:true}).first().click();
 await expect(page.getByText(/Baixe Barbearia Aurora para continuar/)).toBeVisible();
});

test('notification destination survives login and opens authorized agenda',async({page})=>{
 await page.route('**/api/memberships',r=>r.fulfill({json:[data.membership]}));
 await page.route('**/api/appointments/period?*',r=>r.fulfill({json:{total:data.appointments.length,completed:0,cancelled:0,noShow:0,items:data.appointments}}));
 const appointment=data.appointments[0];
 await page.goto(`/client/agenda?appointment=${appointment.id}&shopId=${data.shop.id}`);
 await expect(page).toHaveURL(/\/login\?.*next=/);
 await page.getByLabel('E-mail',{exact:true}).fill('client@example.test');await page.locator('input[type="password"]').first().fill('Test-password!');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page).toHaveURL(new RegExp(`/client/agenda\\?appointment=${appointment.id}`));
});
test('staff account cannot enter management through a client link',async({page})=>{
 await page.route('**/api/memberships',r=>r.fulfill({json:[{...data.membership,role:'OWNER'}]}));
 await page.goto('/login?audience=client&shop=barbearia-aurora');
 await page.getByLabel('E-mail',{exact:true}).fill('owner@example.test');
 await page.locator('input[type="password"]').first().fill('Test-password!');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('pode abrir este acesso');
 await expect(page.getByRole('link',{name:'Plano FIO',exact:true})).toHaveCount(0);
});

