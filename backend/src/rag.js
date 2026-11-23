/* ==========================================================================
   RAG: 질문 임베딩 → 교수님별 청크에서 코사인 유사도 상위 k개 → 답변 생성
   - 데이터가 작아서(수십~수백 개) 벡터 DB 없이 메모리에서 계산합니다.
   - 답변 모델을 쓸 수 없으면(권한 없음 등) 찾은 자료를 그대로 보여 주는 "검색 모드"로 동작합니다.
   ========================================================================== */
import { embed } from './openai.js';
import { chat, ChatUnavailableError, CHAT_MODEL } from './claude.js';

// 검색 모드로 바뀐 이유별 안내 문구
const NOTICE = {
  no_api_key: { ko: 'AI 답변용 Claude API 키가 아직 설정되지 않아, 관련 자료를 그대로 보여 드려요.', ja: 'AI回答用のClaude APIキーが未設定のため、関連する資料をそのまま表示しています。' },
  auth: { ko: 'AI 답변용 Claude API 키가 올바르지 않아, 관련 자료를 그대로 보여 드려요.', ja: 'Claude APIキーが正しくないため、関連する資料をそのまま表示しています。' },
  rate_limited: { ko: '지금 질문이 몰려 AI 답변 대신 관련 자료를 보여 드려요. 잠시 후 다시 물어봐 주세요.', ja: '混み合っているため、関連する資料を表示しています。少し後でもう一度どうぞ。' },
  default: { ko: 'AI 답변을 만들지 못해, 관련 자료를 보여 드려요.', ja: 'AI回答を作成できなかったため、関連する資料を表示しています。' },
};

const TOP_K = 5;
const WEIGHT = {};
// 이보다 낮으면 "관련 자료 없음" (text-embedding-3-small 기준: 관련 질문 ≈ 0.34~0.55, 무관한 질문 ≈ 0.16~0.40)
// 겹치는 구간은 답변 모델이 프롬프트 규칙에 따라 "자료 없음"으로 처리
const MIN_SCORE = 0.3;
const SOURCE_LABEL = {
  profile: { ko: '프로필', ja: 'プロフィール' },
  traits: { ko: '성향 분석', ja: '性格分析' },
  scene: { ko: '상황별 가이드', ja: '場面別ガイド' },
  warning: { ko: '주의사항', ja: '注意事項' },
  talk: { ko: '스몰토크', ja: '雑談ネタ' },
  dict: { ko: '말버릇 사전', ja: '口癖辞典' },
};
// 게시된 선배 제보(contribIndex.js)는 source_type 이 섹션 종류와 같고 source_ref 가 'contrib:<id>'

export function createRag(db) {
  // 교수님별 청크 캐시 (seed 후 서버 재시작하면 갱신, 제보 게시/취소 시 invalidate 로 갱신)
  const cache = new Map();
  const invalidate = (profId) => cache.delete(profId);
  function chunksOf(profId) {
    if (!cache.has(profId)) {
      const rows = db.prepare('SELECT * FROM chunks WHERE prof_id = ? AND embedding IS NOT NULL').all(profId);
      const f32 = (b) => (b ? new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) : null);
      cache.set(profId, rows.map((r) => ({ ...r, vecs: [f32(r.embedding), f32(r.embedding_ja)].filter(Boolean) })));
    }
    return cache.get(profId);
  }

  const profStmt = db.prepare('SELECT id, name_ko, name_ja FROM professors WHERE id = ?');
  const logStmt = db.prepare('INSERT INTO chat_logs (prof_id, lang, question, answer, mode, top_score) VALUES (?,?,?,?,?,?)');

  async function retrieve(profId, question) {
    const [q] = await embed([question]);
    return chunksOf(profId)
      .map((c) => {
        // 정규화 벡터 → 내적 = 코사인. 한국어/일본어 벡터 중 높은 쪽
        let best = -1;
        for (const v of c.vecs) {
          let dot = 0;
          for (let i = 0; i < q.length; i++) dot += q[i] * v[i];
          if (dot > best) best = dot;
        }
        // 한마디는 "교수님" 같은 일반적인 말이 많아 아무 질문에나 걸리기 쉬움 → 살짝 낮춤
        return { chunk: c, score: best * (WEIGHT[c.source_type] ?? 1) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);
  }

  function systemPrompt(name, lang, context) {
    const langName = lang === 'ja' ? '日本語' : '한국어';
    return [
      `너는 영진전문대 글로벌시스템융합과(GSC) 학생들이 만든 "GSC 교수님 사용 설명서" 사이트의 안내 챗봇이다.`,
      `지금 선택된 교수님은 "${name}"이다. 학생이 이 교수님과의 수업·과제 피드백·면담·대화를 잘 준비하도록 돕는다.`,
      ``,
      `규칙:`,
      `1. 아래 [자료]에 있는 내용만 근거로 답한다. 자료는 선배들의 익명 설문을 정리한 것이다.`,
      `   "선배 제보"라고 표시된 자료는 한 선배의 개인 경험이므로 "한 선배는 ~했대요"처럼 전하고, 모두에게 해당하는 사실처럼 단정하지 않는다.`,
      `2. 자료에 없는 사실(일정, 연락처, 성적 기준, 개인 신상 등)은 지어내지 말고 "아직 자료가 없다"고 말한 뒤, 사이트의 제보하기로 경험을 남겨 달라고 안내한다.`,
      `3. 교수님 본인인 척 말하지 않는다. 교수님을 비하하거나 놀리는 답은 하지 않는다.`,
      `4. 반드시 ${langName}로 답한다. 사투리/말버릇 표현은 원문(한국어) 그대로 인용해도 된다.`,
      `5. 휴대폰에서도 한눈에 읽히게 아래 형식을 지킨다.`,
      `   - 첫 줄: 핵심을 한 문장으로 (30자 안팎).`,
      `   - 그다음 "- " 목록 3~4개. 각 항목은 "**키워드** 짧은 설명" 한 문장, 40자 안팎. 한 항목에 문장을 두 개 이상 쓰지 않는다.`,
      `   - 근거로 쓴 자료 번호를 항목 끝에 [1]처럼 붙인다.`,
      `   - 자료에 없는 내용을 안내할 때만 마지막에 한 줄 덧붙인다.`,
      `   - 굵게(**)와 "- " 목록 외의 마크다운(제목 #, 표, 인용 >, 코드)은 쓰지 않는다.`,
      ``,
      `[자료]`,
      context || '(관련 자료 없음)',
    ].join('\n');
  }

  async function answer({ profId, lang = 'ko', question, history = [] }) {
    const prof = profStmt.get(profId);
    if (!prof) throw new Error('unknown professor');
    const name = lang === 'ja' ? prof.name_ja || prof.name_ko : prof.name_ko;

    const hits = await retrieve(profId, question);
    const useful = hits.filter((h) => h.score >= MIN_SCORE);
    const topScore = hits[0]?.score ?? 0;
    const sources = useful.map((h, i) => ({
      n: i + 1,
      type: h.chunk.source_type,
      section: SOURCE_LABEL[h.chunk.source_type]?.[lang] ?? h.chunk.source_type,
      title: lang === 'ja' ? h.chunk.title_ja || h.chunk.title_ko : h.chunk.title_ko,
      score: Math.round(h.score * 100) / 100,
    }));
    const content = (c) => (lang === 'ja' ? c.content_ja || c.content_ko : c.content_ko);
    const context = useful.map((h, i) => `[${i + 1}] (${sources[i].section}) ${content(h.chunk)}`).join('\n\n');

    let mode = 'generate';
    let text;
    let notice = null;
    try {
      // Claude: 시스템 프롬프트는 messages가 아니라 별도 system 필드. 대화는 user로 시작해야 함
      const past = history.slice(-6);
      while (past.length && past[0].role !== 'user') past.shift();
      text = await chat(systemPrompt(name, lang, context), [...past, { role: 'user', content: question }]);
    } catch (err) {
      // 답변 모델을 쓸 수 없음(키 없음·권한·한도 등) → 찾은 자료를 그대로 보여 주기
      if (!(err instanceof ChatUnavailableError)) throw err;
      console.warn(`[chat] ${CHAT_MODEL} 사용 불가 → 검색 모드 (${err.code}: ${err.message})`);
      mode = useful.length ? 'retrieval' : 'empty';
      notice = NOTICE[err.code]?.[lang] ?? NOTICE.default[lang];
      text = useful.length
        ? useful.slice(0, 3).map((h, i) => `[${i + 1}] ${content(h.chunk)}`).join('\n\n')
        : (lang === 'ja'
          ? `${name}について、その質問に関係する資料はまだありません。経験があれば「投稿する」から教えてください！`
          : `${name}에 대해 그 질문과 관련된 자료가 아직 없어요. 겪어 본 경험이 있다면 '제보하기'로 알려 주세요!`);
    }

    logStmt.run(profId, lang, question, text, mode, topScore);
    return { answer: text, sources: mode === 'empty' ? [] : sources, mode, notice };
  }

  return { answer, retrieve, invalidate };
}
