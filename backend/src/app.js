/* ==========================================================================
   API 라우트 — Node(server.js)와 Cloudflare Workers(worker.js)가 같이 씁니다.
   GET  /api/health          상태 확인
   GET  /api/profs           교수님 목록
   GET  /api/profs/:id       홈 · 섹션 데이터 (DB + 게시된 선배 제보를 섹션 항목으로 합침 — view.js)
   POST /api/chat            챗봇 (키워드 검색 + 선택: Claude 답변)  { profId, lang, message, history? }
   POST /api/quiz            퀴즈 { profId, lang, exclude? } → { mode, questions }
   POST /api/contrib         섹션별 익명 제보 (contrib.js)
   GET  /api/contrib/:id/options 제보 폼 선택지
   GET  /api/thread/:profId  교수님께 한마디 · POST /api/thread 쓰기 (thread.js — 바로 공개)
   /api/admin/*              관리자 (admin.js — ADMIN_PASSWORD 필요)
   ========================================================================== */
import { Hono } from 'hono';
import { createRag } from './rag.js';
import { SEARCH_MODEL } from './search.js';
import { CHAT_MODEL, configureClaude } from './claude.js';
import { mountAdmin } from './admin.js';
import { createQuiz } from './quiz.js';
import { mountContrib } from './contrib.js';
import { buildProfView } from './view.js';
import { createContribIndex } from './contribIndex.js';
import { createOrganizer } from './organize.js';
import { mountThread } from './thread.js';
import { makeRateLimit, readJson } from './http.js';

/**
 * db: db.js(Node) 또는 d1.js(Cloudflare) 가 만든 DB
 * env: { ADMIN_PASSWORD?, ANTHROPIC_API_KEY?, CLAUDE_MODEL?, CLAUDE_EFFORT?, TRUST_PROXY? }
 * 반환: { app, rag, contribIndex, organizer }
 */
export function createApp(db, env = {}) {
  configureClaude(env);
  const rag = createRag(db);
  const contribIndex = createContribIndex(db, rag); // 게시된 선배 제보 → 챗봇 검색 자료
  const organizer = createOrganizer(db, contribIndex); // 제보 AI 정리 (Claude 키가 있을 때만)
  const quiz = createQuiz(db);
  const app = new Hono();

  const trustProxy = !!env.TRUST_PROXY;
  app.use('*', async (c, next) => { c.set('trustProxy', trustProxy); return next(); });

  app.onError((err, c) => {
    console.error('[api]', err);
    const status = err.message === 'unknown professor' ? 404 : 500;
    return c.json({ error: status === 404 ? 'unknown_professor' : 'server_error' }, status);
  });

  app.get('/api/health', async (c) => {
    const { n } = await db.prepare('SELECT COUNT(*) AS n FROM chunks').get();
    return c.json({ ok: true, chunks: n, chatModel: CHAT_MODEL, search: SEARCH_MODEL, runtime: db.kind });
  });

  app.get('/api/profs', async (c) => c.json(await db.prepare('SELECT id, name_ko, name_ja, short_ko, short_ja, has_avatar FROM professors').all()));

  // 홈 · 섹션 페이지 데이터 (DB + 게시된 선배 제보, 프론트 데이터 파일과 같은 모양) — view.js
  app.get('/api/profs/:id', async (c) => {
    const view = await buildProfView(db, c.req.param('id'));
    if (!view) return c.json({ error: 'not_found' }, 404);
    c.header('Cache-Control', 'no-store'); // 게시하면 바로 보이도록
    return c.json(view);
  });

  app.post('/api/chat', makeRateLimit(20), async (c) => {
    const { profId, lang, message, history } = await readJson(c);
    const question = typeof message === 'string' ? message.trim() : '';
    if (!question) return c.json({ error: 'empty_message' }, 400);
    if (question.length > 500) return c.json({ error: 'message_too_long' }, 400);
    if (typeof profId !== 'string') return c.json({ error: 'missing_prof' }, 400);

    // 이전 대화는 user/assistant 문자열만, 최근 6개까지
    const safeHistory = Array.isArray(history)
      ? history
        .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }))
      : [];
    return c.json(await rag.answer({ profId, lang: lang === 'ja' ? 'ja' : 'ko', question, history: safeHistory }));
  });

  /* ---- 퀴즈 (Claude 키가 있으면 AI가 매번 새로 출제, 없으면 DB 로 기본 문제) ---- */
  app.post('/api/quiz', makeRateLimit(6), async (c) => {
    const { profId, lang, exclude } = await readJson(c);
    if (typeof profId !== 'string') return c.json({ error: 'missing_prof' }, 400);
    const recent = Array.isArray(exclude)
      ? exclude.filter((q) => typeof q === 'string').slice(-quiz.MAX_EXCLUDE).map((q) => q.slice(0, 200))
      : [];
    return c.json(await quiz.make({ profId, lang: lang === 'ja' ? 'ja' : 'ko', exclude: recent }));
  });

  mountContrib(app, db, organizer);
  mountThread(app, db);
  mountAdmin(app, db, { password: env.ADMIN_PASSWORD || '', contribIndex, organizer });

  // 없는 /api 경로는 JSON 404 (화면 파일 요청과 구분)
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

  return { app, rag, contribIndex, organizer };
}
