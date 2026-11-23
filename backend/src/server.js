/* ==========================================================================
   API 서버
   GET  /api/health          상태 확인
   GET  /api/profs           교수님 목록
   GET  /api/profs/:id       홈 · 섹션 데이터 (DB + 게시된 선배 제보를 섹션 항목으로 합침 — view.js)
   POST /api/chat            RAG 챗봇  { profId, lang, message, history? }
   POST /api/quiz            AI 퀴즈 { profId, lang, exclude? } → { mode, questions }
   POST /api/contrib         섹션별 익명 제보 저장 (contrib.js — contributions)
   GET  /api/contrib/:id/options 제보 폼 선택지 (성향 항목 · 상황 카드)
   /api/admin/*              관리자 (admin.js — .env ADMIN_PASSWORD 필요)
   실행: npm run dev  (프론트 vite가 /api 를 이 서버로 프록시)
   ========================================================================== */
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, SCHEMA, migrate } from './db.js';
import { createRag } from './rag.js';
import { SEARCH_MODEL } from './search.js';
import { CHAT_MODEL } from './claude.js';
import { mountAdmin } from './admin.js';
import { createQuiz } from './quiz.js';
import { mountContrib, upgradeAll } from './contrib.js';
import { buildProfView } from './view.js';
import { createContribIndex } from './contribIndex.js';
import { createOrganizer } from './organize.js';

const PORT = Number(process.env.PORT) || 8787;
const db = openDb();
db.exec(SCHEMA); // 새로 추가된 테이블(contributions 등)이 없으면 만들기 — 기존 데이터는 그대로
migrate(db);     // 예전 구조의 contributions 가 있으면 게시 상태가 있는 새 구조로
// 예전 통합 설문 테이블은 비어 있을 때만 정리 (섹션별 제보 contributions 로 대체됨)
try {
  if (db.prepare('SELECT COUNT(*) n FROM survey_responses').get().n === 0) db.exec('DROP TABLE survey_responses');
} catch { /* 이미 없음 */ }
const rag = createRag(db);
const contribIndex = createContribIndex(db, rag); // 게시된 선배 제보 → 챗봇 검색 자료
const organizer = createOrganizer(db, contribIndex); // 제보 AI 정리 (오타 · 개인정보 · 문장)
const quiz = createQuiz(db);
// 예전 형식(섹션과 다른 항목)으로 저장된 제보 → 섹션 형식. 게시 중인 것은 챗봇 자료도 다시 만듦
const upgraded = upgradeAll(db);
const app = express();
// 배포(Render 등)에서는 앞단 프록시가 하나 있음 → 실제 접속자 IP로 요청 제한 (안 하면 모두가 같은 IP로 묶임)
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(express.json({ limit: '32kb' }));

/* ---- 아주 단순한 요청 제한: IP당 1분에 max번 ---- */
function makeRateLimit(max) {
  const hits = new Map();
  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip;
    const list = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (list.length >= max) return res.status(429).json({ error: 'too_many_requests' });
    list.push(now);
    hits.set(key, list);
    next();
  };
}
const rateLimit = makeRateLimit(20);     // 챗봇 (API 키 보호)

app.get('/api/health', (req, res) => {
  const chunks = db.prepare('SELECT COUNT(*) n FROM chunks').get().n;
  res.json({ ok: true, chunks, chatModel: CHAT_MODEL, search: SEARCH_MODEL });
});

app.get('/api/profs', (req, res) => {
  res.json(db.prepare('SELECT id, name_ko, name_ja, short_ko, short_ja, has_avatar FROM professors').all());
});

// 홈 · 섹션 페이지 데이터 (DB + 게시된 선배 제보, 프론트 데이터 파일과 같은 모양) — view.js
app.get('/api/profs/:id', (req, res) => {
  const view = buildProfView(db, req.params.id);
  if (!view) return res.status(404).json({ error: 'not_found' });
  res.set('Cache-Control', 'no-store'); // 게시하면 바로 보이도록
  res.json(view);
});

app.post('/api/chat', rateLimit, async (req, res) => {
  const { profId, lang, message, history } = req.body || {};
  const question = typeof message === 'string' ? message.trim() : '';
  if (!question) return res.status(400).json({ error: 'empty_message' });
  if (question.length > 500) return res.status(400).json({ error: 'message_too_long' });
  if (typeof profId !== 'string') return res.status(400).json({ error: 'missing_prof' });

  // 이전 대화는 user/assistant 문자열만, 최근 6개까지
  const safeHistory = Array.isArray(history)
    ? history
      .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }))
    : [];

  try {
    const result = await rag.answer({ profId, lang: lang === 'ja' ? 'ja' : 'ko', question, history: safeHistory });
    res.json(result);
  } catch (err) {
    console.error('[chat]', err);
    const status = err.message === 'unknown professor' ? 404 : 500;
    res.status(status).json({ error: status === 404 ? 'unknown_professor' : 'server_error' });
  }
});

/* ---- 퀴즈 (AI가 매번 새로 출제) ---- */
const quizLimit = makeRateLimit(6); // Claude 호출 비용 보호
app.post('/api/quiz', quizLimit, async (req, res) => {
  const { profId, lang, exclude } = req.body || {};
  if (typeof profId !== 'string') return res.status(400).json({ error: 'missing_prof' });
  const recent = Array.isArray(exclude)
    ? exclude.filter((q) => typeof q === 'string').slice(-quiz.MAX_EXCLUDE).map((q) => q.slice(0, 200))
    : [];
  try {
    res.json(await quiz.make({ profId, lang: lang === 'ja' ? 'ja' : 'ko', exclude: recent }));
  } catch (err) {
    console.error('[quiz]', err);
    const status = err.message === 'unknown professor' ? 404 : 500;
    res.status(status).json({ error: status === 404 ? 'unknown_professor' : 'server_error' });
  }
});

mountContrib(app, db, makeRateLimit, organizer);
mountAdmin(app, db, makeRateLimit, contribIndex, organizer);

/* ---- 배포: 빌드된 프론트(frontend/dist)도 이 서버가 제공 — /api 외 경로는 index.html (SPA) ---- */
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
if (existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(resolve(DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`✓ API 서버: http://localhost:${PORT}  (chat: ${CHAT_MODEL}, search: ${SEARCH_MODEL})`);
  // 게시됐는데 챗봇 검색 자료가 없는 제보 채우기 (이전에 저장이 실패했던 것 등)
  (async () => {
    for (const id of upgraded) await contribIndex.sync(id); // 형식이 바뀐 게시 제보는 챗봇 자료도 새로
    await contribIndex.syncMissing();
  })().catch((err) => console.warn('[contrib-index]', err.message));
  // 서버가 꺼져서 AI 정리가 끝나지 못한 제보 다시 정리
  organizer.organizePending().catch((err) => console.warn('[organize]', err.message));
});
