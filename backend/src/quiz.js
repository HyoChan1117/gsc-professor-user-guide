/* ==========================================================================
   퀴즈 — POST /api/quiz  { profId, lang, exclude?: string[] }
   - 매번 DB 자료(chunks)를 무작위로 골라 Claude가 4지선다 문제를 새로 만듦 (구조화 출력)
   - 정답 위치는 서버에서 다시 섞음 (모델이 특정 번호에 정답을 몰아 두는 경향 방지)
   - Claude를 쓸 수 없으면 DB 표(사전 · 성향 · 상황별 가이드)로 기본 문제를 만들어 줌
   ========================================================================== */
import { generateJson, ChatUnavailableError, CHAT_MODEL } from './claude.js';

const COUNT = 5;          // 한 번에 내는 문제 수
const MATERIAL = 8;       // 한 번에 보여 줄 자료 묶음 수 (무작위)
const MAX_EXCLUDE = 30;   // 최근에 낸 문제 (겹치지 않게)

const SECTION = {
  profile: { ko: '프로필', ja: 'プロフィール' },
  traits: { ko: '성향 분석', ja: '性格分析' },
  scene: { ko: '상황별 가이드', ja: '場面別ガイド' },
  warning: { ko: '주의사항', ja: '注意事項' },
  talk: { ko: '스몰토크', ja: '雑談ネタ' },
  dict: { ko: '말버릇 사전', ja: '口癖辞典' },
};

// 매번 다른 방향을 주기 위한 출제 관점 (2개씩 무작위)
const ANGLES = [
  '이런 상황에서는 어떻게 하면 좋을까? 같은 상황 판단형',
  '말버릇·사투리 표현의 뜻을 맞히는 문제',
  '선배들의 설문 결과(비율·순위)를 묻는 문제',
  '하면 안 되는 행동을 고르는 문제 ("알맞지 않은 것은?")',
  '스몰토크 소재·좋아하시는 것을 묻는 문제',
  '면담·과제 피드백 준비 방법을 묻는 문제',
  'O/X 느낌의 "다음 중 사실인 것은?" 문제',
];

const SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: '문제 문장' },
          choices: { type: 'array', items: { type: 'string' }, description: '보기 정확히 4개' },
          answer: { type: 'integer', description: '정답 보기의 번호 (0~3)' },
          explanation: { type: 'string', description: '정답 해설 1~2문장, 자료 근거' },
          source: { type: 'integer', description: '근거로 쓴 자료 번호 ([n])' },
        },
        required: ['question', 'choices', 'answer', 'explanation', 'source'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sample = (arr, n) => shuffle(arr).slice(0, n);
const clean = (s, max) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

/** 보기를 섞고 정답 번호를 다시 계산 */
function reshuffle(q) {
  const order = shuffle([0, 1, 2, 3]);
  return { ...q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer) };
}

/** 모델이 낸 문제 검사 — 형식이 맞지 않는 문제는 버림 */
function validQuestion(q) {
  if (!q || typeof q.question !== 'string' || !q.question.trim()) return false;
  if (!Array.isArray(q.choices) || q.choices.length !== 4) return false;
  const choices = q.choices.map((c) => (typeof c === 'string' ? c.trim() : ''));
  if (choices.some((c) => !c) || new Set(choices).size !== 4) return false;
  return Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3;
}

export function createQuiz(db) {
  const profStmt = db.prepare('SELECT id, name_ko, name_ja FROM professors WHERE id = ?');
  const chunkStmt = db.prepare('SELECT source_type, title_ko, title_ja, content_ko, content_ja FROM chunks WHERE prof_id = ?');

  function systemPrompt(name, lang) {
    const langName = lang === 'ja' ? '日本語' : '한국어';
    return [
      `너는 영진전문대 글로벌시스템융합과(GSC) 학생들이 만든 "GSC 교수님 사용 설명서" 사이트의 퀴즈 출제자다.`,
      `후배들이 "${name}"과(와)의 수업·면담·대화를 재미있게 미리 익히도록 4지선다 퀴즈를 낸다.`,
      ``,
      `규칙:`,
      `1. [자료]에 있는 내용만으로 문제와 정답을 만든다. 자료에 없는 사실은 정답으로도 해설로도 쓰지 않는다.`,
      `2. 오답 보기는 그럴듯하지만 자료와 맞지 않거나 자료에 근거가 없는 것으로 만든다. 정답이 둘이 되지 않게 한다.`,
      `3. 교수님을 비하하거나 놀리는 문제, 개인 신상(나이·가족·연락처 등)을 묻는 문제는 내지 않는다.`,
      `4. 문제·보기·해설은 모두 ${langName}로 쓴다. 단, 말버릇·사투리 표현은 원문(한국어) 그대로 인용한다.`,
      `5. 문제는 한두 문장, 보기는 각각 짧게(25자 안팎), 해설은 1~2문장.`,
      `6. 문제마다 다른 자료·다른 유형을 쓰고, [최근에 낸 문제]와 같거나 거의 같은 문제는 내지 않는다.`,
      `7. 정확히 ${COUNT}문제. 보기는 정확히 4개, answer는 정답 보기의 번호(0~3), source는 근거 자료 번호.`,
    ].join('\n');
  }

  function userPrompt(materials, lang, exclude) {
    const text = (c) => (lang === 'ja' ? c.content_ja || c.content_ko : c.content_ko);
    const angles = sample(ANGLES, 2);
    return [
      `[자료]`,
      materials.map((c, i) => `[${i + 1}] (${SECTION[c.source_type]?.ko ?? c.source_type}) ${text(c)}`).join('\n\n'),
      ``,
      `[이번 출제 방향] 아래 관점을 1문제 이상씩 섞어 주세요: ${angles.join(' / ')}`,
      ``,
      `[최근에 낸 문제]`,
      exclude.length ? exclude.map((q) => `- ${q}`).join('\n') : '(없음)',
    ].join('\n');
  }

  /* ---- Claude를 쓸 수 없을 때: DB 표로 기본 문제 ---- */
  async function basicQuestions(profId, lang) {
    const L = (row, key) => (lang === 'ja' ? row[`${key}_ja`] || row[`${key}_ko`] : row[`${key}_ko`]);
    const pool = [];

    const dict = await db.prepare("SELECT term, meaning_ko, meaning_ja, tip_ko, tip_ja FROM dict_entries WHERE prof_id = ? AND tag != '추정'").all(profId); // 뜻이 확실한 것만
    if (dict.length >= 4) {
      for (const d of dict) {
        const others = sample(dict.filter((x) => x.term !== d.term && L(x, 'meaning') !== L(d, 'meaning')), 3);
        if (others.length < 3) continue;
        pool.push({
          question: lang === 'ja' ? `「${d.term}」はどういう意味？` : `‘${d.term}’은(는) 무슨 뜻일까요?`,
          choices: [L(d, 'meaning'), ...others.map((x) => L(x, 'meaning'))],
          answer: 0,
          explanation: L(d, 'tip') || '',
          section: SECTION.dict[lang],
        });
      }
    }

    const traits = await db.prepare('SELECT label_ko, label_ja, pct FROM traits WHERE prof_id = ? ORDER BY pct DESC').all(profId);
    if (traits.length >= 4) {
      const top = traits[0];
      pool.push({
        question: lang === 'ja' ? '先輩アンケートで一番多く選ばれた性格は？' : '선배 설문에서 가장 많이 꼽힌 성향은?',
        choices: [L(top, 'label'), ...sample(traits.slice(1), 3).map((x) => L(x, 'label'))],
        answer: 0,
        explanation: lang === 'ja' ? `回答者の${top.pct}%が選びました。` : `응답자의 ${top.pct}%가 골랐어요.`,
        section: SECTION.traits[lang],
      });
    }

    const scenes = await db.prepare('SELECT id, title_ko, title_ja FROM scenes WHERE prof_id = ?').all(profId);
    const items = await db.prepare('SELECT scene_id, text_ko, text_ja FROM scene_items WHERE scene_id IN (SELECT id FROM scenes WHERE prof_id = ?)').all(profId);
    for (const s of scenes) {
      const mine = items.filter((i) => i.scene_id === s.id);
      const others = sample(items.filter((i) => i.scene_id !== s.id), 3);
      if (!mine.length || others.length < 3) continue;
      const pick = sample(mine, 1)[0];
      pool.push({
        question: lang === 'ja' ? `「${L(s, 'title')}」のチェックリストにある項目は？` : `‘${L(s, 'title')}’ 체크리스트에 있는 항목은?`,
        choices: [L(pick, 'text'), ...others.map((x) => L(x, 'text'))],
        answer: 0,
        explanation: lang === 'ja' ? `「${L(s, 'title')}」の準備項目です。` : `‘${L(s, 'title')}’ 준비 항목이에요.`,
        section: SECTION.scene[lang],
      });
    }

    return sample(pool, COUNT).filter(validQuestion).map(reshuffle);
  }

  async function make({ profId, lang = 'ko', exclude = [] }) {
    const prof = await profStmt.get(profId);
    if (!prof) throw new Error('unknown professor');
    const name = lang === 'ja' ? prof.name_ja || prof.name_ko : prof.name_ko;
    const chunks = await chunkStmt.all(profId);
    if (chunks.length === 0) return { mode: 'empty', questions: [] };

    // 자료 종류가 고루 섞이도록: 종류별로 하나씩 먼저 뽑고 나머지는 무작위
    const byType = {};
    for (const c of shuffle(chunks)) (byType[c.source_type] ||= []).push(c);
    const firsts = Object.values(byType).map((list) => list[0]);
    const rest = shuffle(chunks.filter((c) => !firsts.includes(c)));
    const materials = shuffle([...firsts, ...rest].slice(0, MATERIAL));

    try {
      const out = await generateJson(systemPrompt(name, lang), userPrompt(materials, lang, exclude), SCHEMA);
      const questions = (out.questions || [])
        .filter(validQuestion)
        .slice(0, COUNT)
        .map((q) => reshuffle({
          question: clean(q.question, 300),
          choices: q.choices.map((c) => clean(c, 120)),
          answer: q.answer,
          explanation: clean(q.explanation, 400),
          section: SECTION[materials[q.source - 1]?.source_type]?.[lang] ?? null,
        }));
      if (questions.length) return { mode: 'ai', questions };
      throw new ChatUnavailableError('api_error', '쓸 수 있는 문제가 없음');
    } catch (err) {
      if (!(err instanceof ChatUnavailableError)) throw err;
      console.warn(`[quiz] ${CHAT_MODEL} 사용 불가 → 기본 문제 (${err.code}: ${err.message})`);
      const questions = await basicQuestions(profId, lang);
      return { mode: questions.length ? 'basic' : 'empty', questions };
    }
  }

  return { make, MAX_EXCLUDE };
}
