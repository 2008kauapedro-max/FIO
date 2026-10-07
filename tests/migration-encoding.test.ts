import {describe,expect,it} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

describe('encoding das migrations',()=>{
 it('nenhuma migration SQL comeca com BOM UTF-8',()=>{
  const dir=resolve('supabase/migrations');
  for(const file of readdirSync(dir).filter(name=>name.endsWith('.sql'))){
   const data=readFileSync(resolve(dir,file));
   expect(
    data.subarray(0,3).equals(Buffer.from([0xEF,0xBB,0xBF])),
    `BOM encontrado em ${file}`
   ).toBe(false);
  }
 });
});
