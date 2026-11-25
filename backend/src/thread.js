/* ==========================================================================
   05 교수님께 한마디 (익명 게시판) — 쓰면 바로 모두에게 보임. 표: thread_posts (schema.js)
   GET  /api/thread/:profId    보이는 글 목록 (오래된 순)
   POST /api/thread            { profId, body, author? } → { post }   (IP당 1분 5번)
     - body 맨 앞 ">>3 " 은 앵커(다른 글 답글)로 따로 저장
     - author: 브라우저마다 만든 무작위 6자리 (화면의 ID:xxxx 와 "(나)" 표시용, 개인정보 아님)
   관리자 (admin.js 의 로그인 필요)
   GET    /api/admin/thread        ?prof=&status=&q=&limit=&offset=
   PATCH  /api/admin/thread/:id    { status: visible | hidden }
   DELETE /api/admin/thread/:id
   ========================================================================== */
import { cleanText } from './contrib.js';
import { makeRateLimit, readJson, int, like } from './http.js';

export const THREAD_STATUSES = ['visible', 'hidden'];
const MAX_LEN = 200;
const MAX_LIST = 300; // 한 교수님 스레드에 보여 줄 최대 글 수 (최근 것부터)

const publicRow = (r) => ({ id: r.id, anchor: r.anchor, body: r.body, author: r.author, created_at: r.created_at });

export function mountThread(app, db) {
  const profExists = db.prepare('SELECT 1 AS ok FROM professors WHERE id = ?');
  const listStmt = db.prepare(`SELECT * FROM (
      SELECT * FROM thread_posts WHERE prof_id = ? AND status = 'visible' ORDER BY id DESC LIMIT ${MAX_LIST}
    ) ORDER BY id`);
  const insStmt = db.prepare('INSERT INTO thread_posts (prof_id, anchor, body, author, lang) VALUES (?,?,?,?,?)');
  const getStmt = db.prepare('SELECT * FROM thread_posts WHERE id = ?');

  app.get('/api/thread/:profId', async (c) => {
    const profId = c.req.param('profId');
    if (!(await profExists.get(profId))) return c.json({ error: 'unknown_professor' }, 404);
    c.header('Cache-Control', 'no-store'); // 새 글이 바로 보이도록
    return c.json({ posts: (await listStmt.all(profId)).map(publicRow) });
  });

  app.post('/api/thread', makeRateLimit(5), async (c) => {
    const { profId, body, author, lang } = await readJson(c);
    if (typeof profId !== 'string' || !(await profExists.get(profId))) return c.json({ error: 'unknown_professor' }, 404);
    let text = cleanText(body, 400);
    if (!text) return c.json({ error: 'empty_message' }, 400);
    // ">>3 내용" → 앵커 + 본문
    let anchor = null;
    const m = text.match(/^>>(\d{1,4})\s*/);
    if (m) { anchor = `>>${m[1]} `; text = text.slice(m[0].length).trim(); }
    if (!text) return c.json({ error: 'empty_message' }, 400);
    text = text.replace(/\s*\n\s*/g, ' ').slice(0, MAX_LEN); // 한 줄 게시판
    const who = typeof author === 'string' && /^[A-Za-z0-9]{6}$/.test(author) ? author : null;
    const { lastInsertRowid } = await insStmt.run(profId, anchor, text, who, lang === 'ja' ? 'ja' : 'ko');
    return c.json({ post: publicRow(await getStmt.get(lastInsertRowid)) });
  });
}

/** 관리자 라우트 — admin.js 가 로그인 검사 뒤에 붙임 */
export function mountThreadAdmin(app, db) {
  app.get('/api/admin/thread', async (c) => {
    const q = c.req.query();
    const where = [];
    const args = [];
    if (q.prof) { where.push('prof_id = ?'); args.push(String(q.prof)); }
    if (THREAD_STATUSES.includes(q.status)) { where.push('status = ?'); args.push(q.status); }
    if (q.q) { where.push(`body LIKE ? ESCAPE '\\'`); args.push(like(q.q)); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = int(q.limit, 50, 1, 1000);
    const offset = int(q.offset, 0, 0, 1e9);
    const total = (await db.prepare(`SELECT COUNT(*) AS n FROM thread_posts ${w}`).get(...args)).n;
    const rows = await db.prepare(`SELECT * FROM thread_posts ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
    return c.json({ total, rows });
  });

  app.patch('/api/admin/thread/:id', async (c) => {
    const { status } = await readJson(c);
    if (!THREAD_STATUSES.includes(status)) return c.json({ error: 'bad_status' }, 400);
    const id = int(c.req.param('id'), 0, 0, 1e12);
    const info = await db.prepare('UPDATE thread_posts SET status = ? WHERE id = ?').run(status, id);
    if (!info.changes) return c.json({ error: 'not_found' }, 404);
    return c.json({ ok: true, row: await db.prepare('SELECT * FROM thread_posts WHERE id = ?').get(id) });
  });

  app.delete('/api/admin/thread/:id', async (c) => {
    const info = await db.prepare('DELETE FROM thread_posts WHERE id = ?').run(int(c.req.param('id'), 0, 0, 1e12));
    if (!info.changes) return c.json({ error: 'not_found' }, 404);
    return c.json({ ok: true });
  });
}
