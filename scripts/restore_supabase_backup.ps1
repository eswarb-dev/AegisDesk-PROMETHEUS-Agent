param(
  [string]$BackupFile = "db_backup\db_cluster-05-09-2026@12-11-03.backup.gz"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail($Message) {
  Write-Error $Message
  exit 1
}

function Get-BackupFormat([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $readStream = $stream
    if ($Path.EndsWith(".gz", [System.StringComparison]::OrdinalIgnoreCase)) {
      $readStream = [System.IO.Compression.GZipStream]::new($stream, [System.IO.Compression.CompressionMode]::Decompress)
    }

    $buffer = [byte[]]::new(8)
    $count = $readStream.Read($buffer, 0, $buffer.Length)
    $prefix = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $count)
    if ($prefix.StartsWith("PGDMP")) { return "custom" }
    return "plain-sql"
  }
  finally {
    if ($null -ne $readStream -and -not [object]::ReferenceEquals($readStream, $stream)) { $readStream.Dispose() }
    $stream.Dispose()
  }
}

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) {
  Fail "SUPABASE_DB_URL is required. Set it in the current PowerShell session. The value will not be printed."
}

if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) {
  Fail "Backup file not found: $BackupFile"
}

$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$format = Get-BackupFormat -Path $resolvedBackup

Write-Host "Supabase DB URL configured: true"
Write-Host "Backup file: $resolvedBackup"
Write-Host "Detected backup format: $format"
Write-Host "WARNING: Restoring may overwrite or conflict with existing tables. Restore into a fresh empty Supabase project unless you have verified the target state."
$confirmation = Read-Host "Type RESTORE to continue"
if ($confirmation -ne "RESTORE") {
  Write-Host "Restore cancelled."
  exit 0
}

$tempFile = $null
$restorePath = $resolvedBackup
try {
  if ($resolvedBackup.EndsWith(".gz", [System.StringComparison]::OrdinalIgnoreCase)) {
    $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("prometheus-supabase-restore-" + [System.Guid]::NewGuid().ToString("N") + ".backup")
    $source = [System.IO.File]::OpenRead($resolvedBackup)
    try {
      $gzip = [System.IO.Compression.GZipStream]::new($source, [System.IO.Compression.CompressionMode]::Decompress)
      try {
        $target = [System.IO.File]::Create($tempFile)
        try { $gzip.CopyTo($target) } finally { $target.Dispose() }
      }
      finally { $gzip.Dispose() }
    }
    finally { $source.Dispose() }
    $restorePath = $tempFile
  }

  if ($format -eq "custom") {
    $pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
    if (-not $pgRestore) { Fail "pg_restore was not found on PATH." }
    & $pgRestore.Source --verbose --clean --if-exists --no-owner --no-privileges --dbname $env:SUPABASE_DB_URL $restorePath
  }
  else {
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psql) { Fail "psql was not found on PATH." }
    & $psql.Source --set ON_ERROR_STOP=on --dbname $env:SUPABASE_DB_URL --file $restorePath
  }

  if ($LASTEXITCODE -ne 0) { Fail "Restore command failed with exit code $LASTEXITCODE." }
  Write-Host "Restore completed. Run: npx tsx scripts/verify_supabase_restore.ts"
}
finally {
  if ($tempFile -and (Test-Path -LiteralPath $tempFile)) {
    Remove-Item -LiteralPath $tempFile -Force
  }
}
