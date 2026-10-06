# Deploys Charla to Cloudflare: the API as a Worker, the app to Pages.
# Run from the charla folder in PowerShell, after `npx wrangler login`:
#
#   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
#
# Safe to run again; every step is idempotent. The first run creates the Pages
# project and the remote tables. It prints the two URLs at the end.

$ErrorActionPreference = 'Stop'
$env:Path = "$env:LOCALAPPDATA\nodejs;" + $env:Path
Set-Location (Join-Path $PSScriptRoot '..')

$project = 'charla-naperville'     # becomes https://charla-naperville.pages.dev
$pagesUrl = "https://$project.pages.dev"

Write-Host "`n1/5  Remote database tables" -ForegroundColor Cyan
npx wrangler d1 execute charla --remote --config worker/wrangler.toml --file worker/schema.sql -y

Write-Host "`n2/5  Pages project" -ForegroundColor Cyan
$existing = npx wrangler pages project list 2>$null | Select-String -SimpleMatch $project
if (-not $existing) {
  npx wrangler pages project create $project --production-branch main
} else {
  Write-Host "  $project already exists"
}

Write-Host "`n3/5  Worker (the API)" -ForegroundColor Cyan
# The Worker only answers the app's own origin.
# Written through .NET, not Set-Content: Windows PowerShell's -Encoding utf8
# prepends a byte-order mark, which shows up as a changed first line in git.
$noBom = New-Object System.Text.UTF8Encoding($false)
$toml = (Get-Content worker/wrangler.toml -Raw) -replace 'ALLOWED_ORIGIN = "[^"]*"', "ALLOWED_ORIGIN = `"$pagesUrl`""
[System.IO.File]::WriteAllText((Join-Path (Get-Location) 'worker/wrangler.toml'), $toml, $noBom)
$out = npx wrangler deploy --config worker/wrangler.toml 2>&1 | Tee-Object -Variable deployLog
$workerUrl = ($deployLog | Select-String -Pattern 'https://[a-z0-9.-]+\.workers\.dev' -AllMatches).Matches |
  Select-Object -First 1 -ExpandProperty Value
if (-not $workerUrl) { throw "Could not find the Worker URL in wrangler's output above." }
Write-Host "  API at $workerUrl"

Write-Host "`n4/5  App build, pointed at the API" -ForegroundColor Cyan
# The CSP in public/_headers must allow the API origin or every call fails silently.
$headers = (Get-Content public/_headers -Raw) -replace "connect-src 'self'[^;]*;", "connect-src 'self' https://tiles.openfreemap.org $workerUrl;"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) 'public/_headers'), $headers, $noBom)
$env:VITE_API_BASE = $workerUrl
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }

Write-Host "`n5/5  Pages upload" -ForegroundColor Cyan
npx wrangler pages deploy dist --project-name $project --branch main --commit-dirty=true

Write-Host "`nDone." -ForegroundColor Green
Write-Host "  App:  $pagesUrl"
Write-Host "  API:  $workerUrl"
Write-Host "`nOpen the app link on a phone in Safari, then Share > Add to Home Screen."
Write-Host "To switch the partner to Claude later:  npx wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.toml"
Write-Host "Commit the two files this changed (worker/wrangler.toml, public/_headers) so the URLs stay in the repo."
