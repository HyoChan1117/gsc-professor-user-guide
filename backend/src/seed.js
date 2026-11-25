/* ==========================================================================
   기본 자료 넣기 (Node · SQLite 파일) — npm run seed
   1) data/profs.json (프론트에서 npm run export-data 로 생성) 읽기
   2) 표가 없으면 만들기 → 기본 자료만 새로 채우기 (seedData.js)
      선배 제보 · 한마디 · 챗봇 기록은 그대로 둠
   Cloudflare D1 은 같은 내용을 scripts/seed-sql.mjs 가 SQL 파일로 만들어 넣습니다.
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, SCHEMA, DB_PATH, migrate } from './db.js';
import { seedStatements } from './seedData.js';

const here = dirname(fileURLToPath(import.meta.url));
const profs = JSON.parse(readFileSync(resolve(here, '../data/profs.json'), 'utf8'));

const db = await openDb();
await db.exec(SCHEMA);
await migrate(db);
const { statements, counts } = seedStatements(profs);
await db.batch(statements.map(([sql, args]) => db.prepare(sql).bind(...args)));

console.log(`✓ 완료 → ${DB_PATH}`);
for (const [t, n] of Object.entries(counts)) console.log(`  ${t.padEnd(13)} ${n}`);
const kept = await db.prepare(`SELECT (SELECT COUNT(*) FROM contributions) AS c, (SELECT COUNT(*) FROM thread_posts) AS t,
  (SELECT COUNT(*) FROM chunks WHERE source_ref LIKE 'contrib:%') AS k`).get();
console.log(`  (그대로 둔 것: 제보 ${kept.c}, 한마디 ${kept.t}, 제보 검색 자료 ${kept.k})`);
db.close();
