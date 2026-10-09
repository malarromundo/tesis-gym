# Ejecutar como administrador. Solo abre los puertos del proxy HTTPS.
$ErrorActionPreference = 'Stop'
$caddyPath = (Resolve-Path (Join-Path $PSScriptRoot 'bin/caddy.exe')).Path
$ruleName = 'RutinaTrack-HTTPS-Servidor'
if (-not (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name $ruleName -DisplayName 'RutinaTrack HTTPS (gym.example)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80,443 -Program $caddyPath -Profile Any -ErrorAction Stop | Out-Null
}
Write-Host 'Regla TCP 80/443 aplicada exclusivamente a Caddy. No se expuso la base ni el backend interno.'
