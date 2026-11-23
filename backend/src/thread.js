/* ==========================================================================
   05 교수님께 한마디 (익명 게시판) — 쓰면 바로 모두에게 보임
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

export const THREAD_SCHEMA = `
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

export const THREAD_STATUSES = ['visible', 'hidden'];
const MAX_LEN = 200;
const MAX_LIST = 300; // 한 교수님 스레드에 보여 줄 최대 글 수 (최근 것부터)

const publicRow = (r) => ({ id: r.id, anchor: r.anchor, body: r.body, author: r.author, created_at: r.created_at });

export function mountThread(app, db, makeRateLimit) {
  db.exec(THREAD_SCHEMA);
  const profExists = db.prepare('SELECT 1 FROM professors WHERE id = ?');
  const listStmt = db.prepare(`SELECT * FROM (
      SELECT * FROM thread_posts WHERE prof_id = ? AND status = 'visible' ORDER BY id DESC LIMIT ${MAX_LIST}
    ) ORDER BY id`);
  const insStmt = db.prepare('INSERT INTO thread_posts (prof_id, anchor, body, author, lang) VALUES (?,?,?,?,?)');
  const getStmt = db.prepare('SELECT * FROM thread_posts WHERE id = ?');

  app.get('/api/thread/:profId', (req, res) => {
    if (!profExists.get(req.params.profId)) return res.status(404).json({ error: 'unknown_professor' });
    res.set('Cache-Control', 'no-store'); // 새 글이 바로 보이도록
    res.json({ posts: listStmt.all(req.params.profId).map(publicRow) });
  });

  app.post('/api/thread', makeRateLimit(5), (req, res) => {
    const { profId, body, author, lang } = req.body || {};
    if (typeof profId !== 'string' || !profExists.get(profId)) return res.status(404).json({ error: 'unknown_professor' });
    let text = cleanText(body, 400);
    if (!text) return res.status(400).json({ error: 'empty_message' });
    // ">>3 내용" → 앵커 + 본문
    let anchor = null;
    const m = text.match(/^>>(\d{1,4})\s*/);
    if (m) { anchor = `>>${m[1]} `; text = text.slice(m[0].length).trim(); }
    if (!text) return res.status(400).json({ error: 'empty_message' });
    text = text.replace(/\s*\n\s*/g, ' ').slice(0, MAX_LEN); // 한 줄 게시판
    const who = typeof author === 'string' && /^[A-Za-z0-9]{6}$/.test(author) ? author : null;
    const { lastInsertRowid } = insStmt.run(profId, anchor, text, who, lang === 'ja' ? 'ja' : 'ko');
    res.json({ post: publicRow(getStmt.get(lastInsertRowid)) });
  });
}

/** 관리자 라우트 — admin.js 가 로그인 검사 뒤에 붙임 */
export function mountThreadAdmin(app, db, { int, like }) {
  app.get('/api/admin/thread', (req, res) => {
    const where = [];
    const args = [];
    if (req.query.prof) { where.push('prof_id = ?'); args.push(String(req.query.prof)); }
    if (THREAD_STATUSES.includes(req.query.status)) { where.push('status = ?'); args.push(req.query.status); }
    if (req.query.q) { where.push(`body LIKE ? ESCAPE '\\'`); args.push(like(req.query.q)); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = int(req.query.limit, 50, 1, 1000);
    const offset = int(req.query.offset, 0, 0, 1e9);
    const total = db.prepare(`SELECT COUNT(*) n FROM thread_posts ${w}`).get(...args).n;
    const rows = db.prepare(`SELECT * FROM thread_posts ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
    res.json({ total, rows });
  });

  app.patch('/api/admin/thread/:id', (req, res) => {
    const status = req.body?.status;
    if (!THREAD_STATUSES.includes(status)) return res.status(400).json({ error: 'bad_status' });
    const id = int(req.params.id, 0, 0, 1e12);
    const info = db.prepare('UPDATE thread_posts SET status = ? WHERE id = ?').run(status, id);
    if (!info.changes) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, row: db.prepare('SELECT * FROM thread_posts WHERE id = ?').get(id) });
  });

  app.delete('/api/admin/thread/:id', (req, res) => {
    const info = db.prepare('DELETE FROM thread_posts WHERE id = ?').run(int(req.params.id, 0, 0, 1e12));
    if (!info.changes) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });
}
