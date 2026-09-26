import {test,expect} from '@playwright/test';
test('agenda opens from the daily summary and booking needs no payment step',async({page})=>{
 await page.goto('/tests/fixtures/scheduling-preview.html');
 await expect(page.getByText('SUA AGENDA DE HOJE')).toBeVisible();
 await expect(page.getByText('RECEBIDO NESTA SEMANA')).toHaveCount(0);
 await page.getByRole('button',{name:'Ver detalhes ↗'}).click();
 await expect(page.getByRole('heading',{name:'Agenda',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Agendar horário',exact:true}).click();
 const dialog=page.getByRole('dialog');
 const future=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 await dialog.getByLabel('Data',{exact:true}).fill(future);
 await dialog.getByRole('button',{name:'09:00',exact:true}).click();
 await dialog.getByRole('button',{name:'Confirmar agendamento'}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('status')).toHaveText('Agendamento criado.');
 await page.getByLabel('Dia da agenda').fill(future);
 await expect(page.getByRole('button',{name:/09:00.*Gabriel Santos/})).toBeVisible();
 await expect(page.getByText(/Gerar Pix|Confirmar recebimento/)).toHaveCount(0);
});
