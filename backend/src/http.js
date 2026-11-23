/* ==========================================================================
   라우트 공통 도우미 (Hono — Node 와 Cloudflare Workers 둘 다)
   ========================================================================== */

/** 접속자 IP — Cloudflare: cf-connecting-ip, Node: TRUST_PROXY 면 X-Forwarded-For 맨 끝, 아니면 소켓 주소 */
export function clientIp(c) {
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf;
  if (c.get('trustProxy')) {
    const xff = c.req.header('x-forwarded-for');
    if (xff) return xff.split(',').map((s) => s.trim()).filter(Boolean).pop();
  }
  return c.env?.incoming?.socket?.remoteAddress || 'unknown';
}

/** 아주 단순한 요청 제한: IP당 1분에 max번 (서버 인스턴스마다 따로 셈) */
export function makeRateLimit(max) {
  const hits = new Map();
  return async function rateLimit(c, next) {
    const now = Date.now();
    const key = clientIp(c);
    const list = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (list.length >= max) return c.json({ error: 'too_many_requests' }, 429);
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
    return next();
  };
}

/** 요청 본문 JSON (크기 제한, 실패하면 {}) */
export async function readJson(c, limit = 32 * 1024) {
  const text = await c.req.text().catch(() => '');
  if (text.length > limit) return { __tooLarge: true };
  try { return JSON.parse(text || '{}') || {}; } catch { return {}; }
}

/** 응답을 보낸 뒤에도 이어서 할 일 (Cloudflare 는 waitUntil 로 지켜 줘야 끊기지 않음) */
export function background(c, promise) {
  const p = Promise.resolve(promise).catch((err) => console.error('[background]', err));
  try { c.executionCtx.waitUntil(p); } catch { /* Node: 그냥 진행 */ }
}

export const int = (v, def, min, max) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
export const like = (q) => `%${String(q).replace(/[\\%_]/g, (ch) => '\\' + ch)}%`;
