param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("init", "start", "stop", "status", "reset-db", "app-check", "bootstrap-admin", "dev")]
  [string]$Mode,

  [string]$BaseDir = "C:\KaguLocal",
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
  [string]$DbName = "kagu_muhasebe_acceptance",
  [int]$Port = 55432,
  [string]$AdminUsername = "admin",
  [string]$AdminFullName = "Admin"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppOrigin = "http://localhost:3000"
$AuthSecret = "local-acceptance-placeholder-secret-change-before-production"

if ($DbName -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
  Write-Error "DbName must be a simple PostgreSQL identifier. Received: $DbName"
  exit 1
}

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message"
}

function Fail-Step {
  param(
    [string]$Step,
    [string]$Message
  )

  Write-Error "Step failed [$Step]: $Message"
  exit 1
}

function Resolve-Tool {
  param([string]$Name)

  $path = Join-Path $PgBin $Name
  if (-not (Test-Path -LiteralPath $path)) {
    Fail-Step "resolve-tool" "Could not find $Name under PgBin: $PgBin"
  }

  return $path
}

function Get-Paths {
  $base = [System.IO.Path]::GetFullPath($BaseDir)

  return [pscustomobject]@{
    Base = $base
    Repo = Join-Path $base "KaguWebMuhasebe"
    Data = Join-Path $base "pgdata"
    Logs = Join-Path $base "logs"
    Scripts = Join-Path $base "scripts"
    App = Join-Path $base "KaguWebMuhasebe\apps\muhasebe-web"
    PostgresLog = Join-Path $base "logs\postgres.log"
  }
}

function Assert-AppDir {
  $paths = Get-Paths
  if (-not (Test-Path -LiteralPath (Join-Path $paths.App "package.json"))) {
    Fail-Step "app-dir" "Expected app directory was not found: $($paths.App). Clone or copy this repo to $($paths.Repo)."
  }

  return $paths.App
}

function Get-PlainTextSecret {
  param(
    [string]$EnvName,
    [string]$Prompt
  )

  $existing = [Environment]::GetEnvironmentVariable($EnvName, "Process")
  if (-not [string]::IsNullOrWhiteSpace($existing)) {
    return $existing
  }

  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}

function ConvertTo-DatabaseUrlPassword {
  param([string]$Password)

  return [System.Uri]::EscapeDataString($Password)
}

function Invoke-Native {
  param(
    [string]$Step,
    [string]$FilePath,
    [string[]]$Arguments
  )

  Write-Step "$Step"
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail-Step $Step "$FilePath exited with code $LASTEXITCODE"
  }
}

function Invoke-Npm {
  param(
    [string]$Step,
    [string[]]$Arguments
  )

  Invoke-Native -Step $Step -FilePath "npm.cmd" -Arguments $Arguments
}

function Invoke-Npx {
  param(
    [string]$Step,
    [string[]]$Arguments
  )

  Invoke-Native -Step $Step -FilePath "npx.cmd" -Arguments $Arguments
}

function Test-PostgresRunning {
  $pgCtl = Resolve-Tool "pg_ctl.exe"
  $paths = Get-Paths

  & $pgCtl "-D" $paths.Data "status" *> $null
  return ($LASTEXITCODE -eq 0)
}

function Set-PostgresConfValue {
  param(
    [string]$FilePath,
    [string]$Name,
    [string]$Value
  )

  $line = "$Name = $Value"
  $pattern = "^\s*#?\s*$([regex]::Escape($Name))\s*="

  if (-not (Test-Path -LiteralPath $FilePath)) {
    Fail-Step "configure-postgresql" "Missing postgresql.conf: $FilePath"
  }

  $content = Get-Content -LiteralPath $FilePath
  $updated = $false
  $next = foreach ($existing in $content) {
    if ($existing -match $pattern) {
      $updated = $true
      $line
    } else {
      $existing
    }
  }

  if (-not $updated) {
    $next += $line
  }

  Set-Content -LiteralPath $FilePath -Value $next -Encoding ascii
}

function Set-AcceptanceEnv {
  param([string]$PostgresPassword)

  $encodedPassword = ConvertTo-DatabaseUrlPassword -Password $PostgresPassword
  $env:DATABASE_URL = "postgresql://postgres:$encodedPassword@localhost:$Port/$DbName`?schema=public"
  $env:AUTH_SECRET = $AuthSecret
  $env:KAGU_APP_ORIGIN = $AppOrigin
  $env:KAGU_BACKUP_PLAN_ACK = "true"
  $env:NEXT_TELEMETRY_DISABLED = "1"
}

function Invoke-Psql {
  param(
    [string]$Step,
    [string]$Database,
    [string]$Command,
    [string]$PostgresPassword
  )

  $psql = Resolve-Tool "psql.exe"
  $previousPassword = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")
  $env:PGPASSWORD = $PostgresPassword
  try {
    Invoke-Native -Step $Step -FilePath $psql -Arguments @(
      "-h", "localhost",
      "-p", "$Port",
      "-U", "postgres",
      "-d", $Database,
      "-v", "ON_ERROR_STOP=1",
      "-c", $Command
    )
  } finally {
    if ($null -eq $previousPassword) {
      Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    } else {
      $env:PGPASSWORD = $previousPassword
    }
  }
}

function Initialize-Cluster {
  $paths = Get-Paths
  $initdb = Resolve-Tool "initdb.exe"
  $postgresPassword = [Environment]::GetEnvironmentVariable("POSTGRES_PASSWORD", "Process")

  foreach ($dir in @($paths.Base, $paths.Repo, $paths.Data, $paths.Logs, $paths.Scripts)) {
    if (-not (Test-Path -LiteralPath $dir)) {
      Write-Step "Creating $dir"
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
  }

  $dataItems = @(Get-ChildItem -LiteralPath $paths.Data -Force -ErrorAction SilentlyContinue)
  if ($dataItems.Count -gt 0) {
    Write-Host "pgdata is not empty; skipping initdb: $($paths.Data)"
  } else {
    $initdbArguments = @(
      "-D", $paths.Data,
      "-U", "postgres",
      "-A", "scram-sha-256",
      "--locale=C",
      "--encoding=UTF8"
    )

    $passwordFile = $null
    if (-not [string]::IsNullOrWhiteSpace($postgresPassword)) {
      $passwordFile = Join-Path $paths.Base "scripts\postgres-password.tmp"
      Set-Content -LiteralPath $passwordFile -Value $postgresPassword -NoNewline -Encoding ascii
      $initdbArguments += @("--pwfile", $passwordFile)
    } else {
      $initdbArguments += "-W"
    }

    try {
      Invoke-Native -Step "initdb isolated local acceptance cluster" -FilePath $initdb -Arguments $initdbArguments
    } finally {
      if ($passwordFile -and (Test-Path -LiteralPath $passwordFile)) {
        Remove-Item -LiteralPath $passwordFile -Force
      }
    }
  }

  $postgresqlConf = Join-Path $paths.Data "postgresql.conf"
  Set-PostgresConfValue -FilePath $postgresqlConf -Name "port" -Value "$Port"
  Set-PostgresConfValue -FilePath $postgresqlConf -Name "listen_addresses" -Value "'localhost'"
  Write-Host "Configured isolated PostgreSQL cluster at $($paths.Data). No Windows PostgreSQL service was changed."
}

function Start-Cluster {
  $paths = Get-Paths
  $pgCtl = Resolve-Tool "pg_ctl.exe"

  if (Test-PostgresRunning) {
    Write-Host "PostgreSQL local acceptance cluster is already running on port $Port."
    return
  }

  if (-not (Test-Path -LiteralPath (Join-Path $paths.Data "PG_VERSION"))) {
    Fail-Step "start" "PostgreSQL data directory is not initialized: $($paths.Data). Run init first."
  }

  if (-not (Test-Path -LiteralPath $paths.Logs)) {
    New-Item -ItemType Directory -Path $paths.Logs -Force | Out-Null
  }

  Invoke-Native -Step "start isolated PostgreSQL cluster" -FilePath $pgCtl -Arguments @(
    "-D", $paths.Data,
    "-l", $paths.PostgresLog,
    "start"
  )
}

function Stop-Cluster {
  $paths = Get-Paths
  $pgCtl = Resolve-Tool "pg_ctl.exe"

  if (-not (Test-PostgresRunning)) {
    Write-Host "PostgreSQL local acceptance cluster is not running."
    return
  }

  Invoke-Native -Step "stop isolated PostgreSQL cluster" -FilePath $pgCtl -Arguments @(
    "-D", $paths.Data,
    "stop"
  )
}

function Show-Status {
  $paths = Get-Paths
  $pgCtl = Resolve-Tool "pg_ctl.exe"

  Write-Step "pg_ctl status"
  & $pgCtl "-D" $paths.Data "status"
  $running = ($LASTEXITCODE -eq 0)

  if (-not $running) {
    Write-Host "PostgreSQL local acceptance cluster is not running."
    return
  }

  $password = Get-PlainTextSecret -EnvName "POSTGRES_PASSWORD" -Prompt "PostgreSQL password"
  Invoke-Psql -Step "psql SELECT version()" -Database "postgres" -Command "SELECT version();" -PostgresPassword $password
  Invoke-Psql -Step "check acceptance database exists" -Database "postgres" -Command "SELECT datname FROM pg_database WHERE datname = '$DbName';" -PostgresPassword $password
}

function Reset-Database {
  if (-not (Test-PostgresRunning)) {
    Fail-Step "reset-db" "PostgreSQL local acceptance cluster is not running. Run start first."
  }

  $appDir = Assert-AppDir
  $password = Get-PlainTextSecret -EnvName "POSTGRES_PASSWORD" -Prompt "PostgreSQL password"

  Invoke-Psql -Step "drop acceptance database" -Database "postgres" -Command "DROP DATABASE IF EXISTS $DbName WITH (FORCE);" -PostgresPassword $password
  Invoke-Psql -Step "create acceptance database" -Database "postgres" -Command "CREATE DATABASE $DbName;" -PostgresPassword $password

  Push-Location $appDir
  try {
    Set-AcceptanceEnv -PostgresPassword $password
    Invoke-Npx -Step "prisma migrate deploy" -Arguments @("prisma", "migrate", "deploy")
    Invoke-Npx -Step "prisma migrate status" -Arguments @("prisma", "migrate", "status")
  } finally {
    Pop-Location
  }
}

function Invoke-AppCheck {
  $appDir = Assert-AppDir
  $password = Get-PlainTextSecret -EnvName "POSTGRES_PASSWORD" -Prompt "PostgreSQL password"

  Push-Location $appDir
  try {
    Set-AcceptanceEnv -PostgresPassword $password
    Invoke-Npm -Step "npm ci" -Arguments @("ci")
    Invoke-Npm -Step "npm run prisma:generate" -Arguments @("run", "prisma:generate")
    Invoke-Npm -Step "npm run prisma:validate" -Arguments @("run", "prisma:validate")
    Invoke-Npx -Step "prisma migrate deploy" -Arguments @("prisma", "migrate", "deploy")
    Invoke-Npx -Step "prisma migrate status" -Arguments @("prisma", "migrate", "status")
    Invoke-Npm -Step "npm run typecheck" -Arguments @("run", "typecheck")
    Invoke-Npm -Step "npm run lint" -Arguments @("run", "lint")
    Invoke-Npm -Step "npm run test" -Arguments @("run", "test")
    Invoke-Npm -Step "npm run build" -Arguments @("run", "build")
    Invoke-Npm -Step "npm run production:check" -Arguments @("run", "production:check")
  } finally {
    Pop-Location
  }
}

function Invoke-BootstrapAdmin {
  $appDir = Assert-AppDir
  $postgresPassword = Get-PlainTextSecret -EnvName "POSTGRES_PASSWORD" -Prompt "PostgreSQL password"
  $adminPassword = Get-PlainTextSecret -EnvName "ADMIN_PASSWORD" -Prompt "Admin password"

  Push-Location $appDir
  try {
    Set-AcceptanceEnv -PostgresPassword $postgresPassword
    $env:ADMIN_USERNAME = $AdminUsername
    $env:ADMIN_FULL_NAME = $AdminFullName
    $env:ADMIN_PASSWORD = $adminPassword
    Invoke-Npm -Step "npm run admin:bootstrap" -Arguments @("run", "admin:bootstrap")
  } finally {
    Remove-Item Env:\ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Pop-Location
  }
}

function Start-DevServer {
  $appDir = Assert-AppDir
  $password = Get-PlainTextSecret -EnvName "POSTGRES_PASSWORD" -Prompt "PostgreSQL password"

  Push-Location $appDir
  try {
    Set-AcceptanceEnv -PostgresPassword $password
    Write-Host "Open $AppOrigin"
    Invoke-Npm -Step "npm run dev" -Arguments @("run", "dev")
  } finally {
    Pop-Location
  }
}

try {
  switch ($Mode) {
    "init" { Initialize-Cluster }
    "start" { Start-Cluster }
    "stop" { Stop-Cluster }
    "status" { Show-Status }
    "reset-db" { Reset-Database }
    "app-check" { Invoke-AppCheck }
    "bootstrap-admin" { Invoke-BootstrapAdmin }
    "dev" { Start-DevServer }
  }
} catch {
  Fail-Step $Mode $_.Exception.Message
}
