/* ==========================================================================
   관리자 API — 모두 /api/admin/* (로그인 필요)
   ADMIN_PASSWORD 가 비어 있으면 관리자 기능 전체가 꺼집니다.
   (Node: backend/.env · Cloudflare: Worker 시크릿)

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
   GET · PATCH · DELETE /api/admin/thread  교수님께 한마디 숨기기 · 삭제 (thread.js)

   토큰 = "만료 시각.서명" (ADMIN_PASSWORD 로 HMAC 서명, 12시간).
   서버 메모리에 저장하지 않아서 Cloudflare 처럼 서버 인스턴스가 여러 개여도 유지됩니다.
   비밀번호를 바꾸면 기존 토큰은 모두 무효가 됩니다.
   ========================================================================== */
import { KINDS, GRADES, PUBLIC_KINDS, validate } from './contrib.js';
import { mountThreadAdmin } from './thread.js';
import { makeRateLimit, readJson, int, like } from './http.js';

const TOKEN_TTL = 12 * 60 * 60 * 1000;
// new: 검수 대기 · published: 게시(사이트 공개) · reviewed: 보류 · rejected: 반려
const STATUSES = ['new', 'published', 'reviewed', 'rejected'];
const KIND_KEYS = Object.keys(KINDS);

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
// 길이가 달라도 시간 차이로 값이 새지 않도록 해시끼리 한 글자씩 비교
async function same(a, b) {
  const [x, y] = await Promise.all([a, b].map(async (v) => hex(await crypto.subtle.digest('SHA-256', enc.encode(String(v))))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

const json = (s, fallback = []) => { try { return JSON.parse(s); } catch { return fallback; } };

// 제보 행 → 응답용 (JSON 칸 풀기, 원문이 없던 예전 제보는 data 를 원문으로)
const rowOut = (r) => ({
  ...r,
  data: json(r.data, {}),
  original: r.original ? json(r.original, {}) : json(r.data, {}),
  ai_note: r.ai_note ? json(r.ai_note, null) : null,
});

/**
 * password: ADMIN_PASSWORD (빈 값이면 관리자 기능 꺼짐)
 * contribIndex: 게시된 제보 → 챗봇 검색 자료 (contribIndex.js)
 * organizer: 제보 AI 정리 (organize.js)
 */
export function mountAdmin(app, db, { password, contribIndex, organizer }) {
  const revoked = new Set(); // 로그아웃한 토큰 (이 서버 인스턴스 안에서만 — 만료되면 어차피 무효)

  async function makeToken() {
    const exp = Date.now() + TOKEN_TTL;
    return { token: `${exp}.${await hmac(password, `gsc-admin.${exp}`)}`, expiresAt: exp };
  }
  async function validToken(token) {
    const [exp, sig] = String(token).split('.');
    if (!exp || !sig || !(Number(exp) > Date.now()) || revoked.has(token)) return false;
    return same(sig, await hmac(password, `gsc-admin.${exp}`));
  }

  /* ---- 로그인 ---- */
  app.post('/api/admin/login', makeRateLimit(5), async (c) => {
    if (!password) return c.json({ error: 'admin_disabled' }, 503);
    const { password: given } = await readJson(c);
    if (typeof given !== 'string' || !(await same(given, password))) return c.json({ error: 'wrong_password' }, 401);
    return c.json(await makeToken());
  });

  /* ---- 이 아래는 전부 토큰 필요 ---- */
  app.use('/api/admin/*', async (c, next) => {
    if (c.req.path === '/api/admin/login') return next();
    if (!password) return c.json({ error: 'admin_disabled' }, 503);
    const token = (c.req.header('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!(await validToken(token))) return c.json({ error: 'unauthorized' }, 401);
    c.set('adminToken', token);
    return next();
  });

  app.post('/api/admin/logout', (c) => {
    revoked.add(c.get('adminToken'));
    return c.json({ ok: true });
  });

  /* ---- 개요 ---- */
  app.get('/api/admin/overview', async (c) => {
    const profs = await db.prepare('SELECT id, name_ko, name_ja FROM professors ORDER BY rowid').all();
    const rows = await db.prepare('SELECT prof_id, kind, grade, data, status FROM contributions').all();
    const chatByProf = await db.prepare('SELECT prof_id, mode, COUNT(*) AS n FROM chat_logs GROUP BY prof_id, mode').all();
    const chatWeek = await db.prepare(`SELECT prof_id, COUNT(*) AS n FROM chat_logs WHERE created_at >= datetime('now', '-7 days') GROUP BY prof_id`).all();

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
      const ct = byProf[r.prof_id].contrib;
      ct.total += 1;
      ct.status[r.status] += 1;
      ct.kinds[r.kind].total += 1;
      if (r.status === 'new') ct.kinds[r.kind].new += 1;
      if (r.status === 'rejected') continue;
      ct.grades[r.grade] += 1;
      if (r.kind === 'traits') {
        ct.traitsN += 1;
        for (const k of json(r.data, {}).traits || []) ct.traits[k] = (ct.traits[k] || 0) + 1;
      }
    }
    for (const r of chatByProf) {
      const ch = byProf[r.prof_id]?.chat;
      if (!ch) continue;
      ch.total += r.n;
      ch.modes[r.mode || 'unknown'] = r.n;
    }
    for (const r of chatWeek) if (byProf[r.prof_id]) byProf[r.prof_id].chat.week = r.n;

    return c.json({
      profs: [...ids].map((id) => {
        const p = profs.find((x) => x.id === id);
        return { id, name_ko: p?.name_ko ?? id, name_ja: p?.name_ja ?? id, ...byProf[id] };
      }),
    });
  });

  /* ---- 섹션별 제보 ---- */
  app.get('/api/admin/contrib', async (c) => {
    const q = c.req.query();
    const where = [];
    const args = [];
    if (q.prof) { where.push('prof_id = ?'); args.push(String(q.prof)); }
    if (KIND_KEYS.includes(q.kind)) { where.push('kind = ?'); args.push(q.kind); }
    if (STATUSES.includes(q.status)) { where.push('status = ?'); args.push(q.status); }
    if (q.q) { where.push(`data LIKE ? ESCAPE '\\'`); args.push(like(q.q)); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = int(q.limit, 50, 1, 1000);
    const offset = int(q.offset, 0, 0, 1e9);
    const total = (await db.prepare(`SELECT COUNT(*) AS n FROM contributions ${w}`).get(...args)).n;
    const rows = (await db.prepare(`SELECT * FROM contributions ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset)).map(rowOut);
    return c.json({ total, rows });
  });

  /* 검수: 상태 변경(게시 · 보류 · 반려 · 대기) 과 내용 수정. 둘 다 한 번에 보내도 됨 */
  app.patch('/api/admin/contrib/:id', async (c) => {
    const id = int(c.req.param('id'), 0, 0, 1e12);
    const row = await db.prepare('SELECT kind, status, data, ai_status FROM contributions WHERE id = ?').get(id);
    if (!row) return c.json({ error: 'not_found' }, 404);
    const { status, data } = await readJson(c);
    if (status === undefined && data === undefined) return c.json({ error: 'bad_data' }, 400);

    let nextData = null;
    if (data !== undefined) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return c.json({ error: 'bad_data' }, 400);
      const result = validate(row.kind, data); // 제보할 때와 같은 검사 (필수 항목 · 길이 · 이모지 제거)
      if (result.error) return c.json(result, 400);
      nextData = result.data;
    }
    if (status !== undefined) {
      if (!STATUSES.includes(status)) return c.json({ error: 'bad_status' }, 400);
      if (status === 'published' && !PUBLIC_KINDS.includes(row.kind)) return c.json({ error: 'not_publishable' }, 400);
    }

    const next = status ?? row.status;
    // 게시 시각: 새로 게시하면 지금, 계속 게시 중이면 그대로, 게시를 내리면 지움
    const when = next !== 'published' ? 'clear' : row.status === 'published' ? 'keep' : 'now';
    // AI 정리가 아직 진행 중인데 관리자가 먼저 손대면, 나중에 끝난 AI 결과가 덮어쓰지 않도록 skipped
    await db.prepare(`UPDATE contributions SET status = ?, data = COALESCE(?, data),
      published_at = CASE ? WHEN 'keep' THEN published_at WHEN 'now' THEN datetime('now') ELSE NULL END,
      ai_status = CASE ai_status WHEN 'pending' THEN 'skipped' ELSE ai_status END
      WHERE id = ?`).run(next, nextData ? JSON.stringify(nextData) : null, when, id);
    const updated = await db.prepare('SELECT * FROM contributions WHERE id = ?').get(id);
    // 챗봇 검색 자료 맞추기 (게시 → 생성 · 수정 → 다시 생성 · 게시 취소 → 삭제). 실패해도 검수 결과는 유지
    const indexed = contribIndex ? await contribIndex.sync(id) : null;
    return c.json({ ok: true, indexed, row: rowOut(updated) });
  });

  /* AI로 다시 정리 — 원문(original)에서 새로 정리해 data 를 바꿈 (게시 중이면 챗봇 자료도 갱신) */
  app.post('/api/admin/contrib/:id/organize', async (c) => {
    if (!organizer?.enabled()) return c.json({ error: 'ai_unavailable' }, 503);
    const id = int(c.req.param('id'), 0, 0, 1e12);
    const result = await organizer.organize(id, { force: true });
    const row = await db.prepare('SELECT * FROM contributions WHERE id = ?').get(id);
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (!result.ok) return c.json({ error: result.error, row: rowOut(row) }, result.error === 'busy' ? 409 : 502);
    return c.json({ ok: true, row: rowOut(row) });
  });

  app.delete('/api/admin/contrib/:id', async (c) => {
    const id = int(c.req.param('id'), 0, 0, 1e12);
    const row = await db.prepare('SELECT prof_id FROM contributions WHERE id = ?').get(id);
    if (!row) return c.json({ error: 'not_found' }, 404);
    await db.prepare('DELETE FROM contributions WHERE id = ?').run(id);
    await contribIndex?.remove(id, row.prof_id); // 챗봇 검색 자료도 삭제
    return c.json({ ok: true });
  });

  /* ---- 챗봇 기록 ---- */
  app.get('/api/admin/chat', async (c) => {
    const q = c.req.query();
    const where = [];
    const args = [];
    if (q.prof) { where.push('prof_id = ?'); args.push(String(q.prof)); }
    if (q.mode) { where.push('mode = ?'); args.push(String(q.mode)); }
    if (q.q) {
      where.push(`(question LIKE ? ESCAPE '\\' OR answer LIKE ? ESCAPE '\\')`);
      args.push(like(q.q), like(q.q));
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = int(q.limit, 50, 1, 1000);
    const offset = int(q.offset, 0, 0, 1e9);
    const total = (await db.prepare(`SELECT COUNT(*) AS n FROM chat_logs ${w}`).get(...args)).n;
    const rows = await db.prepare(`SELECT * FROM chat_logs ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
    return c.json({ total, rows });
  });

  /* ---- 교수님께 한마디 ---- */
  mountThreadAdmin(app, db);

  app.delete('/api/admin/chat/:id', async (c) => {
    const info = await db.prepare('DELETE FROM chat_logs WHERE id = ?').run(int(c.req.param('id'), 0, 0, 1e12));
    if (!info.changes) return c.json({ error: 'not_found' }, 404);
    return c.json({ ok: true });
  });
}
