/* ==========================================================================
   DB 연결 — Node 용 (내장 node:sqlite, SQLite 파일 backend/data/gsc.db)
   Cloudflare 에서는 d1.js 가 같은 모양의 인터페이스를 만듭니다. 나머지 코드는 둘을 구분하지 않습니다.

   공통 인터페이스 (모두 비동기):
     db.prepare(sql).get(...args)  → 행 하나 (없으면 undefined)
     db.prepare(sql).all(...args)  → 행 배열
     db.prepare(sql).run(...args)  → { changes, lastInsertRowid }
     db.prepare(sql).bind(...args) → db.batch([...]) 에 넣을 문장
     db.batch([stmt, ...])         → 한 트랜잭션으로 실행 (하나라도 실패하면 전부 취소)
     db.exec(sql)                  → 여러 문장 그대로 실행 (스키마 등)
   ========================================================================== */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA } from './schema.js';

export { SCHEMA };

const here = dirname(fileURLToPath(import.meta.url));
// DB 파일 위치를 바꾸려면 DB_PATH 환경 변수 (예: 다른 폴더의 gsc.db)
export const DB_PATH = process.env.DB_PATH ? resolve(process.env.DB_PATH) : resolve(here, '../data/gsc.db');

const norm = (args) => args.map((a) => (a === undefined ? null : a));

export async function openDb() {
  const { DatabaseSync } = await import('node:sqlite');
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const raw = new DatabaseSync(DB_PATH);
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

  const prepare = (sql) => {
    const stmt = raw.prepare(sql);
    return {
      get: async (...a) => stmt.get(...norm(a)),
      all: async (...a) => stmt.all(...norm(a)),
      run: async (...a) => {
        const info = stmt.run(...norm(a));
        return { changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) };
      },
      bind: (...a) => ({ stmt, args: norm(a) }),
    };
  };

  return {
    kind: 'node',
    raw,
    prepare,
    exec: async (sql) => { raw.exec(sql); },
    async batch(list) {
      raw.exec('BEGIN');
      try {
        const out = list.map(({ stmt, args }) => stmt.run(...args));
        raw.exec('COMMIT');
        return out;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
    close: () => raw.close(),
  };
}

/** 예전 contributions(상태 'used', published_at 없음) → 새 구조로 옮기기 (Node 의 예전 DB 파일용) */
export async function migrate(db) {
  const row = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'contributions'").get();
  if (!row) return;
  if (row.sql.includes("'published'")) {
    // AI 정리용 칸(original · ai_status · ai_note)이 없으면 추가 — 기존 데이터는 그대로
    const cols = (await db.prepare('PRAGMA table_info(contributions)').all()).map((c) => c.name);
    for (const col of ['original', 'ai_status', 'ai_note']) {
      if (!cols.includes(col)) await db.exec(`ALTER TABLE contributions ADD COLUMN ${col} TEXT`);
    }
    return;
  }
  await db.exec(`BEGIN;
    ALTER TABLE contributions RENAME TO contributions_old;
    ${SCHEMA}
    INSERT INTO contributions (id, prof_id, kind, lang, grade, data, status, created_at, published_at)
      SELECT id, prof_id, kind, lang, grade, data,
        CASE status WHEN 'used' THEN 'published' ELSE status END, created_at,
        CASE status WHEN 'used' THEN created_at END
      FROM contributions_old;
    DROP TABLE contributions_old;
    ${SCHEMA}
    COMMIT;`);
  console.log('✓ contributions 테이블을 새 구조(게시 상태)로 옮김');
}
