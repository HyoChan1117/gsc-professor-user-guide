/* ==========================================================================
   관리자 API — 모두 /api/admin/* (로그인 필요)
   .env 의 ADMIN_PASSWORD 가 비어 있으면 관리자 기능 전체가 꺼집니다.

   POST   /api/admin/login            { password } → { token }   (IP당 1분 5번)
   POST   /api/admin/logout
   GET    /api/admin/overview         교수님별 제보 · 챗봇 집계
   GET    /api/admin/contrib          ?kind=&prof=&status=&q=&limit=&offset=
   PATCH  /api/admin/contrib/:id      { status?: new | published | reviewed | rejected, data?: 수정한 항목 }
   POST   /api/admin/contrib/:id/organize   AI로 다시 정리 (원문에서 새로)
                                       published(게시) 일 때만 사이트에 공개 · 기타(other)는 게시 불가
   DELETE /api/admin/contrib/:id
   GET    /api/admin/chat             ?prof=&mode=&q=&limit=&offset=
   DELETE /api/admin/chat/:id

   토큰은 서버 메모리에만 보관 (12시간). 서버를 재시작하면 다시 로그인.
   ========================================================================== */
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const TOKEN_TTL = 12 * 60 * 60 * 1000;
// new: 검수 대기 · published: 게시(사이트 공개) · reviewed: 보류 · rejected: 반려
const STATUSES = ['new', 'published', 'reviewed', 'rejected'];
import { KINDS, GRADES, PUBLIC_KINDS, validate } from './contrib.js';

const KIND_KEYS = Object.keys(KINDS);

// 길이가 달라도 시간 차이로 비밀번호가 새지 않도록 해시끼리 비교
const sameSecret = (a, b) => timingSafeEqual(
  createHash('sha256').update(String(a)).digest(),
  createHash('sha256').update(String(b)).digest(),
);

const json = (s, fallback = []) => { try { return JSON.parse(s); } catch { return fallback; } };
const int = (v, def, min, max) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const like = (q) => `%${String(q).replace(/[\\%_]/g, (c) => '\\' + c)}%`;

// 제보 행 → 응답용 (JSON 칸 풀기, 원문이 없던 예전 제보는 data 를 원문으로)
const rowOut = (r) => ({
  ...r,
  data: json(r.data, {}),
  original: r.original ? json(r.original, {}) : json(r.data, {}),
  ai_note: r.ai_note ? json(r.ai_note, null) : null,
});

/**
 * contribIndex: 게시된 제보 → 챗봇 검색 자료 (contribIndex.js)
 * organizer: 제보 AI 정리 (organize.js)
 */
export function mountAdmin(app, db, makeRateLimit, contribIndex, organizer) {
  const password = process.env.ADMIN_PASSWORD || '';
  const tokens = new Map(); // token → 만료 시각

  /* ---- 로그인 ---- */
  app.post('/api/admin/login', makeRateLimit(5), (req, res) => {
    if (!password) return res.status(503).json({ error: 'admin_disabled' });
    const given = req.body?.password;
    if (typeof given !== 'string' || !sameSecret(given, password)) {
      return res.status(401).json({ error: 'wrong_password' });
    }
    const now = Date.now();
    for (const [t, exp] of tokens) if (exp < now) tokens.delete(t);
    const token = randomBytes(24).toString('hex');
    tokens.set(token, now + TOKEN_TTL);
    res.json({ token, expiresAt: now + TOKEN_TTL });
  });

  /* ---- 이 아래는 전부 토큰 필요 ---- */
  function auth(req, res, next) {
    if (!password) return res.status(503).json({ error: 'admin_disabled' });
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const exp = tokens.get(token);
    if (!exp || exp < Date.now()) {
      tokens.delete(token);
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.adminToken = token;
    next();
  }
  app.use('/api/admin', (req, res, next) => (req.path === '/login' ? next() : auth(req, res, next)));

  app.post('/api/admin/logout', (req, res) => {
    tokens.delete(req.adminToken);
    res.json({ ok: true });
  });

  /* ---- 개요 ---- */
  app.get('/api/admin/overview', (req, res) => {
    const profs = db.prepare('SELECT id, name_ko, name_ja FROM professors ORDER BY rowid').all();
    const rows = db.prepare('SELECT prof_id, kind, grade, data, status FROM contributions').all();
    const chatByProf = db.prepare(`SELECT prof_id, mode, COUNT(*) n FROM chat_logs GROUP BY prof_id, mode`).all();
    const chatWeek = db.prepare(`SELECT prof_id, COUNT(*) n FROM chat_logs WHERE created_at >= datetime('now', '-7 days') GROUP BY prof_id`).all();

    const blank = (keys, v = () => 0) => Object.fromEntries(keys.map((k) => [k, v()]));
    const ids = new Set([...profs.map((p) => p.id), ...rows.map((r) => r.prof_id)]);
    const byProf = Object.fromEntries([...ids].map((id) => [id, {
      contrib: {
        total: 0,
        status: blank(STATUSES),
        kinds: blank(KIND_KEYS, () => ({ total: 0, new: 0 })),
        grades: blank(GRADES),       // 반려 제외 전체 제보
        traits: {},                  // 반려 제외 성향 제보 — 항목 이름(label_ko) → 표 수
        traitsN: 0,
      },
      chat: { total: 0, week: 0, modes: {} },
    }]));

    for (const r of rows) {
      const c = byProf[r.prof_id].contrib;
      c.total += 1;
      c.status[r.status] += 1;
      c.kinds[r.kind].total += 1;
      if (r.status === 'new') c.kinds[r.kind].new += 1;
      if (r.status === 'rejected') continue;
      c.grades[r.grade] += 1;
      if (r.kind === 'traits') {
        c.traitsN += 1;
        for (const k of json(r.data, {}).traits || []) c.traits[k] = (c.traits[k] || 0) + 1;
      }
    }
    for (const r of chatByProf) {
      const c = byProf[r.prof_id]?.chat;
      if (!c) continue;
      c.total += r.n;
      c.modes[r.mode || 'unknown'] = r.n;
    }
    for (const r of chatWeek) if (byProf[r.prof_id]) byProf[r.prof_id].chat.week = r.n;

    res.json({
      profs: [...ids].map((id) => {
        const p = profs.find((x) => x.id === id);
        return { id, name_ko: p?.name_ko ?? id, name_ja: p?.name_ja ?? id, ...byProf[id] };
      }),
    });
  });

  /* ---- 섹션별 제보 ---- */
  app.get('/api/admin/contrib', (req, res) => {
    const where = [];
    const args = [];
    if (req.query.prof) { where.push('prof_id = ?'); args.push(String(req.query.prof)); }
    if (KIND_KEYS.includes(req.query.kind)) { where.push('kind = ?'); args.push(req.query.kind); }
    if (STATUSES.includes(req.query.status)) { where.push('status = ?'); args.push(req.query.status); }
    if (req.query.q) { where.push(`data LIKE ? ESCAPE '\\'`); args.push(like(req.query.q)); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = int(req.query.limit, 50, 1, 1000);
    const offset = int(req.query.offset, 0, 0, 1e9);
    const total = db.prepare(`SELECT COUNT(*) n FROM contributions ${w}`).get(...args).n;
    const rows = db.prepare(`SELECT * FROM contributions ${w} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...args, limit, offset)
      .map(rowOut);
    res.json({ total, rows });
  });

  /* 검수: 상태 변경(게시 · 보류 · 반려 · 대기) 과 내용 수정. 둘 다 한 번에 보내도 됨 */
  app.patch('/api/admin/contrib/:id', async (req, res) => {
    const id = int(req.params.id, 0, 0, 1e12);
    const row = db.prepare('SELECT kind, status, data, ai_status FROM contributions WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    const { status, data } = req.body || {};
    if (status === undefined && data === undefined) return res.status(400).json({ error: 'bad_data' });

    let nextData = null;
    if (data !== undefined) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'bad_data' });
      const result = validate(row.kind, data); // 제보할 때와 같은 검사 (필수 항목 · 길이 · 이모지 제거)
      if (result.error) return res.status(400).json(result);
      nextData = result.data;
    }
    if (status !== undefined) {
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'bad_status' });
      if (status === 'published' && !PUBLIC_KINDS.includes(row.kind)) return res.status(400).json({ error: 'not_publishable' });
    }

    const next = status ?? row.status;
    // 게시 시각: 새로 게시하면 지금, 계속 게시 중이면 그대로, 게시를 내리면 지움
    const when = next !== 'published' ? 'clear' : row.status === 'published' ? 'keep' : 'now';
    // AI 정리가 아직 진행 중인데 관리자가 먼저 손대면, 나중에 끝난 AI 결과가 덮어쓰지 않도록 skipped
    db.prepare(`UPDATE contributions SET status = ?, data = COALESCE(?, data),
      published_at = CASE ? WHEN 'keep' THEN published_at WHEN 'now' THEN datetime('now') ELSE NULL END,
      ai_status = CASE ai_status WHEN 'pending' THEN 'skipped' ELSE ai_status END
      WHERE id = ?`).run(next, nextData ? JSON.stringify(nextData) : null, when, id);
    const updated = db.prepare('SELECT * FROM contributions WHERE id = ?').get(id);
    // 챗봇 검색 자료 맞추기 (게시 → 생성 · 수정 → 다시 생성 · 게시 취소 → 삭제). 실패해도 검수 결과는 유지
    const indexed = contribIndex ? await contribIndex.sync(id) : null;
    res.json({ ok: true, indexed, row: rowOut(updated) });
  });

  /* AI로 다시 정리 — 원문(original)에서 새로 정리해 data 를 바꿈 (게시 중이면 챗봇 자료도 갱신) */
  app.post('/api/admin/contrib/:id/organize', async (req, res) => {
    if (!organizer) return res.status(503).json({ error: 'ai_unavailable' });
    const id = int(req.params.id, 0, 0, 1e12);
    const result = await organizer.organize(id, { force: true });
    const row = db.prepare('SELECT * FROM contributions WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    if (!result.ok) return res.status(result.error === 'busy' ? 409 : 502).json({ error: result.error, row: rowOut(row) });
    res.json({ ok: true, row: rowOut(row) });
  });

  app.delete('/api/admin/contrib/:id', (req, res) => {
    const id = int(req.params.id, 0, 0, 1e12);
    const row = db.prepare('SELECT prof_id FROM contributions WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    db.prepare('DELETE FROM contributions WHERE id = ?').run(id);
    contribIndex?.remove(id, row.prof_id); // 챗봇 검색 자료도 삭제
    res.json({ ok: true });
  });

  /* ---- 챗봇 기록 ---- */
  app.get('/api/admin/chat', (req, res) => {
    const where = [];
    const args = [];
    if (req.query.prof) { where.push('prof_id = ?'); args.push(String(req.query.prof)); }
    if (req.query.mode) { where.push('mode = ?'); args.push(String(req.query.mode)); }
    if (req.query.q) {
      where.push(`(question LIKE ? ESCAPE '\\' OR answer LIKE ? ESCAPE '\\')`);
      args.push(like(req.query.q), like(req.query.q));
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = int(req.query.limit, 50, 1, 1000);
    const offset = int(req.query.offset, 0, 0, 1e9);
    const total = db.prepare(`SELECT COUNT(*) n FROM chat_logs ${w}`).get(...args).n;
    const rows = db.prepare(`SELECT * FROM chat_logs ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
    res.json({ total, rows });
  });

  app.delete('/api/admin/chat/:id', (req, res) => {
    const info = db.prepare('DELETE FROM chat_logs WHERE id = ?').run(int(req.params.id, 0, 0, 1e12));
    if (!info.changes) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  });
}
