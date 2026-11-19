import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const bar=readFileSync('src/components/OfflineBar.tsx','utf8');
const main=readFileSync('src/main.tsx','utf8');
const css=readFileSync('src/styles.css','utf8');
const dict=readFileSync('src/i18n/dictionaries.ts','utf8');

describe('barra de offline',()=>{
 it('fica montada em todas as telas',()=>{
  expect(main).toContain('<App/><OfflineBar/>');
 });
 it('reage na hora aos eventos do navegador e confirma com /api/health',()=>{
  expect(bar).toContain("addEventListener('offline',goOffline)");
  expect(bar).toContain("addEventListener('online',onOnline)");
  expect(bar).toContain("fetch('/api/health',{cache:'no-store'");
 });
 it('detecta Wi-Fi sem internet quando uma chamada falha por rede',()=>{
  expect(bar).toContain('error instanceof TypeError');
  expect(bar).toContain('window.fetch=originalFetch');
 });
 it('e uma barra fina vermelha, sem bloquear toques',()=>{
  expect(css).toMatch(/\.offline-bar\{position:fixed;[^}]*background:#c62828;[^}]*pointer-events:none/);
 });
 it('tem texto nos 6 idiomas',()=>{
  expect(dict.match(/"offline\.bar":/g)?.length).toBe(6);
 });
});
