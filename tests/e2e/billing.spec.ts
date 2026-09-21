import {test,expect} from '@playwright/test';
const fixture='/tests/fixtures/billing-preview.html';
test('trial can become a paid PRO subscription',async({page})=>{
 await page.goto(`${fixture}?scenario=trial`);
 const button=page.getByRole('button',{name:'Assinar PRO',exact:true});await expect(button).toBeEnabled();
 await button.click();const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('heading',{name:'Assinar FIO PRO'})).toBeVisible();
 await dialog.getByLabel('CPF ou CNPJ do responsável').fill('52998224725');
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Gerar Pix da assinatura'}).click();
 await expect(dialog.getByLabel('Código Pix copia e cola')).toHaveValue('PIX-SINTETICO-NAO-PAGAR');
 await dialog.getByRole('button',{name:'Fechar e pagar depois'}).click();
 await page.getByRole('button',{name:'Ver cobrança'}).click();
 await expect(page.getByLabel('Código Pix copia e cola')).toBeVisible();
});
test('pending payment survives a page reload',async({page})=>{
 await page.goto(`${fixture}?scenario=pending`);await page.reload();
 await page.getByRole('button',{name:'Ver cobrança'}).click();
 await expect(page.getByLabel('Código Pix copia e cola')).toBeVisible();
 await expect(page.getByRole('button',{name:'Gerar Pix da assinatura'})).toHaveCount(0);
});
test('expired Pix is never presented for payment',async({page})=>{
 await page.goto(`${fixture}?scenario=expired`);await page.getByRole('button',{name:'Ver cobrança'}).click();
 await expect(page.getByRole('dialog')).toContainText('Não há um Pix válido disponível');
 await expect(page.getByLabel('Código Pix copia e cola')).toHaveCount(0);
});
test('billing failure is actionable and does not leak configuration',async({page})=>{
 await page.goto(`${fixture}?scenario=error`);await expect(page.getByRole('alert')).toContainText('Fale com o suporte');
 await expect(page.locator('body')).not.toContainText('never expose this');
 await expect(page.getByRole('button',{name:'Assinar PREMIUM',exact:true})).toBeDisabled();
});
test('light and dark layouts keep the selected period visible without overflow',async({page})=>{
 for(const theme of ['light','dark']){
  await page.goto(`${fixture}?scenario=trial&theme=${theme}`);
  await expect(page.getByRole('heading',{name:'Escolha como sua barbearia cresce'})).toBeVisible();
  const annual=page.getByRole('tab',{name:/Anual/});await annual.click();await expect(annual).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
