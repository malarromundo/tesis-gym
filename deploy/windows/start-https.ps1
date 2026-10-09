$ErrorActionPreference = 'Stop'
throw 'El HTTPS de gym.example pertenece al Caddy de Ubuntu. Integre rutinatrack.caddy allí; no inicie un segundo proxy en Windows. Consulte README.md.'
$env:XDG_DATA_HOME = Join-Path $PSScriptRoot 'state/data'
$env:XDG_CONFIG_HOME = Join-Path $PSScriptRoot 'state/config'
New-Item -ItemType Directory -Force $env:XDG_DATA_HOME,$env:XDG_CONFIG_HOME | Out-Null
Set-Location $PSScriptRoot
& (Join-Path $PSScriptRoot 'bin/caddy.exe') run --config (Join-Path $PSScriptRoot 'Caddyfile') --adapter caddyfile
exit $LASTEXITCODE
