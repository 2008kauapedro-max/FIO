import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const read=(file:string)=>
 readFileSync(resolve(file),'utf8');

describe('notificacao in-app',()=>{

 it('mostra card e abre agenda',()=>{
  const app=read('src/App.tsx');

  expect(app).toContain('fio-inapp-notice');
  expect(app).toContain("toast===t('app.newAppointment')");
  expect(app).toContain("t('app.noticeOpenAgenda')");
  expect(app).toContain("navigate(base+'/agenda')");
 });

 it('respeita mobile e safe area',()=>{
  const css=read('src/styles.css');

  expect(css).toContain('.toast.fio-inapp-notice');
  expect(css).toContain('@keyframes fioNoticeEnter');
  expect(css).toContain('fio-inapp-notice-progress');
  expect(css).toContain('env(safe-area-inset-top)');
 });

});
