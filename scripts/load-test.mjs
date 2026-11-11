// Teste de carga leve do FIO (so leitura, nao cria conta nem agendamento).
// Uso:  node scripts/load-test.mjs <link-da-barbearia> [simultaneos] [segundos]
// Ex.:  node scripts/load-test.mjs barbearia-teste 100 30
const [slug,usersArg,secondsArg]=process.argv.slice(2);
const base=(process.env.FIO_URL||'https://usefio.vercel.app').replace(/\/$/,'');
const users=Math.min(Math.max(Number(usersArg)||100,1),300);
const seconds=Math.min(Math.max(Number(secondsArg)||30,5),120);
if(!slug||!/^[a-z0-9-]{3,60}$/.test(slug)){
 console.error('Informe o link da barbearia. Ex.: node scripts/load-test.mjs barbearia-teste 100 30');
 process.exit(1);
}
const targets=[
 {name:'Pagina inicial do app',path:'/'},
 {name:'Pagina publica da barbearia',path:`/api/public/shop/${slug}`},
 {name:'Manifest do app da barbearia',path:`/api/public/manifest/${slug}`}
];
const stats=new Map(targets.map(t=>[t.name,{ok:0,limited:0,failed:0,cached:0,times:[]}]));
const until=Date.now()+seconds*1000;

async function visitor(index){
 while(Date.now()<until){
  const target=targets[(index+Math.floor(Math.random()*targets.length))%targets.length];
  const s=stats.get(target.name);
  const started=performance.now();
  try{
   const res=await fetch(base+target.path,{signal:AbortSignal.timeout(15000)});
   await res.arrayBuffer();
   s.times.push(performance.now()-started);
   if(res.status===429)s.limited++;
   else if(res.ok)s.ok++;
   else s.failed++;
   if(/HIT|STALE/.test(res.headers.get('x-vercel-cache')||''))s.cached++;
  }catch{
   s.failed++;
  }
  // Pausa parecida com a de uma pessoa navegando.
  await new Promise(r=>setTimeout(r,500+Math.random()*1500));
 }
}
const pct=(list,p)=>list.length?Math.round([...list].sort((a,b)=>a-b)[Math.min(list.length-1,Math.floor(list.length*p))]):0;

console.log(`Testando ${base} com ${users} acessos simultaneos por ${seconds}s...`);
await Promise.all(Array.from({length:users},(_,i)=>visitor(i)));
let failed=0;
for(const [name,s] of stats){
 const total=s.ok+s.limited+s.failed;
 failed+=s.failed;
 console.log(`\n${name}`);
 console.log(`  pedidos: ${total} | ok: ${s.ok} | erro: ${s.failed} | bloqueado por limite (429): ${s.limited} | servido pelo cache: ${s.cached}`);
 console.log(`  tempo normal: ${pct(s.times,0.5)} ms | pior caso (95%): ${pct(s.times,0.95)} ms`);
}
console.log(failed?'\nRESULTADO: houve erros. Mande esta saida para analise.':'\nRESULTADO: sem erros.');
