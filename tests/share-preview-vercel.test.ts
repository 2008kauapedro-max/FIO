import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const read=(file:string)=>
 readFileSync(resolve(file),'utf8');

describe('preview social e branding final do FIO',()=>{

 it('link limpo usa resposta dinâmica na Vercel',()=>{
  const vercel=JSON.parse(read('vercel.json'));

  const rule=vercel.rewrites.find(
   (item:{source:string})=>
    item.source==='/:slug([a-z0-9-]{3,60})'
  );

  expect(rule?.destination)
   .toBe('/api/handler?route=public/share/:slug');
 });

 it('gera metadados da barbearia para compartilhamento',()=>{
  const server=read('server/app.ts');

  expect(server)
   .toContain("app.get('/api/public/share/:slug'");

  expect(server)
   .toContain('property="og:title"');

  expect(server)
   .toContain('property="og:image"');

  expect(server)
   .toContain('name="twitter:image"');
 });

 it('portal alimenta somente o cache de branding v2',()=>{
  const portal=read('src/pages/PublicPortal.tsx');

  expect(portal)
   .toContain("const key='fio-loading-brands-v2'");

  expect(portal)
   .toContain('slug:data.shop.slug');
 });

});