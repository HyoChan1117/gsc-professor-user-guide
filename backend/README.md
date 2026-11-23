# Backend — DB + RAG 챗봇

홈 히어로의 GREP 입력창에 질문하면, 선배들의 설문 자료(DB)에서 관련 내용을 찾아 답하는 API 서버입니다.

- **DB**: SQLite (`data/gsc.db`) — Node 내장 `node:sqlite` 사용, 별도 설치 없음 (Node 22.13 이상)
- **검색**: 키워드 검색 (`src/search.js` — 글자 2개 단위 + BM25 + 비슷한 말 사전). **API 키 필요 없음**
- **답변**: 기본은 찾은 자료를 그대로 보여 주는 **검색 모드**. (선택) `ANTHROPIC_API_KEY`를 넣으면 Claude가 자료를 바탕으로 답변 · 퀴즈 출제 · 제보 정리

## 처음 실행

```bash
# 1) (선택) 환경 변수 — 없어도 동작. 관리자 페이지를 쓰려면 ADMIN_PASSWORD 필요
cp .env.example .env

# 2) 프론트 데이터 → JSON (frontend 폴더에서)
cd ../frontend && npm run export-data && cd ../backend

# 3) DB 만들기
npm install
npm run seed

# 4) 서버 (http://localhost:8787)
npm run dev
```

프론트는 `frontend`에서 `npm run dev` — `/api` 요청은 vite가 이 서버로 넘겨 줍니다.

## 데이터를 고쳤을 때

`frontend/src/data/profs/*.jsx`가 원본입니다. 고친 뒤:

```bash
cd frontend && npm run export-data
cd ../backend && npm run seed     # 테이블 비우고 다시 채움
```

서버가 켜져 있으면 재시작하세요 (검색 색인을 메모리에 캐시함).

## 검색 정확도 확인

```bash
npm run eval   # 질문 세트로 1위 정답률 · 3위 안 정답률 · 무관한 질문 거르기
```

질문 세트는 `scripts/eval-search.mjs`. 검색이 못 찾는 질문이 있으면 `src/search.js`의 `SYNONYMS`(비슷한 말)에 단어를 추가하고 다시 확인하세요.
CASES(조정용)만 보고 고치면 점수가 부풀려지니, HOLDOUT(검증용) 점수도 같이 보세요.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 상태, 청크 수, 사용 모델 |
| GET | `/api/profs` | 교수님 목록 |
| GET | `/api/profs/:id` | **홈 · 섹션 데이터** — DB 내용 + 게시된 선배 제보를 섹션 항목으로 합쳐 프론트 데이터 파일과 같은 모양으로 (`src/view.js`). 프론트는 이걸 받아 그림 (서버가 없으면 기본 데이터) |
| POST | `/api/chat` | `{ profId, lang: 'ko'\|'ja', message, history? }` → `{ answer, sources, mode, notice }` |
| POST | `/api/quiz` | AI 퀴즈 `{ profId, lang, exclude? }` → `{ mode: ai · basic · empty, questions: [{ question, choices[4], answer, explanation, section }] }` (IP당 1분 6번, AI 사용 불가 시 DB 표로 기본 문제) |
| POST | `/api/contrib` | 섹션별 익명 제보 (저장 후 AI 정리가 백그라운드로 실행) `{ kind, profId, lang, grade, ...항목 }` — 홈 섹션 모양 그대로: traits(성향 투표) · scene(상황 카드 + 체크리스트) · warning(level · title · msg) · talk(title · body) · dict(term · tag · meaning · tip) · other, 항목은 `src/contrib.js` 의 `KINDS` (IP당 1분 5번, 이모지 제거) |
| GET | `/api/thread/:profId` | 교수님께 한마디 목록 (공개된 글, 오래된 순) |
| POST | `/api/thread` | 한마디 쓰기 `{ profId, body, author? }` — **바로 공개**, 맨 앞 `>>3 `은 답글 앵커 (IP당 1분 5번, 200자, 이모지 제거) |
| GET | `/api/contrib/:id/options` | 제보 폼 선택지 — 성향 투표 항목 · 상황 카드 목록 |

`mode`: `generate`(AI 답변) · `retrieval`(답변 모델 사용 불가 → 자료 표시) · `empty`(관련 자료 없음)

요청 제한: IP당 1분에 20번 (API 키 보호용)

## 테이블

| 테이블 | 내용 (프론트 위치) |
|---|---|
| `professors` | 이름, 설문 요약, STATUS, 사전 설명, 히어로 코드 블록 |
| `traits` | 01 성향 분석 막대 |
| `scenes` / `scene_items` | 02 상황별 가이드 + 체크리스트 |
| `warnings` | 사용 시 주의사항 |
| `talk_topics` | 03 스몰토크 |
| `dict_entries` | 04 말버릇·사투리 사전 |
| `chunks` | RAG 검색 단위 (위 테이블에서 생성, 한국어·일본어 벡터 각각) |
| `thread_posts` | 교수님께 한마디 (본문 · 앵커 · 브라우저별 무작위 ID · 공개/숨김, seed 해도 지워지지 않음) |
| `chat_logs` | 질문·답변 기록 (개인정보 없음) |
| `contributions` | 사이트 `/survey/:kind` 섹션별 익명 제보 (kind + 항목 JSON + 상태: 검수 대기 → 게시 / 보류 / 반려, seed 해도 지워지지 않음, 서버 시작 시 자동 생성 · 예전 구조는 자동 변환) |

번역되는 값은 `*_ko` / `*_ja` 두 칸에 저장합니다.

## 파일

```
src/db.js       DB 연결 + 스키마
src/seed.js     data/profs.json → 테이블 + 검색 청크
src/search.js   키워드 검색 (글자 2개 단위 + BM25 + 비슷한 말)
src/claude.js   Claude 답변 생성 (오류 → ChatUnavailableError → 검색 모드)
src/rag.js      검색 + 프롬프트 + 답변 (검색 모드 대체 포함)
src/contrib.js  섹션별 제보 (종류별 항목 정의 KINDS + 검사 + 저장)
src/view.js     홈 · 섹션 데이터 조립 (DB + 게시된 제보 합치기: 성향 비율 재계산 · 체크리스트 추가 · 항목 추가)
src/contribIndex.js 게시된 제보 → 챗봇 검색 자료(chunks, source_ref = contrib:<id>)
src/organize.js 제보 AI 정리 (Claude 구조화 출력, 원문 보관, 관리자가 먼저 손대면 덮어쓰지 않음)
src/thread.js   교수님께 한마디 (바로 공개 게시판 + 관리자 숨기기 · 삭제)
src/quiz.js     AI 퀴즈 (자료 무작위 선택 → Claude 구조화 출력 → 보기 섞기, 기본 문제 대체)
src/server.js   Express API
```

## 관리자 페이지 (`/admin`)

> 섹션별 제보는 **관리자가 게시해야만** 사이트에 보입니다. 제보 → **AI 정리** → 검수 대기 → (필요하면 수정) → 게시.
> AI 정리(`src/organize.js`, Claude): 제보 직후 백그라운드에서 오타 · 띄어쓰기 수정, 개인 식별 정보 제거 · 일반화, 문장 정리(내용은 그대로).
> 원문은 `original` 에 보관 — 관리자 화면에서 원문 보기 · 원문으로 되돌리기 · AI로 다시 정리 가능. 비방 · 무관한 글은 "AI: 반려 권장" 표시.
> 게시하는 순간 **챗봇 검색 자료에도 추가**되고, 게시 취소 · 수정 · 삭제 시 함께 지워지거나 다시 만들어집니다.
> AI 정리는 `ANTHROPIC_API_KEY`가 있을 때만 — 없으면 원문 그대로 검수 대기로 들어옵니다.

1. `.env`에 `ADMIN_PASSWORD=길고-추측하기-어려운-값` 추가 → 서버 재시작 (비어 있으면 관리자 기능 꺼짐)
2. 브라우저에서 `http://localhost:5173/admin` → 비밀번호로 로그인 (메뉴에는 노출되지 않음)

| 탭 | 내용 |
|---|---|
| 개요 | 교수님별 제보 수 · 검수 대기 · 게시 수, 종류별 제보 수(누르면 목록), 성향/학년 집계(반려 제외), 챗봇 질문 수 |
| 섹션별 제보 | 종류 탭(스몰토크 · 말버릇 · 성향 · 상황별 가이드 · 주의사항 · 기타), 교수님 · 상태 · 내용 검색, **검수**: 게시(사이트 공개) · 게시 내리기 · 보류 · 반려, 내용 수정(저장 / 저장 후 게시), 삭제, CSV 내보내기(종류를 고르면 그 항목이 열로) |
| 한마디 | 교수님께 한마디 글 숨기기 · 다시 공개 · 삭제, 교수님 · 상태 · 내용 검색 |
| 챗봇 기록 | 질문 · 답변 · 답변 방식 · 점수 확인, 검색, 삭제 |

- 로그인 토큰은 서버 메모리(12시간)와 브라우저 탭(sessionStorage)에만 — 서버 재시작 · 탭 닫기 시 다시 로그인
- 로그인 시도는 IP당 1분에 5번
- API: `src/admin.js` 맨 위 주석 참고
