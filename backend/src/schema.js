/* ==========================================================================
   DB 스키마 — Node(SQLite 파일)와 Cloudflare D1 이 같은 표를 씁니다.
   번역되는 값은 *_ko / *_ja 두 칸으로 저장합니다.
   모두 CREATE ... IF NOT EXISTS 라 몇 번 실행해도 기존 데이터는 그대로입니다.
   ========================================================================== */
export const SCHEMA = `
-- 교수님 기본 정보 + 1:1 값들 (설문 요약 · STATUS · 사전 설명)
CREATE TABLE IF NOT EXISTS professors (
  id              TEXT PRIMARY KEY,          -- 'jeong', 'fukka'
  name_ko         TEXT NOT NULL,
  name_ja         TEXT,
  short_ko        TEXT NOT NULL,
  short_ja        TEXT,
  has_avatar      INTEGER NOT NULL DEFAULT 0,
  profile_json    TEXT,                      -- 히어로 code 블록 · badges · synopsis (원본 그대로)
  survey_n        INTEGER,
  survey_note_ko  TEXT,
  survey_note_ja  TEXT,
  traits_lead_ko  TEXT,
  traits_lead_ja  TEXT,
  traits_sub_ko   TEXT,
  traits_sub_ja   TEXT,
  status_mood_ko  TEXT,
  status_mood_ja  TEXT,
  status_reason_ko TEXT,
  status_reason_ja TEXT,
  status_votes    INTEGER,
  dict_desc_ko    TEXT,
  dict_desc_ja    TEXT
);

-- 01 성향 분석 막대
CREATE TABLE IF NOT EXISTS traits (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  prof_id   TEXT NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  ord       INTEGER NOT NULL,
  label_ko  TEXT NOT NULL,
  label_ja  TEXT,
  pct       INTEGER NOT NULL
);

-- 02 상황별 가이드
CREATE TABLE IF NOT EXISTS scenes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  prof_id   TEXT NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  ord       INTEGER NOT NULL,
  file      TEXT,
  tab       TEXT,
  title_ko  TEXT NOT NULL,
  title_ja  TEXT,
  tip_ko    TEXT,
  tip_ja    TEXT
);
CREATE TABLE IF NOT EXISTS scene_items (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id  INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  ord       INTEGER NOT NULL,
  text_ko   TEXT NOT NULL,
  text_ja   TEXT
);

-- 사용 시 주의사항 (level: warning | hint | error | note)
CREATE TABLE IF NOT EXISTS warnings (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  prof_id   TEXT NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  code      TEXT NOT NULL,                    -- 'W01'
  level     TEXT NOT NULL CHECK (level IN ('warning','hint','error','note')),
  title_ko  TEXT NOT NULL,
  title_ja  TEXT,
  msg_ko    TEXT NOT NULL,
  msg_ja    TEXT
);

-- 03 스몰토크 소재
CREATE TABLE IF NOT EXISTS talk_topics (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  prof_id   TEXT NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  key       TEXT NOT NULL,                    -- 'baseball'
  title_ko  TEXT NOT NULL,
  title_ja  TEXT,
  body_ko   TEXT NOT NULL,
  body_ja   TEXT
);

-- 04 말버릇 · 사투리 사전
CREATE TABLE IF NOT EXISTS dict_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  prof_id     TEXT NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  term        TEXT NOT NULL,                  -- 한국어 원문 표현
  tag         TEXT NOT NULL CHECK (tag IN ('사투리','말버릇','외래어','추정')),
  meaning_ko  TEXT NOT NULL,                  -- 표준어 뜻
  meaning_ja  TEXT,                           -- 일본어 뜻
  tip_ko      TEXT,
  tip_ja      TEXT,
  in_preview  INTEGER NOT NULL DEFAULT 0      -- 홈 미리보기 노출 여부
);


-- RAG 검색 단위 (위 테이블에서 만들어짐, npm run seed 때 새로 생성)
CREATE TABLE IF NOT EXISTS chunks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  prof_id      TEXT NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  source_type  TEXT NOT NULL,                 -- profile | traits | scene | warning | talk | dict
  source_ref   TEXT,                          -- 원본 행을 찾을 수 있는 값 (예: 'W01', 'baseball')
  title_ko     TEXT NOT NULL,
  title_ja     TEXT,
  content_ko   TEXT NOT NULL,
  content_ja   TEXT,
  embedding    BLOB,                          -- 한국어 텍스트 벡터 (Float32Array, 정규화됨)
  embedding_ja BLOB,                          -- 일본어 텍스트 벡터 (질문 언어와 상관없이 둘 중 높은 점수 사용)
  embed_model  TEXT
);
CREATE INDEX IF NOT EXISTS idx_chunks_prof ON chunks(prof_id);

-- 섹션별 익명 제보 (사이트 /survey/:kind · 한국어/일본어)
-- kind: talk(스몰토크) | dict(말버릇) | traits(성향) | scene(상황별 가이드) | warning(주의사항) | other(기타)
-- data: 종류별 입력 항목 JSON — 사이트 · 챗봇에 나가는 내용 (AI 정리본 → 관리자 수정 가능)
-- original: 제보자가 쓴 원문 그대로 (바뀌지 않음)
-- ai_status: pending(정리 중) | done(AI 정리됨) | failed(정리 실패 → 원문 그대로) | skipped(관리자가 먼저 손댐)
-- ai_note: AI가 남긴 메모 JSON { changes, verdict: ok|caution|reject, reason }
-- status: new(검수 대기) → published(게시 — 사이트에 공개) | reviewed(보류) | rejected(반려)
--         사이트에는 관리자가 게시(published)한 제보만 나갑니다.
-- seed 때 professors 를 DROP 해도 지워지지 않도록 FK(CASCADE)는 걸지 않습니다.
CREATE TABLE IF NOT EXISTS contributions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  prof_id     TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('talk','dict','traits','scene','warning','other')),
  lang        TEXT NOT NULL CHECK (lang IN ('ko','ja')),
  grade       TEXT NOT NULL CHECK (grade IN ('1','2','3','alumni')),
  data        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','published','rejected')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,                          -- 게시한 시각 (게시 취소하면 NULL)
  original    TEXT,
  ai_status   TEXT,
  ai_note     TEXT
);
CREATE INDEX IF NOT EXISTS idx_contrib_prof_kind ON contributions(prof_id, kind);

-- 챗봇 질문 기록 (개인정보 없음 — 질문/답변 품질 개선용)
CREATE TABLE IF NOT EXISTS chat_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  prof_id     TEXT,
  lang        TEXT,
  question    TEXT NOT NULL,
  answer      TEXT,
  mode        TEXT,                           -- generate | retrieval | empty
  top_score   REAL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 05 교수님께 한마디 (익명 게시판 — 쓰면 바로 공개, 관리자가 숨김 · 삭제)
CREATE TABLE IF NOT EXISTS thread_posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  prof_id     TEXT NOT NULL,
  anchor      TEXT,                            -- '>>3 ' 처럼 답글 대상 (없으면 NULL)
  body        TEXT NOT NULL,
  author      TEXT,                            -- 브라우저별 무작위 ID (개인정보 아님)
  lang        TEXT,
  status      TEXT NOT NULL DEFAULT 'visible', -- visible: 공개 · hidden: 관리자가 숨김
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_thread_prof ON thread_posts(prof_id, status);
`;
