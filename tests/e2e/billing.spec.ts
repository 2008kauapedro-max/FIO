import {test,expect} from '@playwright/test';

const fixture='/tests/fixtures/billing-preview.html';

async function selectPlan(page:any,name:'FREE'|'PRO'|'PREMIUM'){
 await page.getByRole('tab',{name,exact:true}).click();
}

test('trial PRO pode iniciar assinatura Pix sem cobranÃ§a real',async({page})=>{
 await page.goto(`${fixture}?scenario=trial`);
 await expect(page.getByRole('tab',{name:'PRO',exact:true})).toBeVisible();

 const button=page.getByRole('button',{name:'Assinar FIO PRO',exact:true});
 await expect(button).toBeEnabled();
 await button.click();

 await expect(page.getByRole('heading',{name:'Revisar e pagar'})).toBeVisible();
 await expect(page.getByRole('radio',{name:/Pix/})).toBeChecked();

 await page.locator('.fio-payflow-field input').fill('52998224725');
 await page.locator('.fio-payflow-consent input[type="checkbox"]').check();

 const generate=page.getByRole('button',{name:/^Gerar Pix/});
 await expect(generate).toBeEnabled();
 await generate.click();

 await expect(page.getByRole('heading',{name:'Pix para pagamento'})).toBeVisible();
 await expect(page.locator('.fio-payflow-pix-copy code')).toHaveText('PIX-SINTETICO-NAO-PAGAR');
});

test('pagamento Pix pendente sobrevive a reload sem gerar outra cobranÃ§a',async({page})=>{
 await page.goto(`${fixture}?scenario=pending`);
 await page.reload();

 await selectPlan(page,'PRO');
 await page.getByRole('button',{name:'Assinar FIO PRO',exact:true}).click();

 await expect(page.getByRole('heading',{name:'Pix para pagamento'})).toBeVisible();
 await expect(page.locator('.fio-payflow-pix-copy code')).toHaveText('PIX-SINTETICO-NAO-PAGAR');
 await expect(page.getByRole('button',{name:/^Gerar Pix/})).toHaveCount(0);
});

test('Pix expirado nunca Ã© exibido como cÃ³digo pagÃ¡vel',async({page})=>{
 await page.goto(`${fixture}?scenario=expired`);

 await selectPlan(page,'PRO');
 await page.getByRole('button',{name:'Assinar FIO PRO',exact:true}).click();

 await expect(page.getByRole('heading',{name:'Assinatura'})).toBeVisible();
 await expect(page.locator('.fio-payflow-qr')).toHaveCount(0);
 await expect(page.locator('.fio-payflow-pix-copy code')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Atualizar status/})).toBeVisible();
});

test('falha de billing Ã© acionÃ¡vel e nÃ£o vaza configuraÃ§Ã£o',async({page})=>{
 await page.goto(`${fixture}?scenario=error`);

 const alert=page.getByRole('alert');
 await expect(alert).toContainText(/confirmar a cobran/i);
 await expect(alert).toContainText(/Tente consultar novamente/i);
 await expect(page.locator('body')).not.toContainText('never expose this');

 await selectPlan(page,'PREMIUM');
 await expect(page.getByRole('button',{name:'Assinar FIO PREMIUM',exact:true})).toBeDisabled();
});

test('tema claro e escuro mantÃ©m controles e perÃ­odo sem overflow',async({page})=>{
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

test('catÃ¡logo FREE PRO PREMIUM usa tabs e um card responsivo por vez',async({page})=>{
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
