$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$env:DATA_DIR = Join-Path $projectRoot 'backend/data-server'
$env:PUBLIC_ORIGIN = 'https://gym.example/rutinatrack'
$env:PUBLIC_DIR = Join-Path $projectRoot 'frontend/dist-server'
$env:HOST = '127.0.0.1'
$env:PORT = '3132'
$env:NODE_ENV = 'production'
Set-Location (Join-Path $projectRoot 'backend')
& node scripts/bootstrap.js
exit $LASTEXITCODE
