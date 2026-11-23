/* ==========================================================================
   DB 연결 — Cloudflare D1 용. db.js(Node)와 같은 비동기 인터페이스를 만듭니다.
   ========================================================================== */
const norm = (args) => args.map((a) => (a === undefined ? null : a));

export function wrapD1(d1) {
  const prepare = (sql) => {
    const stmt = d1.prepare(sql);
    return {
      get: async (...a) => (await stmt.bind(...norm(a)).first()) ?? undefined,
      all: async (...a) => (await stmt.bind(...norm(a)).all()).results ?? [],
      run: async (...a) => {
        const { meta } = await stmt.bind(...norm(a)).run();
        return { changes: meta?.changes ?? 0, lastInsertRowid: meta?.last_row_id ?? 0 };
      },
      bind: (...a) => stmt.bind(...norm(a)),
    };
  };
  return {
    kind: 'd1',
    prepare,
    // D1 exec 는 한 줄에 한 문장 — 주석을 지우고 문장마다 한 줄로
    exec: (sql) => d1.exec(sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).map((s) => `${s};`).join('\n')),
    batch: (list) => d1.batch(list), // D1 batch = 한 트랜잭션
  };
}
