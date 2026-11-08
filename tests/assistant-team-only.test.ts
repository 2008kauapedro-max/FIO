import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
describe('IA só para dono e funcionários',()=>{
 it('servidor recusa cliente antes de chamar a IA',()=>{
  const app=readFileSync('server/app.ts','utf8');
  const i=app.indexOf("app.post('/api/assistant'");
  expect(i).toBeGreaterThan(-1);
  const route=app.slice(i,i+400);
  expect(route.indexOf("c.member.role==='CLIENT'")).toBeLessThan(route.indexOf('askAssistant('));
 });
 it('menu e rota da IA não existem para cliente',()=>{
  const ui=readFileSync('src/App.tsx','utf8');
  expect(ui).toContain("{path:'/assistente',label:'Assistente',icon:Sparkles,roles:['OWNER','BARBER'],feature:'assistant'}");
  expect(ui).toContain("case '/assistente':content=role==='CLIENT'?<Dashboard {...props}/>:<AssistantChat ");
 });
});
