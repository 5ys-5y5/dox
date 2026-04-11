$ErrorActionPreference = 'Stop'

# Force UTF-8 (no BOM) for console I/O in this PowerShell session.
# This is critical even if `chcp 65001` was executed in the parent process.
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

# Best-effort: ensure the current console code page is UTF-8.
try { chcp 65001 | Out-Null } catch {}

$target = Join-Path $PSScriptRoot 'scripts\codex-notify.ps1'
if (-not (Test-Path -LiteralPath $target)) {
  throw "Missing script: $target (현재 레포에 파일이 없어서 실행이 불가능합니다. 실제 파일 위치/생성 과정을 확인해주세요.)"
}

& $target @args
exit $LASTEXITCODE

