# 배포

서버 하나가 **빌드된 프론트 화면 + `/api`** 를 같이 제공합니다. API 키 없이 동작합니다.

## 발표 · 시연: 내 PC + Cloudflare Tunnel (가입 필요 없음)

PC에서 서버를 켜고 `https://….trycloudflare.com` 공개 주소를 붙입니다. 잠들지 않고, 제보 · 한마디가 PC의 DB 파일에 계속 남습니다.

```powershell
winget install --id Cloudflare.cloudflared     # 처음 한 번
powershell -ExecutionPolicy Bypass -File .\demo.ps1            # 빌드 + 서버(새 창) + 터널
powershell -ExecutionPolicy Bypass -File .\demo.ps1 -SkipBuild # 코드를 안 고쳤으면 빠르게
```

- 터널 창에 나오는 `https://….trycloudflare.com` 주소를 공유 (**켤 때마다 주소가 바뀜** — 발표 직전에 켜고 공유)
- 끄기: 터널 창 `Ctrl+C` + 서버 창 닫기
- PC가 꺼지거나 절전되면 사이트도 꺼짐 → 전원 연결, 절전 끄기
- 관리자 페이지를 쓰려면 `backend/.env` 에 `ADMIN_PASSWORD=…` (공개 주소이므로 길고 어렵게)
- 개발 서버(`npm run dev`)가 8787 포트를 쓰고 있으면 먼저 끄기

## 계속 운영: GitHub Actions → Render

`main` 에 push · merge 하면 **GitHub Actions** 가 빌드 → 검색 정확도 테스트 → 서버 실행 확인을 하고, 통과하면 **Render** 에 배포 신호를 보냅니다.
사이트가 실제로 돌아가는 곳은 Render 입니다 (GitHub Actions · Pages 만으로는 서버와 DB를 띄울 수 없음).

| 언제 | Actions 가 하는 일 |
|---|---|
| PR 을 열거나 고칠 때 | 빌드 + 테스트만 (PR 화면에 통과 · 실패 표시) |
| `main` 에 push · merge | 테스트 통과 → Render 배포 훅 호출 → Render 가 새 코드로 다시 배포 |
| Actions 탭 → Run workflow | 위와 같음 (수동) |

워크플로: `.github/workflows/deploy.yml`. 테스트 기준은 `npm run eval:check` (1위 정답률 · 무관한 질문 거르기 75% 이상).

```
npm run build   # 프론트 빌드(frontend/dist) + 백엔드 패키지 설치
npm start       # DB 만들기(seed) → 서버 실행 (PORT 환경 변수, 기본 8787)
```

### 처음 한 번: Render 서비스 만들기 + Actions 연결

1. <https://render.com> 에 GitHub 계정으로 가입 (무료, 카드 필요 없음)
2. **New → Blueprint** → 이 저장소 선택 → 저장소의 `render.yaml` 을 그대로 사용
   (저장소 주인 계정에 Render GitHub 앱 설치가 필요 — 주인이 하는 게 가장 간단)
3. 환경 변수 입력 화면에서
   - `ADMIN_PASSWORD`: 관리자 페이지 비밀번호 (길고 추측하기 어렵게)
   - `ANTHROPIC_API_KEY`: 비워 둬도 됨 (넣으면 AI 답변 · AI 퀴즈가 켜짐)
4. **Apply** → 첫 배포 후 `https://<서비스 이름>.onrender.com` 주소가 생김
5. Render 서비스 → **Settings → Deploy Hook** 주소 복사
6. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
   - 이름 `RENDER_DEPLOY_HOOK_URL`, 값 = 5번 주소 (**저장소 주인 · 관리자만** 추가 가능)

이후 `main` 에 merge 하면 Actions 가 테스트하고 배포합니다. `render.yaml` 의 `autoDeploy: false` 라서 테스트를 통과하지 못한 코드는 배포되지 않습니다.
시크릿이 없으면 Actions 는 테스트만 하고 배포 단계는 건너뜁니다 (실패로 표시되지 않음).

### 확인

- GitHub 저장소 **Actions** 탭 → "Build, test & deploy" 가 초록색
- `https://<주소>/api/health` → `{"ok":true,"chunks":49,...}`
- 홈 GREP 창에 질문 → 자료가 나오면 정상
- `https://<주소>/admin` → `ADMIN_PASSWORD` 로 로그인

### 무료 플랜에서 알아 둘 것

| 상황 | 결과 | 대처 |
|---|---|---|
| 15분 동안 접속 없음 | 서버가 잠듦 → 다음 첫 접속이 **30~60초** 걸림 | **발표 5분 전에 한 번 접속**해서 깨워 두기 |
| 서버 재시작 · 재배포 | 디스크가 초기화 → **선배 제보 · 챗봇 기록이 사라짐** (기본 자료는 seed 로 다시 생김) | 시연용으로는 괜찮음. 계속 운영하려면 아래 "제보를 계속 남기려면" |
| 요청 제한 | 접속자 IP마다 따로 셈 (`TRUST_PROXY=1`) | 강의실 와이파이에서는 여러 명이 같은 IP일 수 있음 → 챗봇 1분 20번 · 퀴즈 1분 6번 |

#### 제보를 계속 남기려면

Render 유료 플랜 + **Persistent Disk** 를 붙이고 환경 변수 `DB_PATH=/var/data/gsc.db` (디스크 경로)를 넣으면 재시작해도 DB가 유지됩니다.
`npm start` 의 seed 는 제보(contributions) · 챗봇 기록을 지우지 않고 기본 자료만 다시 채웁니다.

## 기본 자료를 고쳤을 때

`frontend/src/data/profs/*.jsx` 를 고친 뒤:

```bash
cd frontend && npm run export-data   # backend/data/profs.json 갱신
```

`backend/data/profs.json` 까지 커밋 · push 하면 배포 때 seed 가 새 자료로 DB를 만듭니다.

## 왜 GitHub Pages 가 아닌가

GitHub Pages 는 정적 파일만 올릴 수 있어서 챗봇 · 퀴즈 · 제보 · 관리자(서버 + DB 필요)가 동작하지 않습니다.
화면만 보여 주는 용도라면 가능하지만, 이 프로젝트의 핵심 기능이 빠집니다.
