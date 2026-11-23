/* ==========================================================================
   Node 서버 — 내 PC 실행 · 발표용(demo.ps1) · GitHub Actions 테스트
   - API 는 Cloudflare 와 같은 app.js, DB 는 SQLite 파일 (db.js)
   - 빌드된 프론트(frontend/dist)가 있으면 같이 제공 — /api 외 경로는 index.html (SPA)
   실행: npm run dev (개발, 프론트는 vite 가 /api 를 이 서버로 넘김) · npm start (seed 후 실행)
   ========================================================================== */
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { openDb, SCHEMA, migrate } from './db.js';
import { createApp } from './app.js';
import { upgradeAll } from './contrib.js';

const PORT = Number(process.env.PORT) || 8787;
const db = await openDb();
await db.exec(SCHEMA); // 새로 추가된 표가 없으면 만들기 — 기존 데이터는 그대로
await migrate(db);     // 예전 구조의 contributions 가 있으면 게시 상태가 있는 새 구조로
// 예전 통합 설문 표는 비어 있을 때만 정리 (섹션별 제보 contributions 로 대체됨)
try {
  if ((await db.prepare('SELECT COUNT(*) AS n FROM survey_responses').get()).n === 0) await db.exec('DROP TABLE survey_responses');
} catch { /* 이미 없음 */ }
// 예전 형식(섹션과 다른 항목)으로 저장된 제보 → 섹션 형식. 게시 중인 것은 챗봇 자료도 다시 만듦
const upgraded = await upgradeAll(db);

const { app, contribIndex, organizer } = createApp(db, process.env);

/* ---- 빌드된 프론트 제공 ---- */
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};
async function fileResponse(path, cache) {
  const body = await readFile(path);
  return new Response(body, { headers: { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': cache } });
}
app.get('*', async (c) => {
  const index = resolve(DIST, 'index.html');
  const target = resolve(DIST, '.' + decodeURIComponent(new URL(c.req.url).pathname));
  if (target.startsWith(DIST + sep)) {
    const st = await stat(target).catch(() => null);
    if (st?.isFile()) return fileResponse(target, target.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
  }
  if (await stat(index).catch(() => null)) return fileResponse(index, 'no-cache');
  return c.text('frontend/dist 가 없습니다. 프론트를 빌드하거나(npm run build) 개발 서버(npm run dev)를 쓰세요.', 404);
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`✓ API 서버: http://localhost:${PORT}  (search: keyword-bm25, AI: ${organizer.enabled() ? 'Claude' : '꺼짐 — 키 없음'})`);
  (async () => {
    // 게시됐는데 챗봇 검색 자료가 없는 제보 채우기 + 형식이 바뀐 게시 제보는 다시
    for (const id of upgraded) await contribIndex.sync(id);
    await contribIndex.syncMissing();
    // 서버가 꺼져서 AI 정리가 끝나지 못한 제보 다시 정리 (키가 있을 때만)
    if (organizer.enabled()) await organizer.organizePending();
  })().catch((err) => console.warn('[startup]', err.message));
});
