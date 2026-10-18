import {test,expect} from '@playwright/test';

// Fixture local: sem conexao com SyncPay, Stripe ou banco de producao.
const fixture='/tests/fixtures/billing-preview.html';

async function selectPlan(page:import('@playwright/test').Page,name:'FREE'|'PRO'|'PREMIUM'){
 await page.getByRole('tab',{name,exact:true}).click();
}

async function selectMonthlyPro(page:import('@playwright/test').Page,scenario:string){
 await page.goto(`${fixture}?scenario=${scenario}`);
 await page.getByRole('button',{name:'Mensal',exact:true}).click();
 await selectPlan(page,'PRO');
}

test('trial PRO: compra mensal continua bloqueada sem meio homologado',async({page})=>{
 await selectMonthlyPro(page,'trial');
 await expect(page.getByRole('button',{name:'Ver disponibilidade do pagamento'})).toBeEnabled();
 await expect(page.getByText(/contratação mensal ainda está em preparação/i)).toBeVisible();
 await page.getByRole('button',{name:'Ver disponibilidade do pagamento'}).click();
 await expect(page.getByRole('alert')).toContainText('Nenhuma cobrança foi iniciada');
 await expect(page.getByRole('heading',{name:'Revisar e pagar'})).toHaveCount(0);
 await expect(page.locator('.fio-payflow-pix-copy code')).toHaveCount(0);
});

test('cobrança Pix pendente não cria novo pagamento se checkout está bloqueado',async({page})=>{
 await selectMonthlyPro(page,'pending');
 await page.reload();
 await page.getByRole('button',{name:'Mensal',exact:true}).click();
 await selectPlan(page,'PRO');
 await page.getByRole('button',{name:'Ver disponibilidade do pagamento'}).click();
 await expect(page.getByRole('alert')).toContainText('Nenhuma cobrança foi iniciada');
 await expect(page.getByRole('button',{name:/^Gerar Pix/})).toHaveCount(0);
 await expect(page.locator('.fio-payflow-qr')).toHaveCount(0);
});

test('código de Pix expirado não é exposto quando não pode ser pago',async({page})=>{
 await selectMonthlyPro(page,'expired');
 await expect(page.getByRole('button',{name:'Ver disponibilidade do pagamento'})).toBeVisible();
 await expect(page.locator('.fio-payflow-qr')).toHaveCount(0);
 await expect(page.locator('.fio-payflow-pix-copy code')).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('PIX-SINTETICO-NAO-PAGAR');
});

test('falha da consulta de cobrança é explicada sem expor erro interno',async({page})=>{
 await page.goto(`${fixture}?scenario=error`);
 const alert=page.getByRole('alert');
 await expect(alert).toContainText(/confirmar a cobran/i);
 await expect(alert).toContainText(/Tente consultar novamente/i);
 await expect(page.locator('body')).not.toContainText('never expose this');
 await selectPlan(page,'PREMIUM');
 await expect(page.getByRole('button',{name:'Ver disponibilidade do pagamento'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Revisar e pagar'})).toHaveCount(0);
});

test('compra anual mostra revisão mas não permite pagamento sem autorização',async({page})=>{
 await page.goto(`${fixture}?scenario=trial`);
 await selectPlan(page,'PRO');
 await page.getByRole('button',{name:/^Anual/}).click();
 await page.getByRole('button',{name:'Revisar compra anual'}).click();
 await expect(page.getByRole('heading',{name:'Comprar plano anual'})).toBeVisible();
 await expect(page.getByRole('button',{name:/Pagar anual em 1x/})).toBeDisabled();
 await expect(page.getByText(/Nenhuma cobrança pode ser iniciada/i)).toBeVisible();
});

test('tema claro e escuro mantêm controles e período sem overflow',async({page})=>{
 for(const theme of ['light','dark']){
  await page.goto(`${fixture}?scenario=trial&theme=${theme}`);
  await expect(page.getByRole('tab',{name:'PRO',exact:true})).toBeVisible();
  const annual=page.getByRole('button',{name:/^Anual/});
  const monthly=page.getByRole('button',{name:'Mensal',exact:true});
  await annual.click();
  await expect(annual).toHaveAttribute('aria-selected','true');
  await monthly.click();
  await expect(monthly).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('catálogo FREE PRO PREMIUM usa abas e um único card responsivo',async({page})=>{
 for(const width of [320,360,390,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(`${fixture}?scenario=trial`);
  for(const plan of ['FREE','PRO','PREMIUM'] as const){
   const tab=page.getByRole('tab',{name:plan,exact:true});
   await expect(tab).toBeVisible();
   await tab.click();
   await expect(tab).toHaveAttribute('aria-selected','true');
   await expect(page.locator(`[data-plan="${plan}"]`)).toBeVisible();
  }
  await expect(page.getByRole('tab',{name:'PLUS',exact:true})).toHaveCount(0);
  await expect(page.locator('.fio-payflow-card')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.fio-payflow-card').evaluate(card=>card.scrollWidth<=card.clientWidth)).toBe(true);
 }
});
