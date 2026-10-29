param(
  [string]$ProjectRef = "",
  [switch]$Deploy,
  [switch]$ShowVaultSql
)

$ErrorActionPreference = "Stop"

function ConvertTo-Base64Url([byte[]]$Bytes) {
  return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function ConvertFrom-Base64Url([string]$Value) {
  $base64 = $Value.Replace('-', '+').Replace('_', '/')
  switch ($base64.Length % 4) {
    2 { $base64 += '==' }
    3 { $base64 += '=' }
  }
  return [Convert]::FromBase64String($base64)
}

function Protect-Config([string]$Config) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Config)
  return ConvertTo-Base64Url ([System.Security.Cryptography.ProtectedData]::Protect(
    $bytes,
    $null,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  ))
}

function Invoke-Supabase([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments) {
  if (Get-Command supabase -ErrorAction SilentlyContinue) {
    & supabase @Arguments
  } else {
    & npm exec -- supabase @Arguments
  }
  if ($LASTEXITCODE -ne 0) { throw "Comando Supabase falhou: supabase $($Arguments -join ' ')" }
}

if (-not $ProjectRef) {
  $envText = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\.env') -Raw -ErrorAction SilentlyContinue
  if ($envText -match '(?m)^VITE_SUPABASE_PROJECT_ID\s*=\s*[''\"]?([^''\"\r\n]+)') {
    $ProjectRef = $Matches[1].Trim()
  }
}
if (-not $ProjectRef) { throw "Informe -ProjectRef (referência do projeto Supabase)." }

$configPath = Join-Path $PSScriptRoot '..\.secrets\web-push-config.dpapi'
$legacySecretsPath = Join-Path $PSScriptRoot '..\.secrets\web-push-vapid.env'
$legacyKeyPath = Join-Path $PSScriptRoot '..\.secrets\web-push-vapid.json.dpapi'
$secretDir = Split-Path -Parent $configPath
New-Item -ItemType Directory -Force -Path $secretDir | Out-Null

if (-not (Test-Path -LiteralPath $configPath)) {
  if (Test-Path -LiteralPath $legacySecretsPath) {
    $legacy = Get-Content -LiteralPath $legacySecretsPath -Raw
    $config = [ordered]@{}
    foreach ($name in @('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'PUSH_DISPATCH_SECRET')) {
      $match = [regex]::Match($legacy, "(?m)^$name=(.*)$")
      if (-not $match.Success) { throw "Configuração local existente incompleta para $name." }
      $config[$name] = $match.Groups[1].Value.Trim()
    }
    Set-Content -LiteralPath $configPath -Value (Protect-Config ($config | ConvertTo-Json -Compress)) -NoNewline
    Remove-Item -LiteralPath $legacySecretsPath
    Remove-Item -LiteralPath $legacyKeyPath -ErrorAction SilentlyContinue
    Write-Output "Configuração local anterior foi convertida para DPAPI e o arquivo de texto puro foi removido."
  } else {
    $curve = [System.Security.Cryptography.ECDsa]::Create()
    try {
      $curve.GenerateKey([System.Security.Cryptography.ECCurve]::CreateFromFriendlyName('nistP256'))
      $parameters = $curve.ExportParameters($true)
      $publicBytes = [byte[]]::new(65)
      $publicBytes[0] = 4
      [Array]::Copy($parameters.Q.X, 0, $publicBytes, 1, 32)
      [Array]::Copy($parameters.Q.Y, 0, $publicBytes, 33, 32)
      $config = [ordered]@{
        VAPID_PUBLIC_KEY = ConvertTo-Base64Url $publicBytes
        VAPID_PRIVATE_KEY = ConvertTo-Base64Url $parameters.D
        VAPID_SUBJECT = 'mailto:suporte@zelo.app'
        PUSH_DISPATCH_SECRET = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
      }
      Set-Content -LiteralPath $configPath -Value (Protect-Config ($config | ConvertTo-Json -Compress)) -NoNewline
      Write-Output "Gerado novo par VAPID e segredo de despacho. A configuração está protegida por DPAPI para este usuário Windows."
    } finally {
      if ($null -ne $curve) { $curve.Dispose() }
    }
  }
} else {
  Write-Output "Configuração push já existe localmente, protegida por DPAPI. Para rotacionar, remova o arquivo .secrets/web-push-config.dpapi e execute novamente."
}

if (-not $Deploy) {
  if ($ShowVaultSql) {
    $protected = (Get-Content -LiteralPath $configPath -Raw).Trim()
    $configBytes = [System.Security.Cryptography.ProtectedData]::Unprotect((ConvertFrom-Base64Url $protected), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $config = [System.Text.Encoding]::UTF8.GetString($configBytes) | ConvertFrom-Json
    $endpoint = "https://$ProjectRef.supabase.co/functions/v1/send-web-push"
    Write-Output "-- SQL contém o segredo de despacho. Cole diretamente no SQL Editor Supabase; não compartilhe nem salve no repositório."
    Write-Output "select vault.create_secret('$endpoint', 'zelo_push_dispatch_url');"
    Write-Output "select vault.create_secret('$($config.PUSH_DISPATCH_SECRET)', 'zelo_push_dispatch_secret');"
    $config = $null
    $configBytes = $null
    exit 0
  }
  Write-Output "Próximo passo: execute npm exec supabase -- login e rode este script com -Deploy para configurar secrets, aplicar migrations e implantar a Edge Function."
  exit 0
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
  Invoke-Supabase link --project-ref $ProjectRef

  $protected = (Get-Content -LiteralPath $configPath -Raw).Trim()
  $configBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
    (ConvertFrom-Base64Url $protected),
    $null,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  $config = [System.Text.Encoding]::UTF8.GetString($configBytes) | ConvertFrom-Json
  Invoke-Supabase secrets set "VAPID_PUBLIC_KEY=$($config.VAPID_PUBLIC_KEY)" "VAPID_PRIVATE_KEY=$($config.VAPID_PRIVATE_KEY)" "VAPID_SUBJECT=$($config.VAPID_SUBJECT)" "PUSH_DISPATCH_SECRET=$($config.PUSH_DISPATCH_SECRET)"
  Invoke-Supabase db query --linked "create extension if not exists pg_cron; create extension if not exists pg_net; create extension if not exists supabase_vault;"
  Invoke-Supabase db query --linked --file "supabase/migrations/20261029000100_notification_push_and_absence.sql"
  Invoke-Supabase migration repair --linked --status applied 20261029000100
  $url = "https://$ProjectRef.supabase.co/functions/v1/send-web-push"
  $vaultSql = "select vault.create_secret('$url', 'zelo_push_dispatch_url') where not exists (select 1 from vault.decrypted_secrets where name = 'zelo_push_dispatch_url'); select vault.create_secret('$($config.PUSH_DISPATCH_SECRET)', 'zelo_push_dispatch_secret') where not exists (select 1 from vault.decrypted_secrets where name = 'zelo_push_dispatch_secret');"
  Invoke-Supabase db query --linked $vaultSql

  $jobsPath = [System.IO.Path]::GetFullPath((Join-Path $secretDir 'activate-push-jobs.sql'))
  $secretRoot = [System.IO.Path]::GetFullPath($secretDir)
  if (-not $jobsPath.StartsWith($secretRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Temporary SQL path escaped .secrets." }
  $jobsSql = @'
DO $$
DECLARE existing_job bigint;
BEGIN
  FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname IN ('zelo-dispatch-notification-push', 'zelo-generate-daily-birthdays') LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;
  PERFORM cron.schedule(
    'zelo-dispatch-notification-push',
    '* * * * *',
    $job$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'zelo_push_dispatch_url' LIMIT 1),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-zelo-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'zelo_push_dispatch_secret' LIMIT 1)
        ),
        body := '{}'::jsonb
      );
    $job$
  );
  PERFORM cron.schedule('zelo-generate-daily-birthdays', '0 12 * * *', 'SELECT public.generate_daily_birthday_notifications();');
END;
$$;
'@
  [System.IO.File]::WriteAllText($jobsPath, $jobsSql, [System.Text.UTF8Encoding]::new($false))
  try { Invoke-Supabase db query --linked --file $jobsPath } finally { Remove-Item -LiteralPath $jobsPath -ErrorAction SilentlyContinue }
  Invoke-Supabase functions deploy send-web-push

  Write-Output "Secrets e jobs agendados, migration de notificações aplicada e função implantada."
} finally {
  $config = $null
  $configBytes = $null
  Pop-Location
}
