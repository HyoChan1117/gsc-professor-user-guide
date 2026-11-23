/* ==========================================================================
   홈 · 섹션 페이지용 교수님 데이터 — GET /api/profs/:id
   DB 표(professors · traits · scenes · warnings · talk_topics · dict_entries)를
   프론트 데이터 파일(frontend/src/data/profs/*.jsx)과 같은 모양으로 만들고,
   관리자가 게시한 선배 제보를 각 섹션 항목으로 합칩니다.
     traits  → 설문 인원에 투표를 더해 비율 다시 계산
     scene   → 기존 상황 카드에 체크리스트 추가 / 새 상황 카드
     warning · talk · dict → 항목 하나씩 추가
   제보로 들어온 항목에는 contrib: { id, lang } 가 붙습니다 (화면에 "선배 제보" 표시용).
   제보 글은 쓴 언어 그대로라 ko · ja 에 같은 글이 들어갑니다.
   ========================================================================== */
import { DEFAULT_TRAITS, NEW_SCENE } from './contrib.js';

const L = (ko, ja) => ({ ko: ko ?? '', ja: ja || ko || '' });
const same = (text) => ({ ko: text, ja: text });
const parse = (s, fb = null) => { try { return JSON.parse(s); } catch { return fb; } };
const LEVEL_PREFIX = { warning: 'W', hint: 'H', error: 'E', note: 'N' };
const NO_MEANING = { ko: '의미 조사 중', ja: '意味を調査中' };

export async function buildProfView(db, id) {
  const p = await db.prepare('SELECT * FROM professors WHERE id = ?').get(id);
  if (!p) return null;
  const all = (sql) => db.prepare(sql).all(id);
  const profile = parse(p.profile_json, {}) || {};

  /* ---- DB 기본 데이터 ---- */
  let traits = (await all('SELECT label_ko, label_ja, pct FROM traits WHERE prof_id = ? ORDER BY ord'))
    .map((r) => ({ pct: r.pct, label: L(r.label_ko, r.label_ja) }));
  // 체크리스트는 한 번에 읽어서 카드별로 나눔
  const sceneItems = await all('SELECT scene_id, text_ko, text_ja FROM scene_items WHERE scene_id IN (SELECT id FROM scenes WHERE prof_id = ?) ORDER BY scene_id, ord');
  const scenes = (await all('SELECT id, file, tab, title_ko, title_ja, tip_ko, tip_ja FROM scenes WHERE prof_id = ? ORDER BY ord')).map((s) => ({
    file: s.file,
    tab: s.tab,
    title: L(s.title_ko, s.title_ja),
    tip: L(s.tip_ko, s.tip_ja),
    items: sceneItems.filter((it) => it.scene_id === s.id).map((it) => L(it.text_ko, it.text_ja)),
  }));
  const warnings = (await all('SELECT code, level, title_ko, title_ja, msg_ko, msg_ja FROM warnings WHERE prof_id = ? ORDER BY id'))
    .map((w) => ({ level: w.level, id: w.code, title: L(w.title_ko, w.title_ja), msg: L(w.msg_ko, w.msg_ja) }));
  const talk = (await all('SELECT key, title_ko, title_ja, body_ko, body_ja FROM talk_topics WHERE prof_id = ? ORDER BY id'))
    .map((k) => ({ key: k.key, title: L(k.title_ko, k.title_ja), body: L(k.body_ko, k.body_ja) }));
  const dictRows = await all('SELECT term, tag, meaning_ko, meaning_ja, tip_ko, tip_ja, in_preview FROM dict_entries WHERE prof_id = ? ORDER BY id');
  const dict = dictRows.map((d) => ({ term: d.term, tag: d.tag, ko: d.meaning_ko, ja: d.meaning_ja || d.meaning_ko, tip: L(d.tip_ko, d.tip_ja) }));
  const dictPreview = dictRows.filter((d) => d.in_preview).map((d) => ({ term: d.term, ko: d.meaning_ko, ja: d.meaning_ja || d.meaning_ko }));
  let survey = p.survey_n != null ? { n: p.survey_n, note: L(p.survey_note_ko, p.survey_note_ja) } : null;

  /* ---- 게시된 선배 제보 합치기 (게시 순서대로) ---- */
  const contribs = (await all(`SELECT id, kind, lang, data FROM contributions
    WHERE prof_id = ? AND status = 'published' AND kind != 'other' ORDER BY published_at, id`))
    .map((r) => ({ ...r, data: parse(r.data, {}) || {} }));
  const mark = (c) => ({ id: c.id, lang: c.lang });
  const counted = { traits: 0, scene: 0, warning: 0, talk: 0, dict: 0 };

  // 성향: 기존 비율 × 설문 인원 = 인원수, 여기에 투표를 더해 비율 다시 계산
  const votes = contribs.filter((c) => c.kind === 'traits' && Array.isArray(c.data.traits));
  if (votes.length) {
    const baseN = survey?.n ?? 0;
    const rows = traits.map((t) => ({ label: t.label, count: Math.round((t.pct * baseN) / 100), added: 0 }));
    for (const v of votes) {
      for (const ko of v.data.traits) {
        let row = rows.find((r) => r.label.ko === ko);
        if (!row) {
          const def = DEFAULT_TRAITS.find((t) => t.ko === ko);
          row = { label: L(ko, def?.ja), count: 0, added: 0 };
          rows.push(row);
        }
        row.count += 1;
        row.added += 1;
      }
    }
    const n = baseN + votes.length;
    traits = rows
      .map((r) => ({ pct: Math.round((r.count / n) * 100), label: r.label, ...(r.added ? { contrib: { votes: r.added } } : {}) }))
      .filter((t) => t.pct > 0 || t.contrib)
      .sort((a, b) => b.pct - a.pct);
    const extra = { ko: ` · 사이트 제보 ${votes.length}`, ja: ` · サイト投稿 ${votes.length}` };
    survey = {
      n,
      note: survey ? { ko: survey.note.ko + extra.ko, ja: survey.note.ja + extra.ja } : { ko: `사이트 제보 ${votes.length}`, ja: `サイト投稿 ${votes.length}` },
    };
    counted.traits = votes.length;
  }

  // 상황별 가이드: 기존 카드에 체크리스트 추가 (팁은 체크리스트 마지막 항목으로) / 새 상황 카드
  const newScenes = new Map(); // 제목 → 카드
  for (const c of contribs.filter((x) => x.kind === 'scene')) {
    const items = (c.data.items || []).map((t) => ({ ...same(t), contrib: mark(c) }));
    if (!items.length) continue;
    counted.scene += 1;
    const target = c.data.scene !== NEW_SCENE ? scenes.find((s) => s.tab === c.data.scene) : null;
    if (target) {
      target.items.push(...items);
      if (c.data.tip) target.items.push({ ...same(c.data.tip), contrib: mark(c) });
      continue;
    }
    const title = (c.data.title || '').trim() || '기타 상황';
    const key = title.replace(/\s+/g, '').toLowerCase();
    if (!newScenes.has(key)) {
      const n = scenes.length + newScenes.size + 1;
      const tab = `${String(n).padStart(2, '0')}_senpai`;
      newScenes.set(key, { file: `scenes/${tab}.md`, tab, title: same(title), tip: L('', ''), items: [], contrib: mark(c) });
    }
    const card = newScenes.get(key);
    card.items.push(...items);
    // 첫 제보의 팁은 카드의 "선배 tip" 칸에, 같은 상황의 다음 제보 팁은 체크리스트 항목으로
    if (c.data.tip && !card.tip.ko) card.tip = same(c.data.tip);
    else if (c.data.tip) card.items.push({ ...same(c.data.tip), contrib: mark(c) });
  }
  scenes.push(...newScenes.values());

  // 주의사항 · 스몰토크 · 말버릇: 항목 하나씩
  for (const c of contribs) {
    const d = c.data;
    if (c.kind === 'warning' && d.title && d.msg) {
      const n = warnings.length + 1;
      warnings.push({ level: d.level || 'warning', id: `${LEVEL_PREFIX[d.level] || 'W'}${String(n).padStart(2, '0')}`, title: same(d.title), msg: same(d.msg), contrib: mark(c) });
      counted.warning += 1;
    } else if (c.kind === 'talk' && d.title && d.body) {
      talk.push({ key: `senpai_${c.id}`, title: same(d.title), body: same(d.body), contrib: mark(c) });
      counted.talk += 1;
    } else if (c.kind === 'dict' && d.term) {
      dict.push({
        term: d.term,
        tag: d.tag || '추정',
        ko: d.meaning || NO_MEANING.ko,
        ja: d.meaning || NO_MEANING.ja,
        tip: d.tip ? same(d.tip) : L('', ''),
        contrib: mark(c),
      });
      counted.dict += 1;
    }
  }

  return {
    id: p.id,
    name: L(p.name_ko, p.name_ja),
    short: L(p.short_ko, p.short_ja),
    badges: profile.badges ?? null,
    synopsis: profile.synopsis ?? [],
    code: profile.code ?? [],
    status: p.status_mood_ko ? { mood: L(p.status_mood_ko, p.status_mood_ja), reason: L(p.status_reason_ko, p.status_reason_ja), votes: p.status_votes } : null,
    survey,
    traits,
    traitsLead: p.traits_lead_ko ? L(p.traits_lead_ko, p.traits_lead_ja) : null,
    traitsSub: p.traits_sub_ko ? L(p.traits_sub_ko, p.traits_sub_ja) : null,
    scenes,
    warnings,
    talk,
    dictDesc: p.dict_desc_ko ? L(p.dict_desc_ko, p.dict_desc_ja) : null,
    dict,
    dictPreview,
    contribCount: counted,
  };
}
