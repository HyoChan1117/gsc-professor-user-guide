# ============================================================================
#  발표용 실행: 이 PC에서 서버를 켜고 Cloudflare Tunnel로 인터넷 주소를 붙입니다.
#  사용법 (저장소 폴더에서):  powershell -ExecutionPolicy Bypass -File .\demo.ps1
#    -SkipBuild   프론트를 다시 빌드하지 않음 (코드를 안 고쳤으면 더 빨리 켜짐)
#
#  - 서버: 새 창에서 실행 (http://localhost:8787) — 이 창을 닫으면 사이트가 꺼집니다
#  - 터널: 이 창에서 실행 — 출력에 나오는 https://….trycloudflare.com 이 공개 주소
#          Ctrl+C 로 터널 종료 (주소는 켤 때마다 바뀝니다)
#  - 관리자 페이지를 쓰려면 backend/.env 에 ADMIN_PASSWORD=… 를 넣어 두세요
#  - 데이터(제보 · 한마디)는 backend/data/gsc.db 에 남습니다 (껐다 켜도 유지)
# ============================================================================
param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$Port = 8787

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host 'cloudflared 가 없습니다. 설치: winget install --id Cloudflare.cloudflared' -ForegroundColor Red
  exit 1
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "포트 $Port 를 이미 쓰는 프로그램이 있습니다 (개발 서버가 켜져 있으면 끄고 다시 실행하세요)." -ForegroundColor Red
  exit 1
}

if (-not $SkipBuild -or -not (Test-Path 'frontend/dist/index.html')) {
  Write-Host '> 빌드 중 (프론트 + 백엔드 패키지)...' -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw '빌드 실패' }
}
if (-not (Test-Path 'backend/.env') -or -not (Select-String -Path 'backend/.env' -Pattern '^ADMIN_PASSWORD=.+' -Quiet)) {
  Write-Host '! backend/.env 에 ADMIN_PASSWORD 가 없어 관리자 페이지(/admin)는 꺼진 상태로 켜집니다.' -ForegroundColor Yellow
}

# 서버 — 새 창. TRUST_PROXY: 터널을 거쳐 온 접속자 IP별로 요청 제한 (안 하면 전원이 같은 IP로 묶임)
Write-Host "> 서버 시작 (새 창) — http://localhost:$Port" -ForegroundColor Cyan
$serverCmd = "`$env:TRUST_PROXY='1'; `$env:PORT='$Port'; Set-Location '$PSScriptRoot'; npm start"
Start-Process powershell -ArgumentList '-NoExit', '-Command', $serverCmd | Out-Null

# 서버가 응답할 때까지 대기 (최대 60초)
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  try { Invoke-RestMethod "http://localhost:$Port/api/health" -TimeoutSec 2 | Out-Null; $ok = $true; break } catch { Start-Sleep -Seconds 1 }
}
if (-not $ok) { throw '서버가 60초 안에 켜지지 않았습니다. 서버 창의 오류를 확인하세요.' }

Write-Host ''
Write-Host '> 터널 시작 — 아래에 나오는 https://….trycloudflare.com 주소를 공유하세요 (Ctrl+C 로 종료)' -ForegroundColor Green
cloudflared tunnel --url "http://localhost:$Port"
