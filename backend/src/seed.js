/* ==========================================================================
   DB 채우기 + RAG 청크 만들기
   1) data/profs.json (프론트에서 npm run export-data 로 생성) 읽기
   2) 테이블을 비우고 다시 채우기
   3) 검색 단위(chunks) 만들기 → OpenAI 임베딩 → 저장
   실행: npm run seed
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, SCHEMA, DB_PATH, migrate } from './db.js';
import { embed, EMBED_MODEL } from './openai.js';
import { contribChunk, sceneTitleFor } from './contribIndex.js';
import { upgradeAll } from './contrib.js';

const here = dirname(fileURLToPath(import.meta.url));
const profs = JSON.parse(readFileSync(resolve(here, '../data/profs.json'), 'utf8'));

// 'abc' 또는 { ko, ja } → { ko, ja }
const L = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? { ko: v.ko ?? '', ja: v.ja ?? v.ko ?? '' } : { ko: v ?? '', ja: v ?? '' });
const LEVEL = {
  warning: { ko: '경고', ja: '警告' }, hint: { ko: '팁', ja: 'ヒント' },
  error: { ko: '금지', ja: '禁止' }, note: { ko: '참고', ja: '参考' },
};

const db = openDb();
db.exec(`DROP TABLE IF EXISTS chunks; DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS dict_entries;
  DROP TABLE IF EXISTS talk_topics; DROP TABLE IF EXISTS warnings; DROP TABLE IF EXISTS scene_items;
  DROP TABLE IF EXISTS scenes; DROP TABLE IF EXISTS traits; DROP TABLE IF EXISTS professors;`);
db.exec(SCHEMA);

const ins = {
  prof: db.prepare(`INSERT INTO professors VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  trait: db.prepare(`INSERT INTO traits (prof_id, ord, label_ko, label_ja, pct) VALUES (?,?,?,?,?)`),
  scene: db.prepare(`INSERT INTO scenes (prof_id, ord, file, tab, title_ko, title_ja, tip_ko, tip_ja) VALUES (?,?,?,?,?,?,?,?)`),
  item: db.prepare(`INSERT INTO scene_items (scene_id, ord, text_ko, text_ja) VALUES (?,?,?,?)`),
  warn: db.prepare(`INSERT INTO warnings (prof_id, code, level, title_ko, title_ja, msg_ko, msg_ja) VALUES (?,?,?,?,?,?,?)`),
  talk: db.prepare(`INSERT INTO talk_topics (prof_id, key, title_ko, title_ja, body_ko, body_ja) VALUES (?,?,?,?,?,?)`),
  dict: db.prepare(`INSERT INTO dict_entries (prof_id, term, tag, meaning_ko, meaning_ja, tip_ko, tip_ja, in_preview) VALUES (?,?,?,?,?,?,?,?)`),
  chunk: db.prepare(`INSERT INTO chunks (prof_id, source_type, source_ref, title_ko, title_ja, content_ko, content_ja, embedding, embedding_ja, embed_model) VALUES (?,?,?,?,?,?,?,?,?,?)`),
};

const chunks = []; // { prof_id, type, ref, title:{ko,ja}, content:{ko,ja} }
const add = (prof_id, type, ref, title, content) => chunks.push({ prof_id, type, ref, title, content });

db.exec('BEGIN');
for (const p of profs) {
  const name = L(p.name), short = L(p.short);
  const s = p.status, sv = p.survey;
  ins.prof.run(
    p.id, name.ko, name.ja, short.ko, short.ja, p.avatar ? 1 : 0,
    JSON.stringify({ code: p.code, badges: p.badges, synopsis: p.synopsis }),
    sv?.n ?? null, sv ? L(sv.note).ko : null, sv ? L(sv.note).ja : null,
    p.traitsLead ? L(p.traitsLead).ko : null, p.traitsLead ? L(p.traitsLead).ja : null,
    p.traitsSub ? L(p.traitsSub).ko : null, p.traitsSub ? L(p.traitsSub).ja : null,
    s ? L(s.mood).ko : null, s ? L(s.mood).ja : null, s ? L(s.reason).ko : null, s ? L(s.reason).ja : null, s?.votes ?? null,
    p.dictDesc ? L(p.dictDesc).ko : null, p.dictDesc ? L(p.dictDesc).ja : null,
  );

  /* ---- 프로필 청크: 히어로 코드 블록 + 상태 ---- */
  const codeLines = (lang) => (p.code || []).flat().map((c) => {
    const v = L(c.v)[lang];
    const val = Array.isArray(v) ? v.join(', ') : v;
    const note = c.note ? ` (${L(c.note)[lang]})` : '';
    return `${c.k}: ${val}${note}`;
  }).join(' / ');
  const hasData = (p.traits?.length || p.scenes?.length || p.warnings?.length || p.talk?.length || p.dict?.length) > 0;
  add(p.id, 'profile', p.id, { ko: `${name.ko} 프로필`, ja: `${name.ja} プロフィール` }, {
    ko: `${name.ko} 기본 정보. ${codeLines('ko')}.` +
      (s ? ` 최근 분위기: ${L(s.mood).ko} (${L(s.reason).ko}).` : '') +
      (hasData ? '' : ' 아직 설문 데이터를 수집 중이라 자세한 정보가 없습니다.'),
    ja: `${name.ja}の基本情報。${codeLines('ja')}。` +
      (s ? ` 最近の雰囲気: ${L(s.mood).ja}（${L(s.reason).ja}）。` : '') +
      (hasData ? '' : ' まだアンケートを収集中のため、詳しい情報はありません。'),
  });

  /* ---- 01 성향 ---- */
  (p.traits || []).forEach((t, i) => ins.trait.run(p.id, i, L(t.label).ko, L(t.label).ja, t.pct));
  if (p.traits?.length) {
    const list = (lang) => p.traits.map((t) => `${L(t.label)[lang]} ${t.pct}%`).join(', ');
    add(p.id, 'traits', 'traits', { ko: '성향 분석', ja: '性格分析' }, {
      ko: `설문(응답 ${sv?.n ?? '?'}명, ${L(sv?.note).ko}) 결과 성향: ${list('ko')}. ${L(p.traitsLead).ko} ${L(p.traitsSub).ko}`,
      ja: `アンケート（回答${sv?.n ?? '?'}人、${L(sv?.note).ja}）の結果: ${list('ja')}。${L(p.traitsLead).ja} ${L(p.traitsSub).ja}`,
    });
  }

  /* ---- 02 상황별 가이드 ---- */
  (p.scenes || []).forEach((sc, i) => {
    const { lastInsertRowid } = ins.scene.run(p.id, i, sc.file, sc.tab, L(sc.title).ko, L(sc.title).ja, L(sc.tip).ko, L(sc.tip).ja);
    sc.items.forEach((it, j) => ins.item.run(lastInsertRowid, j, L(it).ko, L(it).ja));
    const items = (lang) => sc.items.map((it) => `- ${L(it)[lang]}`).join('\n');
    add(p.id, 'scene', sc.tab, { ko: `상황별 가이드 · ${L(sc.title).ko}`, ja: `場面別ガイド · ${L(sc.title).ja}` }, {
      ko: `상황: ${L(sc.title).ko}\n체크리스트:\n${items('ko')}\n선배 팁: ${L(sc.tip).ko}`,
      ja: `場面: ${L(sc.title).ja}\nチェックリスト:\n${items('ja')}\n先輩のコツ: ${L(sc.tip).ja}`,
    });
  });

  /* ---- 주의사항 ---- */
  (p.warnings || []).forEach((w) => {
    ins.warn.run(p.id, w.id, w.level, L(w.title).ko, L(w.title).ja, L(w.msg).ko, L(w.msg).ja);
    add(p.id, 'warning', w.id, { ko: `주의사항 · ${L(w.title).ko}`, ja: `注意事項 · ${L(w.title).ja}` }, {
      ko: `[${LEVEL[w.level].ko}] ${L(w.title).ko}: ${L(w.msg).ko}`,
      ja: `[${LEVEL[w.level].ja}] ${L(w.title).ja}: ${L(w.msg).ja}`,
    });
  });

  /* ---- 03 스몰토크 ---- */
  (p.talk || []).forEach((k) => {
    ins.talk.run(p.id, k.key, L(k.title).ko, L(k.title).ja, L(k.body).ko, L(k.body).ja);
    add(p.id, 'talk', k.key, { ko: `스몰토크 · ${L(k.title).ko}`, ja: `雑談ネタ · ${L(k.title).ja}` }, {
      ko: `스몰토크 소재 "${L(k.title).ko}": ${L(k.body).ko}`,
      ja: `雑談ネタ「${L(k.title).ja}」: ${L(k.body).ja}`,
    });
  });

  /* ---- 04 사전 ---- */
  const preview = new Set((p.dictPreview || []).map((d) => d.term));
  (p.dict || []).forEach((d) => {
    ins.dict.run(p.id, d.term, d.tag, d.ko, d.ja, L(d.tip).ko, L(d.tip).ja, preview.has(d.term) ? 1 : 0);
    add(p.id, 'dict', d.term, { ko: `말버릇 사전 · ${d.term}`, ja: `口癖辞典 · ${d.term}` }, {
      ko: `교수님 말버릇/사투리 "${d.term}" (${d.tag}): 뜻은 "${d.ko}". 팁: ${L(d.tip).ko}`,
      ja: `教授の口癖・方言「${d.term}」(${d.tag}): 意味は「${d.ja}」（標準語: ${d.ko}）。コツ: ${L(d.tip).ja}`,
    });
  });
  if (p.dictDesc) {
    add(p.id, 'dict', 'about', { ko: '말버릇 사전 · 소개', ja: '口癖辞典 · 紹介' }, { ko: L(p.dictDesc).ko, ja: L(p.dictDesc).ja });
  }

  /* 05 한마디는 DB에 넣지 않음 (프론트 전용) */
}
db.exec('COMMIT');

/* ---- 관리자가 게시한 선배 제보도 검색 자료에 포함 (chunks 를 새로 만들었으니 다시 추가) ---- */
try {
  migrate(db);
  upgradeAll(db); // 예전 형식 제보 → 섹션 형식 (서버보다 seed 를 먼저 돌린 경우)
  const published = db.prepare(`SELECT id, prof_id, kind, data FROM contributions WHERE status = 'published' AND kind != 'other'`).all();
  for (const row of published) {
    if (!profs.some((p) => p.id === row.prof_id)) continue;
    const c = contribChunk(row, { sceneTitle: sceneTitleFor(db, row) });
    add(c.prof_id, c.type, c.ref, c.title, c.content);
  }
  if (published.length) console.log(`게시된 선배 제보 ${published.length}개 포함`);
} catch { /* contributions 테이블이 아직 없음 */ }

/* ---- 임베딩: 언어별로 따로 (섞으면 점수가 흐려짐) ----
   섹션마다 "이런 질문에 답하는 자료"라는 힌트를 앞에 붙여 검색이 잘 되게 함 */
const HINT = {
  profile: { ko: '교수님 기본 정보, 어떤 분인지', ja: '教授の基本情報、どんな人か' },
  traits: { ko: '교수님 성격, 성향, 어떤 스타일인지 설문 결과', ja: '教授の性格・タイプ、アンケート結果' },
  scene: { ko: '이런 상황에서 어떻게 준비하고 대처하면 되는지', ja: 'この場面でどう準備・対処すればいいか' },
  warning: { ko: '조심할 점, 하면 안 되는 것, 주의사항', ja: '気をつけること、してはいけないこと' },
  talk: { ko: '스몰토크, 대화 주제, 교수님과 무슨 이야기를 하면 좋은지, 취미와 좋아하는 것', ja: '雑談・話題、教授と何を話せばいいか、趣味や好きなもの' },
  dict: { ko: '교수님 말버릇·사투리 표현의 뜻, 무슨 말인지', ja: '教授の口癖・方言の意味、どういう意味か' },
};
const nameOf = Object.fromEntries(profs.map((p) => [p.id, L(p.name)]));
const textFor = (c, lang) => `${nameOf[c.prof_id][lang]} · ${HINT[c.type][lang]}\n${c.title[lang]}\n${c.content[lang]}`;

console.log(`청크 ${chunks.length}개 × 2개 언어 임베딩 중... (${EMBED_MODEL})`);
const vectors = await embed([...chunks.map((c) => textFor(c, 'ko')), ...chunks.map((c) => textFor(c, 'ja'))]);
const blob = (v) => new Uint8Array(v.buffer, v.byteOffset, v.byteLength);

db.exec('BEGIN');
chunks.forEach((c, i) => {
  ins.chunk.run(c.prof_id, c.type, c.ref, c.title.ko, c.title.ja, c.content.ko, c.content.ja,
    blob(vectors[i]), blob(vectors[chunks.length + i]), EMBED_MODEL);
});
db.exec('COMMIT');

const count = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
console.log(`✓ 완료 → ${DB_PATH}`);
for (const t of ['professors', 'traits', 'scenes', 'scene_items', 'warnings', 'talk_topics', 'dict_entries', 'chunks']) {
  console.log(`  ${t.padEnd(13)} ${count(t)}`);
}
db.close();
