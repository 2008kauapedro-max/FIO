param([Parameter(Mandatory=$true)][string]$Projeto)
$ErrorActionPreference = 'Stop'
function Get-NormalizedHash([string]$Path) {
    $text = [IO.File]::ReadAllText($Path).Replace(([string][char]13 + [char]10), [string][char]10)
    $bytes = [Text.Encoding]::UTF8.GetBytes($text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
$target = (Resolve-Path -LiteralPath $Projeto).Path
if (!(Test-Path -LiteralPath (Join-Path $target 'package.json'))) { throw 'Pasta nao parece ser o projeto FIO.' }
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$conflicts = @()
foreach ($item in $manifest.files) {
    $source = Join-Path (Join-Path $PSScriptRoot 'arquivos') $item.path
    $destination = Join-Path $target $item.path
    if (!(Test-Path -LiteralPath $source) -or (Get-NormalizedHash $source) -ne $item.after) { throw "Pacote incompleto ou modificado: $($item.path)" }
    if (Test-Path -LiteralPath $destination) {
        $current = Get-NormalizedHash $destination
        if ($current -ne $item.after -and $current -ne $item.before) { $conflicts += $item.path }
    } elseif ($null -ne $item.before) { $conflicts += $item.path }
}
if ($conflicts.Count -gt 0) {
    Write-Host 'Nenhum arquivo foi alterado. Conteudo diferente da base:'
    $conflicts | ForEach-Object { Write-Host $_ }
    throw 'Envie esta lista para mesclar sem perder suas mudancas.'
}
$backup = Join-Path (Split-Path $target -Parent) ('fio-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backup | Out-Null
foreach ($item in $manifest.files) {
    $source = Join-Path (Join-Path $PSScriptRoot 'arquivos') $item.path
    $destination = Join-Path $target $item.path
    if (Test-Path -LiteralPath $destination) {
        if ((Get-NormalizedHash $destination) -eq $item.after) { continue }
        $backupFile = Join-Path $backup $item.path
        New-Item -ItemType Directory -Path (Split-Path $backupFile -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $destination -Destination $backupFile
    }
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
    if ((Get-NormalizedHash $destination) -ne $item.after) { throw "Falha na copia: $($item.path). Backup: $backup" }
}
Write-Host 'Atualizacao aplicada. Execute npm run verify e siga LEIA-PRIMEIRO.md.'
Write-Host "Backup dos arquivos anteriores: $backup"
