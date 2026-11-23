/* ==========================================================================
   섹션별 제보 — 홈 섹션의 항목 모양 그대로 받습니다
     traits  01 성향 분석   → 성향 막대에 투표 (DB의 성향 항목 + 기본 항목)
     scene   02 상황별 가이드 → 기존 상황 카드에 체크리스트 추가, 또는 새 상황 카드
     warning 사용 시 주의사항 → level · title · msg
     talk    03 스몰토크     → title · body
     dict    04 말버릇 사전  → term · tag · meaning · tip
     other   기타 · 사이트 의견 (관리자만 봄)
   모두 contributions 테이블 한 곳에 저장. 항목 키는 frontend/src/data/contrib.js 와 같아야 합니다.
   게시(published)된 제보는 view.js 가 홈 · 섹션 데이터에 합쳐서 내려 줍니다.

   POST /api/contrib            { kind, profId, lang, grade, ...항목 }   (IP당 1분 5번)
   GET  /api/contrib/:id/options  제보 폼 선택지 (성향 항목 · 상황 카드 목록)

   흐름: 제보 → AI 정리(organize.js, 원문은 original 에 보관) → status 'new'(검수 대기)
        → 관리자가 확인 · 필요하면 수정 → 'published'(게시) 일 때만 사이트 · 챗봇에 반영
   ========================================================================== */

export const GRADES = ['1', '2', '3', 'alumni'];

// 교수님 DB에 성향 항목이 없을 때(설문 수집 전) 쓰는 기본 성향 — label_ko 가 투표 값
export const DEFAULT_TRAITS = [
  { ko: '열정파 · 가르치는 걸 좋아하심', ja: '情熱派・教えるのが好き' },
  { ko: '논리적 · 본질 중시 (‘왜?’를 깊게 파고드심)', ja: '論理的・本質重視（「なぜ？」を深く掘り下げる）' },
  { ko: '마감 · 예의에 철저하심', ja: '締め切り・礼儀に厳しい' },
  { ko: '츤데레 (처음엔 엄격하지만 상담하면 다정하심)', ja: 'ツンデレ（最初は厳しいけど相談すると優しい）' },
  { ko: '수다쟁이 (취미 이야기가 나오면 멈추지 않음)', ja: 'おしゃべり（趣味の話になると止まらない）' },
  { ko: '의외로 단 것 · 귀여운 걸 좋아하심', ja: '意外と甘いもの・かわいいものが好き' },
  { ko: '유머 감각 · 독특한 비유', ja: 'ユーモア・独特なたとえ話' },
];
export const NEW_SCENE = '__new';
export const DICT_TAGS = ['사투리', '말버릇', '외래어', '추정'];
export const LEVELS = ['warning', 'hint', 'error', 'note'];

/* 항목 정의: text(max) · choice(options) · multi(최대 개수, 값은 문자열) · lines(줄마다 항목, 최대 줄 수)
   required: 필수 / requiredIf: 다른 항목 값에 따라 필수 */
export const KINDS = {
  traits: {
    traits: { type: 'multi', max: 10, itemMax: 100, required: true },
    one_word: { type: 'text', max: 100 },
  },
  scene: {
    scene: { type: 'text', max: 60, required: true },            // 기존 상황 카드의 tab, 또는 '__new'
    title: { type: 'text', max: 60, requiredIf: (d) => d.scene === NEW_SCENE },
    items: { type: 'lines', max: 5, itemMax: 150, required: true },
    tip: { type: 'text', max: 200 },
  },
  warning: {
    level: { type: 'choice', options: LEVELS, required: true },
    title: { type: 'text', max: 60, required: true },
    msg: { type: 'text', max: 400, required: true },
  },
  talk: {
    title: { type: 'text', max: 60, required: true },
    body: { type: 'text', max: 500, required: true },
  },
  dict: {
    term: { type: 'text', max: 60, required: true },
    tag: { type: 'choice', options: DICT_TAGS, required: true },
    meaning: { type: 'text', max: 200 },
    tip: { type: 'text', max: 300 },
  },
  other: {
    feedback: { type: 'text', max: 1000 },
    advice: { type: 'text', max: 1000 },
  },
};
// 사이트에 게시할 수 있는 종류 (기타 = 사이트 의견·조언은 관리자만 봄)
export const PUBLIC_KINDS = ['traits', 'scene', 'warning', 'talk', 'dict'];

// 필수 항목이 없는 종류: 이 중 하나는 채워야 함
const ONE_OF = { other: ['feedback', 'advice'] };

// 이모지 + 이모지 조합용 보이지 않는 문자 (피부색 · 변형 선택자 · ZWJ · 키캡 · 국기 · 태그)
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

// 문자열 정리: 이모지 제거, 이모지가 빠져 생긴 연속 공백 정리, 앞뒤 공백 제거, 길이 제한, 빈 값은 null
export const cleanText = (v, max) => {
  if (typeof v !== 'string') return null;
  const s = v.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
  return s ? s.slice(0, max) : null;
};

/** 종류별 입력 검사 (모양 · 길이 · 이모지) → { data } 또는 { error, field } */
export function validate(kind, body) {
  const spec = KINDS[kind];
  const data = {};
  for (const [key, f] of Object.entries(spec)) {
    let v = null;
    if (f.type === 'text') v = cleanText(body[key], f.max);
    else if (f.type === 'choice') v = f.options.includes(body[key]) ? body[key] : null;
    else if (f.type === 'multi') {
      const arr = Array.isArray(body[key]) ? body[key].map((x) => cleanText(x, f.itemMax)).filter(Boolean) : [];
      v = arr.length ? [...new Set(arr)].slice(0, f.max) : null;
    } else if (f.type === 'lines') {
      // 배열 또는 줄바꿈 문자열 모두 받음 — 앞의 "- " · "• " 같은 목록 기호는 떼어 냄
      const raw = Array.isArray(body[key]) ? body[key] : typeof body[key] === 'string' ? body[key].split('\n') : [];
      const arr = raw.map((x) => cleanText(typeof x === 'string' ? x.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '') : x, f.itemMax)).filter(Boolean);
      v = arr.length ? arr.slice(0, f.max) : null;
    }
    if (v != null) data[key] = v;
  }
  for (const [key, f] of Object.entries(spec)) {
    const need = f.required || (f.requiredIf && f.requiredIf(data));
    if (need && data[key] == null) return { error: 'missing_field', field: key };
  }
  if (ONE_OF[kind] && !ONE_OF[kind].some((k) => data[k] != null)) return { error: 'missing_field', field: ONE_OF[kind][0] };
  return { data };
}

/** 교수님별 선택지 — 성향 투표 항목 · 상황 카드 */
export function optionsFor(db, profId) {
  const traits = db.prepare('SELECT label_ko, label_ja FROM traits WHERE prof_id = ? ORDER BY ord').all(profId)
    .map((r) => ({ ko: r.label_ko, ja: r.label_ja || r.label_ko }));
  const scenes = db.prepare('SELECT tab, title_ko, title_ja FROM scenes WHERE prof_id = ? ORDER BY ord').all(profId)
    .map((r) => ({ tab: r.tab, ko: r.title_ko, ja: r.title_ja || r.title_ko }));
  return { traits: traits.length ? traits : DEFAULT_TRAITS, scenes };
}

/** 그 교수님에게 실제로 있는 선택지인지 (성향 · 상황) */
function checkOptions(db, profId, kind, data) {
  const opt = optionsFor(db, profId);
  if (kind === 'traits') {
    const allowed = new Set([...opt.traits, ...DEFAULT_TRAITS].map((t) => t.ko));
    data.traits = data.traits.filter((x) => allowed.has(x));
    if (!data.traits.length) return { error: 'missing_field', field: 'traits' };
  }
  if (kind === 'scene') {
    if (data.scene !== NEW_SCENE && !opt.scenes.some((s) => s.tab === data.scene)) return { error: 'missing_field', field: 'scene' };
    if (data.scene !== NEW_SCENE) delete data.title;
  }
  return null;
}

/* ---- 예전 형식(섹션과 다른 항목)으로 저장된 제보 → 새 형식 ---- */
const OLD_TRAIT_KEYS = { logic: 1, passion: 0, strict: 2, tsundere: 3, chatty: 4, sweet: 5, humor: 6 };
const OLD_DICT_TAG = { dialect: '사투리', habit: '말버릇', loanword: '외래어', unknown: '추정' };
const OLD_SITUATION = {
  feedback: '과제 피드백', meeting: '지도교수 면담', class: '수업 중 질문', contact: '메일 · 메신저 연락', interview: '면접', other: '기타 상황',
};
export function upgradeData(kind, d, sceneTabs = []) {
  if (!d || typeof d !== 'object') return null;
  if (kind === 'talk' && 'topic' in d) return { title: d.topic, body: d.detail };
  if (kind === 'dict' && 'phrase' in d) {
    return { term: d.phrase, tag: OLD_DICT_TAG[d.tag] || (d.meaning ? '말버릇' : '추정'), meaning: d.meaning, tip: d.situation };
  }
  if (kind === 'traits' && Array.isArray(d.traits) && d.traits.some((k) => k in OLD_TRAIT_KEYS)) {
    return { traits: d.traits.map((k) => DEFAULT_TRAITS[OLD_TRAIT_KEYS[k]]?.ko).filter(Boolean), one_word: d.one_word };
  }
  if (kind === 'scene' && 'story' in d) {
    const tab = sceneTabs.find((t) => t.endsWith(`_${d.situation}`)); // 01_feedback · 02_meeting 같은 기존 카드
    return tab
      ? { scene: tab, items: [d.story], tip: d.tip }
      : { scene: NEW_SCENE, title: OLD_SITUATION[d.situation] || '기타 상황', items: [d.story], tip: d.tip };
  }
  if (kind === 'warning' && 'what' in d) {
    return { level: d.level || 'warning', title: d.what.slice(0, 60), msg: d.why || d.what };
  }
  return null; // 이미 새 형식
}

/** 서버 시작 시 — 예전 형식 제보를 새 형식으로 (data · original 둘 다). 바뀐 게시 제보 id 목록 반환 */
export function upgradeAll(db) {
  const rows = db.prepare('SELECT id, prof_id, kind, data, original, status FROM contributions').all();
  const tabsOf = (profId) => db.prepare('SELECT tab FROM scenes WHERE prof_id = ?').all(profId).map((r) => r.tab);
  const upd = db.prepare('UPDATE contributions SET data = ?, original = ? WHERE id = ?');
  const changed = [];
  for (const r of rows) {
    const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
    const tabs = r.kind === 'scene' ? tabsOf(r.prof_id) : [];
    const nd = upgradeData(r.kind, parse(r.data), tabs);
    const no = upgradeData(r.kind, parse(r.original), tabs);
    if (!nd && !no) continue;
    const fix = (v, fallback) => {
      if (!v) return fallback;
      const checked = validate(r.kind, v);
      return checked.error ? JSON.stringify(v) : JSON.stringify(checked.data);
    };
    upd.run(fix(nd, r.data), fix(no, r.original), r.id);
    if (r.status === 'published') changed.push(r.id);
  }
  if (rows.length && changed.length) console.log(`✓ 예전 형식 제보 ${changed.length}개를 섹션 형식으로 변환`);
  return changed;
}

/** organizer: 제보 AI 정리 (organize.js) — 저장 직후 백그라운드로 실행 */
export function mountContrib(app, db, makeRateLimit, organizer) {
  // data 와 original 에 같은 원문을 넣고, AI 정리가 끝나면 data 만 정리본으로 바뀜
  const insert = db.prepare(`INSERT INTO contributions (prof_id, kind, lang, grade, data, original, ai_status)
    VALUES (?,?,?,?,?,?,?)`);
  const profExists = db.prepare('SELECT id FROM professors WHERE id = ?');

  app.post('/api/contrib', makeRateLimit(5), (req, res) => {
    const b = req.body || {};
    // 봇 함정 칸(화면에 안 보임)이 채워져 있으면 저장하지 않고 성공처럼 응답
    if (b.website) return res.json({ ok: true });

    if (!KINDS[b.kind]) return res.status(400).json({ error: 'unknown_kind' });
    const prof = typeof b.profId === 'string' ? profExists.get(b.profId) : null;
    if (!prof) return res.status(400).json({ error: 'unknown_professor' });
    if (!GRADES.includes(b.grade)) return res.status(400).json({ error: 'missing_grade' });

    const result = validate(b.kind, b);
    if (result.error) return res.status(400).json(result);
    const bad = checkOptions(db, prof.id, b.kind, result.data);
    if (bad) return res.status(400).json(bad);

    const json = JSON.stringify(result.data);
    const info = insert.run(prof.id, b.kind, b.lang === 'ja' ? 'ja' : 'ko', b.grade, json, json, organizer ? 'pending' : null);
    const id = Number(info.lastInsertRowid);
    res.status(201).json({ ok: true, id });
    organizer?.kick(id); // 응답을 보낸 뒤 AI 정리 (제보자는 기다리지 않음)
  });

  app.get('/api/contrib/:id/options', (req, res) => {
    if (!profExists.get(req.params.id)) return res.status(404).json({ error: 'not_found' });
    res.json(optionsFor(db, req.params.id));
  });
}
