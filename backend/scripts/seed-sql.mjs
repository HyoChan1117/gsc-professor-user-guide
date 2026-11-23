/* ==========================================================================
   Cloudflare D1 용 SQL 파일 만들기 — npm run seed:sql  (GitHub Actions 배포에서 사용)
   표 만들기(CREATE IF NOT EXISTS) + 기본 자료 새로 채우기 (seedData.js 와 같은 내용)
   선배 제보 · 한마디 · 챗봇 기록은 건드리지 않습니다.
   적용: npx wrangler d1 execute gsc-db --remote --file backend/data/d1-seed.sql
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA } from '../src/schema.js';
import { seedStatements, inlineSql } from '../src/seedData.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../data/d1-seed.sql');
const profs = JSON.parse(readFileSync(resolve(here, '../data/profs.json'), 'utf8'));
const { statements, counts } = seedStatements(profs);

const sql = [
  '-- 자동 생성 파일 (npm run seed:sql) — 직접 고치지 마세요',
  SCHEMA.trim(),
  ...statements.map(([s, args]) => inlineSql(s, args)),
  '',
].join('\n');
writeFileSync(out, sql);
console.log(`✓ ${out} (${statements.length}문장 · ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')})`);
