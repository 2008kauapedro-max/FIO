param(
  [string]$Repo = "."
)

$ErrorActionPreference = "Stop"
Set-Location $Repo

function Replace-Required {
  param(
    [string]$Path,
    [string]$Old,
    [string]$New
  )
  $content = Get-Content -Raw -Encoding UTF8 $Path
  if (-not $content.Contains($Old)) {
    throw "Trecho não encontrado em ${Path}:`n$Old"
  }
  $content = $content.Replace($Old, $New)
  Set-Content -Encoding UTF8 -NoNewline -Path $Path -Value $content
}

Write-Host "1/5 Ajustando catálogo e preços..." -ForegroundColor Cyan

Replace-Required "shared/fio-plans.ts" `
"'150 consultas de IA por usuário/dia'" `
"'60 consultas de IA por usuário/dia'"

Replace-Required "shared/fio-plans.ts" `
"description:'Para quem trabalha sozinho e quer o nível máximo do FIO.'" `
"description:'Para quem trabalha sozinho e quer o máximo do FIO, com IA sem limite diário e mais capacidade de uso.'"

Replace-Required "shared/fio-plans.ts" `
"highlights:['Clientes sem limite','Serviços sem limite']" `
"highlights:['Clientes sem limite','IA sem limite diário']"

Replace-Required "shared/fio-plans.ts" `
"'Assistente FIO',`n    '500 consultas de IA por usuário/dia'" `
"'Assistente FIO',`n    'IA sem limite diário'"

Replace-Required "shared/fio-plans.ts" `
"description:'Mais capacidade para equipes e carteiras de clientes maiores.'" `
"description:'Para equipes que querem o máximo do FIO, com mais capacidade e IA sem limite diário.'"

Replace-Required "shared/fio-plans.ts" `
"prices:{weekly:null,monthly:29990,annual:287904}" `
"prices:{weekly:null,monthly:29990,annual:289000}"

Replace-Required "shared/fio-plans.ts" `
"highlights:['Até 2.000 clientes','Até 10 profissionais + responsável']" `
"highlights:['IA sem limite diário','Até 10 profissionais + responsável']"

Write-Host "2/5 Atualizando textos multilíngues da IA..." -ForegroundColor Cyan

$dict = "src/i18n/dictionaries.ts"
$txt = Get-Content -Raw -Encoding UTF8 $dict

$repls = @{
  "150 consultas de IA por usuário/dia" = "60 consultas de IA por usuário/dia"
  "150 AI requests per user/day" = "60 AI requests per user/day"
  "150 consultas de IA por usuario/día" = "60 consultas de IA por usuario/día"
  "150 requêtes IA par utilisateur/jour" = "60 requêtes IA par utilisateur/jour"
  "150 KI-Anfragen pro Nutzer/Tag" = "60 KI-Anfragen pro Nutzer/Tag"
  "150 richieste IA per utente/giorno" = "60 richieste IA per utente/giorno"

  "500 consultas de IA por usuário/dia" = "IA sem limite diário"
  "500 AI requests per user/day" = "AI with no daily limit"
  "500 consultas de IA por usuario/día" = "IA sin límite diario"
  "500 requêtes IA par utilisateur/jour" = "IA sans limite quotidienne"
  "500 KI-Anfragen pro Nutzer/Tag" = "KI ohne Tageslimit"
  "500 richieste IA per utente/giorno" = "IA senza limite giornaliero"
}

foreach ($k in $repls.Keys) {
  if ($txt.Contains($k)) {
    $txt = $txt.Replace($k, $repls[$k])
  }
}
Set-Content -Encoding UTF8 -NoNewline -Path $dict -Value $txt

Write-Host "3/5 Destacando IA do Premium na tela de planos..." -ForegroundColor Cyan

$plansPath = "src/pages/FioPlans.tsx"
$plans = Get-Content -Raw -Encoding UTF8 $plansPath

$old = @'
    {compactFeatures.filter(Boolean).map((feature,index)=>
     <div key={`${selectedPlan}-${index}`}>
      <Check size={15}/>
      <span>{feature}</span>
     </div>
    )}
'@

$new = @'
    {compactFeatures.filter(Boolean).map((feature,index)=>{
     const premiumAi=
      ['PREMIUM','SOLO_PREMIUM'].includes(selectedPlan)&&
      index===compactFeatures.filter(Boolean).length-1;

     return <div
      key={`${selectedPlan}-${index}`}
      className={premiumAi?'fio-payflow-feature-ai-premium':''}
     >
      <Check size={15}/>
      <span>{feature}</span>
     </div>;
    })}
'@

if (-not $plans.Contains($old)) {
  throw "Bloco de recursos dos planos não encontrado em $plansPath"
}
$plans = $plans.Replace($old, $new)
Set-Content -Encoding UTF8 -NoNewline -Path $plansPath -Value $plans

$stylesPath = "src/styles.css"
$styles = Get-Content -Raw -Encoding UTF8 $stylesPath

$css = @'

/* FIO_PREMIUM_AI_20261007 */
.fio-payflow-feature-ai-premium{
 position:relative;
 margin:4px -5px 0;
 padding:0 7px;
 border:1px solid color-mix(in srgb,var(--text) 26%,transparent)!important;
 border-radius:9px;
 background:
  radial-gradient(circle at 15% 50%,color-mix(in srgb,var(--text) 12%,transparent),transparent 38%),
  linear-gradient(105deg,color-mix(in srgb,var(--surface) 92%,var(--text) 8%),var(--surface));
 box-shadow:0 0 18px color-mix(in srgb,var(--text) 9%,transparent);
 font-weight:800;
}
.fio-payflow-feature-ai-premium span{
 color:var(--text);
}
.fio-payflow-feature-ai-premium svg{
 color:var(--text);
 filter:drop-shadow(0 0 5px color-mix(in srgb,var(--text) 45%,transparent));
}
'@

if (-not $styles.Contains("/* FIO_PREMIUM_AI_20261007 */")) {
  $styles += $css
  Set-Content -Encoding UTF8 -NoNewline -Path $stylesPath -Value $styles
}

Write-Host "4/5 Registrando migration no repositório..." -ForegroundColor Cyan

$migrationPath = "supabase/migrations/20261007151000_rebalance_fio_ai_limits.sql"
$migration = @'
-- Rebalance FIO AI usage by commercial plan.
-- PRO/SOLO: 60 requests per user/day.
-- PREMIUM/SOLO_PREMIUM: no daily quota; per-minute guard remains for abuse protection.

update public.plan_features
set ai_daily_limit = case
  when plan in ('SOLO','PRO') then 60
  when plan in ('SOLO_PREMIUM','PREMIUM') then 0
  else ai_daily_limit
 end,
 ai_per_minute = case
  when plan in ('SOLO_PREMIUM','PREMIUM') then 30
  else ai_per_minute
 end
where plan in ('SOLO','PRO','SOLO_PREMIUM','PREMIUM');

create or replace function public.consume_assistant_quota(p_shop uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
 f public.plan_features;
 u public.assistant_usage;
 today date := (now() at time zone 'UTC')::date;
begin
 if public.member_role(p_shop) is null then raise exception 'FORBIDDEN'; end if;

 select pf.* into f
 from public.saas_subscriptions s
 join public.plan_features pf on pf.plan=s.plan
 where s.barbershop_id=p_shop
   and s.status in ('active','trialing','past_due')
   and (s.expires_at is null or s.expires_at>now());

 if f.plan is null or not f.ai_enabled then raise exception 'PLAN_REQUIRED'; end if;

 insert into public.assistant_usage(barbershop_id,user_id,day)
 values(p_shop,auth.uid(),today)
 on conflict do nothing;

 select * into u
 from public.assistant_usage
 where barbershop_id=p_shop
   and user_id=auth.uid()
   and day=today
 for update;

 if f.ai_daily_limit > 0 and u.request_count>=f.ai_daily_limit then
  raise exception 'DAILY_LIMIT';
 end if;

 if u.minute_start>now()-interval '1 minute'
    and u.minute_count>=f.ai_per_minute then
  raise exception 'RATE_LIMIT';
 end if;

 update public.assistant_usage
 set request_count=request_count+1,
     minute_count=case
       when minute_start<=now()-interval '1 minute' then 1
       else minute_count+1
     end,
     minute_start=case
       when minute_start<=now()-interval '1 minute' then now()
       else minute_start
     end
 where barbershop_id=p_shop
   and user_id=auth.uid()
   and day=today;
end $$;

revoke all on function public.consume_assistant_quota(uuid) from public,anon;
grant execute on function public.consume_assistant_quota(uuid) to authenticated;
'@

New-Item -ItemType Directory -Force -Path (Split-Path $migrationPath) | Out-Null
Set-Content -Encoding UTF8 -NoNewline -Path $migrationPath -Value $migration

Write-Host "5/5 Rodando validação..." -ForegroundColor Cyan

npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "Typecheck falhou." }

npm test -- --run
if ($LASTEXITCODE -ne 0) { throw "Testes falharam." }

npm run build
if ($LASTEXITCODE -ne 0) { throw "Build falhou." }

git add shared/fio-plans.ts src/i18n/dictionaries.ts src/pages/FioPlans.tsx src/styles.css $migrationPath
git commit -m "feat: rebalanceia IA e destaca Premium"
git push origin release/fio-mvp-final

Write-Host ""
Write-Host "PRONTO: IA e planos atualizados na release." -ForegroundColor Green
Write-Host "PRO/SOLO: 60 usos por usuário/dia."
Write-Host "PREMIUM/SOLO PREMIUM: sem limite diário, com proteção de 30 req/min."
Write-Host "PREMIUM anual: R$ 2.890,00."
