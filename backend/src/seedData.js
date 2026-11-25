/* ==========================================================================
   기본 자료(data/profs.json) → DB 에 넣을 SQL 문장 목록 [sql, args]
   - Node: seed.js 가 한 트랜잭션으로 실행 / Cloudflare: scripts/seed-sql.mjs 가 SQL 파일로 만들어 D1 에 실행
   - 지우지 않는 것: 선배 제보(contributions) · 한마디(thread_posts) · 챗봇 기록(chat_logs) · 제보로 만든 검색 자료(contrib:*)
   - 교수님(professors)은 지우지 않고 덮어씀 (지우면 FK 로 제보 검색 자료까지 같이 지워짐)
   ========================================================================== */
import { SEARCH_MODEL } from './search.js';

// 'abc' 또는 { ko, ja } → { ko, ja }
const L = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? { ko: v.ko ?? '', ja: v.ja ?? v.ko ?? '' } : { ko: v ?? '', ja: v ?? '' });
const LEVEL = {
  warning: { ko: '경고', ja: '警告' }, hint: { ko: '팁', ja: 'ヒント' },
  error: { ko: '금지', ja: '禁止' }, note: { ko: '참고', ja: '参考' },
};

const PROF_COLS = ['id', 'name_ko', 'name_ja', 'short_ko', 'short_ja', 'has_avatar', 'profile_json', 'survey_n', 'survey_note_ko', 'survey_note_ja',
  'traits_lead_ko', 'traits_lead_ja', 'traits_sub_ko', 'traits_sub_ja', 'status_mood_ko', 'status_mood_ja',
  'status_reason_ko', 'status_reason_ja', 'status_votes', 'dict_desc_ko', 'dict_desc_ja'];
const UPSERT_PROF = `INSERT INTO professors (${PROF_COLS.join(', ')}) VALUES (${PROF_COLS.map(() => '?').join(',')})
  ON CONFLICT(id) DO UPDATE SET ${PROF_COLS.slice(1).map((c) => `${c} = excluded.${c}`).join(', ')}`;

/** profs: data/profs.json 내용 → { statements: [[sql, args], ...], counts } */
export function seedStatements(profs) {
  const out = [];
  const q = (sql, ...args) => out.push([sql, args]);
  const counts = { professors: 0, traits: 0, scenes: 0, scene_items: 0, warnings: 0, talk_topics: 0, dict_entries: 0, chunks: 0 };

  // 기본 자료만 비우기 (자식 표부터)
  q(`DELETE FROM chunks WHERE source_ref IS NULL OR source_ref NOT LIKE 'contrib:%'`);
  for (const t of ['scene_items', 'scenes', 'traits', 'warnings', 'talk_topics', 'dict_entries']) q(`DELETE FROM ${t}`);

  const chunk = (prof_id, type, ref, title, content) => {
    q(`INSERT INTO chunks (prof_id, source_type, source_ref, title_ko, title_ja, content_ko, content_ja, embedding, embedding_ja, embed_model)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, prof_id, type, ref, title.ko, title.ja, content.ko, content.ja, null, null, SEARCH_MODEL);
    counts.chunks += 1;
  };

  for (const p of profs) {
    const name = L(p.name), short = L(p.short);
    const s = p.status, sv = p.survey;
    q(UPSERT_PROF,
      p.id, name.ko, name.ja, short.ko, short.ja, p.avatar ? 1 : 0,
      JSON.stringify({ code: p.code, badges: p.badges, synopsis: p.synopsis }),
      sv?.n ?? null, sv ? L(sv.note).ko : null, sv ? L(sv.note).ja : null,
      p.traitsLead ? L(p.traitsLead).ko : null, p.traitsLead ? L(p.traitsLead).ja : null,
      p.traitsSub ? L(p.traitsSub).ko : null, p.traitsSub ? L(p.traitsSub).ja : null,
      s ? L(s.mood).ko : null, s ? L(s.mood).ja : null, s ? L(s.reason).ko : null, s ? L(s.reason).ja : null, s?.votes ?? null,
      p.dictDesc ? L(p.dictDesc).ko : null, p.dictDesc ? L(p.dictDesc).ja : null);
    counts.professors += 1;

    /* ---- 프로필 청크: 히어로 코드 블록 + 상태 ---- */
    const codeLines = (lang) => (p.code || []).flat().map((c) => {
      const v = L(c.v)[lang];
      const val = Array.isArray(v) ? v.join(', ') : v;
      const note = c.note ? ` (${L(c.note)[lang]})` : '';
      return `${c.k}: ${val}${note}`;
    }).join(' / ');
    const hasData = (p.traits?.length || p.scenes?.length || p.warnings?.length || p.talk?.length || p.dict?.length) > 0;
    chunk(p.id, 'profile', p.id, { ko: `${name.ko} 프로필`, ja: `${name.ja} プロフィール` }, {
      ko: `${name.ko} 기본 정보. ${codeLines('ko')}.` +
        (s ? ` 최근 분위기: ${L(s.mood).ko} (${L(s.reason).ko}).` : '') +
        (hasData ? '' : ' 아직 설문 데이터를 수집 중이라 자세한 정보가 없습니다.'),
      ja: `${name.ja}の基本情報。${codeLines('ja')}。` +
        (s ? ` 最近の雰囲気: ${L(s.mood).ja}（${L(s.reason).ja}）。` : '') +
        (hasData ? '' : ' まだアンケートを収集中のため、詳しい情報はありません。'),
    });

    /* ---- 01 성향 ---- */
    (p.traits || []).forEach((t, i) => {
      q('INSERT INTO traits (prof_id, ord, label_ko, label_ja, pct) VALUES (?,?,?,?,?)', p.id, i, L(t.label).ko, L(t.label).ja, t.pct);
      counts.traits += 1;
    });
    if (p.traits?.length) {
      const list = (lang) => p.traits.map((t) => `${L(t.label)[lang]} ${t.pct}%`).join(', ');
      chunk(p.id, 'traits', 'traits', { ko: '성향 분석', ja: '性格分析' }, {
        ko: `설문(응답 ${sv?.n ?? '?'}명, ${L(sv?.note).ko}) 결과 성향: ${list('ko')}. ${L(p.traitsLead).ko} ${L(p.traitsSub).ko}`,
        ja: `アンケート（回答${sv?.n ?? '?'}人、${L(sv?.note).ja}）の結果: ${list('ja')}。${L(p.traitsLead).ja} ${L(p.traitsSub).ja}`,
      });
    }

    /* ---- 02 상황별 가이드 (체크리스트는 카드 tab 으로 카드를 찾아 연결) ---- */
    (p.scenes || []).forEach((sc, i) => {
      q('INSERT INTO scenes (prof_id, ord, file, tab, title_ko, title_ja, tip_ko, tip_ja) VALUES (?,?,?,?,?,?,?,?)',
        p.id, i, sc.file, sc.tab, L(sc.title).ko, L(sc.title).ja, L(sc.tip).ko, L(sc.tip).ja);
      counts.scenes += 1;
      sc.items.forEach((it, j) => {
        q('INSERT INTO scene_items (scene_id, ord, text_ko, text_ja) VALUES ((SELECT id FROM scenes WHERE prof_id = ? AND tab = ?),?,?,?)',
          p.id, sc.tab, j, L(it).ko, L(it).ja);
        counts.scene_items += 1;
      });
      const items = (lang) => sc.items.map((it) => `- ${L(it)[lang]}`).join('\n');
      chunk(p.id, 'scene', sc.tab, { ko: `상황별 가이드 · ${L(sc.title).ko}`, ja: `場面別ガイド · ${L(sc.title).ja}` }, {
        ko: `상황: ${L(sc.title).ko}\n체크리스트:\n${items('ko')}\n선배 팁: ${L(sc.tip).ko}`,
        ja: `場面: ${L(sc.title).ja}\nチェックリスト:\n${items('ja')}\n先輩のコツ: ${L(sc.tip).ja}`,
      });
    });

    /* ---- 주의사항 ---- */
    (p.warnings || []).forEach((w) => {
      q('INSERT INTO warnings (prof_id, code, level, title_ko, title_ja, msg_ko, msg_ja) VALUES (?,?,?,?,?,?,?)',
        p.id, w.id, w.level, L(w.title).ko, L(w.title).ja, L(w.msg).ko, L(w.msg).ja);
      counts.warnings += 1;
      chunk(p.id, 'warning', w.id, { ko: `주의사항 · ${L(w.title).ko}`, ja: `注意事項 · ${L(w.title).ja}` }, {
        ko: `[${LEVEL[w.level].ko}] ${L(w.title).ko}: ${L(w.msg).ko}`,
        ja: `[${LEVEL[w.level].ja}] ${L(w.title).ja}: ${L(w.msg).ja}`,
      });
    });

    /* ---- 03 스몰토크 ---- */
    (p.talk || []).forEach((k) => {
      q('INSERT INTO talk_topics (prof_id, key, title_ko, title_ja, body_ko, body_ja) VALUES (?,?,?,?,?,?)',
        p.id, k.key, L(k.title).ko, L(k.title).ja, L(k.body).ko, L(k.body).ja);
      counts.talk_topics += 1;
      chunk(p.id, 'talk', k.key, { ko: `스몰토크 · ${L(k.title).ko}`, ja: `雑談ネタ · ${L(k.title).ja}` }, {
        ko: `스몰토크 소재 "${L(k.title).ko}": ${L(k.body).ko}`,
        ja: `雑談ネタ「${L(k.title).ja}」: ${L(k.body).ja}`,
      });
    });

    /* ---- 04 사전 ---- */
    const preview = new Set((p.dictPreview || []).map((d) => d.term));
    (p.dict || []).forEach((d) => {
      q('INSERT INTO dict_entries (prof_id, term, tag, meaning_ko, meaning_ja, tip_ko, tip_ja, in_preview) VALUES (?,?,?,?,?,?,?,?)',
        p.id, d.term, d.tag, d.ko, d.ja, L(d.tip).ko, L(d.tip).ja, preview.has(d.term) ? 1 : 0);
      counts.dict_entries += 1;
      chunk(p.id, 'dict', d.term, { ko: `말버릇 사전 · ${d.term}`, ja: `口癖辞典 · ${d.term}` }, {
        ko: `교수님 말버릇/사투리 "${d.term}" (${d.tag}): 뜻은 "${d.ko}". 팁: ${L(d.tip).ko}`,
        ja: `教授の口癖・方言「${d.term}」(${d.tag}): 意味は「${d.ja}」（標準語: ${d.ko}）。コツ: ${L(d.tip).ja}`,
      });
    });
    if (p.dictDesc) {
      chunk(p.id, 'dict', 'about', { ko: '말버릇 사전 · 소개', ja: '口癖辞典 · 紹介' }, { ko: L(p.dictDesc).ko, ja: L(p.dictDesc).ja });
    }
    /* 05 한마디 기본 글(posts)은 프론트 데이터 파일에서 바로 보여 줌 — DB 에는 학생들이 쓴 글만 */
  }
  return { statements: out, counts };
}

/** [sql, args] → 값이 박힌 SQL 한 문장 (D1 SQL 파일용) */
export function inlineSql(sql, args) {
  const lit = (v) => (v === null || v === undefined ? 'NULL'
    : typeof v === 'number' ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`);
  let i = 0;
  const s = sql.replace(/\?/g, () => lit(args[i++]));
  if (i !== args.length) throw new Error(`자리 수(${i})와 값 수(${args.length})가 다름: ${sql.slice(0, 60)}`);
  return `${s.replace(/\s*\n\s*/g, ' ')};`;
}
