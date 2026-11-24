# 배포

**GitHub Actions로 Cloudflare Workers와 D1에 배포합니다.** 배포에는 Cloudflare 토큰이 필요합니다. 챗봇은 별도 AI 키 없이 Workers AI로 위키 자료를 요약합니다.

| 무엇 | 어디 |
|---|---|
| 서버 (API `/api/*`) | Cloudflare **Workers** (`backend/src/worker.js`) |
| DB (교수님 자료 · 제보 · 한마디 · 챗봇 기록) | Cloudflare **D1** (`gsc-db`) |
| 화면 (빌드된 프론트) | Workers 정적 파일 (`frontend/dist`) |
| 배포 | **GitHub Actions** (`.github/workflows/deploy.yml`) |
| 주소 | `https://gsc-professor-user-guide.<계정 이름>.workers.dev` (고정) |

## 흐름

| 언제 | GitHub Actions 가 하는 일 |
|---|---|
| PR 을 열거나 고칠 때 | 빌드 → 검색·챗봇 테스트 → Node 및 로컬 Workers/D1 기능 점검 |
| `main` 에 push · merge | 위 테스트 통과 → D1 준비 · 기본 자료 반영 → Workers 배포 → 배포된 주소 점검 |
| Actions 탭 → Run workflow (브랜치 `main`) | 위와 같음 (수동) |

- 테스트를 하나라도 통과하지 못하면 배포하지 않습니다.
- 배포할 때 기본 자료(`backend/data/profs.json`)만 다시 넣고, **선배 제보 · 한마디 · 챗봇 기록은 그대로** 둡니다. D1 은 계속 유지되므로 재배포해도 데이터가 사라지지 않습니다.

## 처음 한 번: 저장소 주인이 할 일

1. <https://dash.cloudflare.com> 가입 (무료, 카드 필요 없음)
2. 왼쪽 메뉴 **Workers & Pages** 를 한 번 열기 — `workers.dev` 하위 주소(계정 이름)를 정하라고 하면 정하기
3. **계정 ID** 복사: Workers & Pages 화면 오른쪽 **Account ID**
4. **API 토큰** 만들기: 오른쪽 위 프로필 → **My Profile → API Tokens → Create Token**
   - 템플릿 **Edit Cloudflare Workers** 선택 → 권한에 **Account · D1 · Edit** 추가 → Continue → Create
   - 만든 토큰 문자열 복사 (다시 볼 수 없음)
5. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

   | 이름 | 값 | 필수 |
   |---|---|---|
   | `CLOUDFLARE_API_TOKEN` | 4번 토큰 | 필수 |
   | `CLOUDFLARE_ACCOUNT_ID` | 3번 계정 ID | 필수 |
   | `ADMIN_PASSWORD` | 관리자 페이지 비밀번호 (길고 추측하기 어렵게) | 선택 |
   | `ANTHROPIC_API_KEY` | Claude 답변 · AI 퀴즈 · 제보 AI 정리를 사용하는 경우에만 등록. 등록하면 챗봇도 Claude를 사용합니다. | 선택 |

6. **Actions** 탭 → "Test & deploy to Cloudflare" → **Run workflow** (또는 `main` 에 아무 merge)
7. 실행 결과 맨 아래 **배포 완료: https://….workers.dev** 주소 확인

D1 데이터베이스(`gsc-db`)는 Actions 가 처음 배포할 때 **자동으로 만듭니다.** 시크릿은 저장소 주인 · 관리자만 추가할 수 있습니다.
Cloudflare 배포 시크릿이 빠져 있으면 배포 작업은 실패하고 누락된 항목을 표시합니다.

## 확인

- GitHub **Actions** 탭에서 초록색 체크
- `https://<주소>/api/health`에서 `ok: true`, 양수인 `chunks`, `runtime: "d1"`을 확인합니다. Workers AI가 연결되면 `chatModel`에 모델 이름이 나옵니다.
- 홈 GREP 창에서 “면담 갈 때 뭘 준비해야 돼?”를 질문해 답변과 위키 출처를 확인합니다. Claude 키가 없으면 기본 4지선다 퀴즈가 나옵니다.
- `https://<주소>/admin` → `ADMIN_PASSWORD` 로 로그인

## 무료 플랜 한도

- Workers: 하루 요청 10만 번
- D1: 저장 5GB, 하루 읽기 500만 행 · 쓰기 10만 행
- Workers AI: 하루 10,000 Neurons. 모델과 입력·출력 길이에 따라 사용량이 달라집니다. 무료 한도에 도달하거나 답변 생성에 실패하면 챗봇이 검색 결과와 출처를 보여줍니다. 관련 자료가 없는 질문에는 AI를 호출하지 않습니다. [Workers AI 요금](https://developers.cloudflare.com/workers-ai/platform/pricing/)


## 내 PC 에서 Cloudflare 와 똑같이 돌려 보기 (선택)

```powershell
npm ci
npm run build
npm run cf:seed:local     # 내 PC 의 가짜 D1 에 표 + 기본 자료
npm run cf:dev            # http://localhost:8787 — 로컬 Workers/D1, 검색형 챗봇
```

관리자 비밀번호는 저장소 폴더에 `.dev.vars` 파일을 만들고 `ADMIN_PASSWORD=…` 한 줄 (커밋되지 않음).

실제 Workers AI도 로컬 화면에서 확인하려면 Cloudflare 계정으로 Wrangler에 로그인하고 `npx wrangler dev`를 실행합니다. AI 호출은 Cloudflare 한도를 사용합니다. PR의 자동 테스트는 AI 바인딩 응답을 재현해 테스트하므로 API 키와 Cloudflare 로그인 없이 실행됩니다.

## 발표 · 시연 백업: 내 PC + Cloudflare Tunnel

Cloudflare 배포가 아직 안 됐거나 인터넷이 불안할 때를 위한 백업입니다. PC 에서 Node 서버를 켜고 `https://….trycloudflare.com` 임시 주소를 붙입니다.

```powershell
winget install --id Cloudflare.cloudflared     # 처음 한 번
powershell -ExecutionPolicy Bypass -File .\demo.ps1 -SkipBuild
```

- 터널 창에 나오는 주소를 공유 (켤 때마다 바뀜), 끝나면 터널 창 `Ctrl+C` + 서버 창 닫기
- PC 가 꺼지거나 절전되면 사이트도 꺼짐. 데이터는 PC 의 `backend/data/gsc.db` 에 남음 (Cloudflare D1 과는 별개)

## 기본 자료를 고쳤을 때

`frontend/src/data/profs/*.jsx` 를 고친 뒤:

```bash
cd frontend && npm run export-data   # backend/data/profs.json 갱신
cd ../backend && npm run eval        # 검색 정확도 확인 (선택)
```

`.jsx` 와 `profs.json` 을 같이 커밋 · PR → `main` 에 merge 하면 Actions 가 D1 에 반영합니다.

## 왜 GitHub Pages 가 아닌가

GitHub Pages 는 정적 파일만 올릴 수 있어서 챗봇 · 제보 · 한마디 · 관리자(서버 + DB 필요)가 동작하지 않습니다.
그래서 GitHub Actions 로 테스트 · 배포하고, 실제 서버와 DB 는 Cloudflare Workers + D1 이 맡습니다.
