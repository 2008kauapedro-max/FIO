# Backup manual do banco do FIO (Supabase), para usar enquanto o projeto
# estiver no plano gratuito, que nao tem backup automatico.
#
# Uso, no terminal do VS Code, dentro da pasta do FIO:
#   powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1
#
# Requisitos:
#   - pg_dump versao 17 instalado (vem com o PostgreSQL 17 para Windows).
#   - A connection string do Supabase em modo "Session pooler"
#     (Supabase > botao Connect > Session pooler). O script pede a string
#     na hora e nao salva em lugar nenhum.
#
# O arquivo vai para a pasta backups/ (ignorada pelo git). Guarde uma copia
# fora do computador (Google Drive, por exemplo).

$ErrorActionPreference = 'Stop'

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
 $candidate = 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe'
 if (Test-Path -LiteralPath $candidate) { $pgDump = Get-Item -LiteralPath $candidate }
}
if (-not $pgDump) {
 throw 'pg_dump nao encontrado. Instale o PostgreSQL 17 para Windows (pode marcar so "Command Line Tools") e rode de novo.'
}
$pgDumpPath = if ($pgDump -is [System.Management.Automation.CommandInfo]) { $pgDump.Source } else { $pgDump.FullName }

$versionText = & $pgDumpPath --version
if ($versionText -notmatch '\b(\d+)\.') { throw "Nao consegui ler a versao do pg_dump: $versionText" }
if ([int]$Matches[1] -lt 17) { throw "pg_dump precisa ser versao 17 ou maior (o banco do FIO e Postgres 17). Encontrado: $versionText" }

$dbUrl = $env:SUPABASE_DB_URL
if (-not $dbUrl) {
 $secure = Read-Host -AsSecureString 'Cole a connection string do Supabase (Session pooler)'
 $dbUrl = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if ($dbUrl -notmatch '^postgres(ql)?://') { throw 'A connection string precisa comecar com postgresql://' }

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backupDir = Join-Path $root 'backups'
[IO.Directory]::CreateDirectory($backupDir) | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$file = Join-Path $backupDir "fio-$stamp.dump"

Write-Host "Gerando backup em $file ..."
& $pgDumpPath --dbname=$dbUrl --format=custom --no-owner --no-privileges --file=$file
if ($LASTEXITCODE -ne 0) {
 if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file }
 throw "pg_dump falhou (codigo $LASTEXITCODE). Confira a senha e se a string e a do Session pooler."
}

$sizeMb = [Math]::Round((Get-Item -LiteralPath $file).Length / 1MB, 2)
Write-Host "Backup pronto: $file ($sizeMb MB)"
Write-Host 'Agora copie esse arquivo para fora do computador (Google Drive, por exemplo).'
