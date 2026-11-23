/* ==========================================================================
   키워드 검색 (API 키 · 외부 서비스 없음)
   - 한국어 · 일본어는 띄어쓰기 · 조사가 제각각이라 "글자 2개씩(bigram)"으로 쪼개서 비교
     예) "면담할 때" → 면담 · 담할 · 때  /  "면담은" → 면담
   - 점수: BM25 (검색 엔진에서 흔히 쓰는 방식 — 드문 단어가 겹칠수록, 짧은 자료일수록 높음)
   - 질문 단어와 뜻이 비슷한 말(SYNONYMS)도 조금 낮은 가중치로 함께 찾음
   - 자료(chunk)마다 한국어 · 일본어 문서를 따로 만들고 둘 중 높은 점수를 씀
   ========================================================================== */

// 끝에 붙은 조사 · 어미 (긴 것부터) — 단어가 3글자 이상일 때 하나만 떼어 냄
const PARTICLES = ['에서는', '에게는', '한테는', '이에요', '인가요', '에서', '으로', '에게', '한테', '까지', '부터', '이랑', '처럼', '보다', '이나', '이야', '이냐', '예요', '인가', '엔',
  '은', '는', '이', '가', '을', '를', '에', '도', '의', '로', '와', '과', '랑', '만', '요', '야', '냐', '니'];

// 질문에서 흔하지만 내용과 상관없는 말 — 질문 쪽에서만 뺌
const STOP_WORDS = new Set([
  '교수님', '교수', '선생님', '어떻게', '어떤', '어떡해', '뭐', '뭘', '뭐야', '뭐예요', '무엇', '무슨', '어디', '언제', '왜',
  '해야', '하나요', '해야하나요', '해야해', '하면', '하면돼', '되나요', '돼요', '할까', '할까요', '있나요', '있어', '있어요',
  '알려줘', '알려', '주세요', '좋을까', '좋을까요', '좋아요', '인가요', '이에요', '예요', '그냥', '좀', '제가', '저는', '나',
  '해도', '돼', '되나', '건가요', '하는', '해요', '하죠', '때', '수', '것', '거', '게', '말이', '말', '혹시', '진짜', '정말', '많이', '엄청', '자주',
  '은', '는', '이', '가', '을', '를', '에', '도', '의', '로', '와', '과', '랑', '만', '요', '야',
  '教授', '先生', 'どう', 'どうすれば', 'なに', '何', 'ですか', 'ますか', 'いい', 'について', '教えて',
]);

// 비슷한 말 — 질문에 왼쪽 말이 있으면 오른쪽 말들도 함께 찾음 (가중치 SYN_WEIGHT)
const SYNONYMS = {
  면담: ['상담', '찾아', '연구실', '미팅', '방문'],
  상담: ['면담', '연구실'],
  과제: ['레포트', '리포트', '숙제', '제출', '피드백'],
  숙제: ['과제', '제출'],
  레포트: ['과제', '리포트'],
  피드백: ['과제', '코멘트', '첨삭', '지적'],
  발표: ['프레젠테이션', '피티', 'ppt'],
  무서: ['엄격', '화', '혼', '주의'],
  무섭: ['엄격', '화', '혼', '주의'],
  화나: ['화', '혼', '주의', '금지', '싫어'],
  싫어: ['금지', '주의', '경고', '조심'],
  조심: ['주의', '금지', '경고'],
  주의: ['조심', '금지', '경고'],
  하면안: ['금지', '주의', '경고'],
  취미: ['좋아', '관심', '스몰토크', '대화'],
  좋아: ['취미', '관심'],
  대화: ['스몰토크', '이야기', '주제', '화제'],
  잡담: ['스몰토크', '대화', '이야기'],
  스몰토크: ['대화', '주제', '이야기'],
  이야기: ['대화', '스몰토크', '주제'],
  얘기: ['이야기', '대화', '스몰토크'],
  사투리: ['말버릇', '말투', '표현', '뜻'],
  말투: ['말버릇', '사투리', '표현'],
  말버릇: ['사투리', '말투', '표현'],
  뜻: ['의미', '말버릇', '사투리'],
  성격: ['성향', '스타일', '분위기'],
  성향: ['성격', '스타일'],
  스타일: ['성격', '성향'],
  메일: ['이메일', '연락', '카톡', '메시지'],
  연락: ['메일', '카톡', '메시지'],
  카톡: ['메일', '연락', '메시지'],
  지각: ['늦', '시간', '예의', '매너', '출석'],
  늦: ['마감', '기한', '지각', '예의'],
  마감: ['기한', '제출'],
  출석: ['지각', '결석'],
  혼나: ['화', '실망', '주의', '금지', '경고'],
  엄격: ['철저', '엄하', '마감', '예의', '이미지'],
  엄하: ['엄격', '철저'],
  질문: ['물어', '여쭤'],
  물어보: ['질문'],
  갑자기: ['예상', '돌발'],
  모르: ['몰라', '모르면', '인정'],
  수업: ['강의'],
  끝: ['마무리', '정리', '끝내'],
  마무리: ['끝내', '정리'],
  부탁: ['심부름', '스스로'],
  시험: ['평가', '성적'],
  성적: ['시험', '평가', '학점'],
  가수: ['음악', '노래', 'pop', '클래식', 'bgm'],
  음악: ['노래', 'pop', '클래식', 'bgm', '가수'],
  노래: ['음악', 'pop', '가수'],
  밥: ['음식', '식사', '먹'],
  음식: ['식사', '먹', '밥'],
  먹: ['음식', '식사'],
  옷: ['패션', '입', '색'],
  패션: ['옷', '입'],
  바쁘: ['일', '코딩', '작업'],
  워커홀릭: ['일', '코딩', '작업'],
  영어: ['english', 'what', 'wrong'],
  // 日本語
  面談: ['相談', '研究室'],
  課題: ['レポート', '宿題', '提出'],
  方言: ['口癖', '表現', '意味'],
  口癖: ['方言', '表現'],
  性格: ['タイプ', '雰囲気'],
  雑談: ['話題', '会話'],
  注意: ['禁止', '気をつけ'],
  音楽: ['pop', 'bgm', 'クラシック', '歌'],
  歌手: ['pop', '音楽'],
  食べ: ['食事', 'ご飯'],
};
// 1글자 키(밥 · 먹 · 옷 · 늦 · 끝)는 단어 안에 들어 있기만 해도 걸리면 너무 넓어서 — 단어의 첫 글자일 때만
const synonymHit = (w, key) => (key.length === 1 ? w.startsWith(key) : w.includes(key));
const SYN_WEIGHT = 0.5;

// BM25 기본값
const K1 = 1.2;
const B = 0.75;
const UNSEEN_WEIGHT = 0.5;

const CJK = /[぀-ヿ㐀-鿿가-힯]/;

// 높임 어미 — "하셔", "다니셔", "좋아하세요" → 하 · 다니 · 좋아하
const HONORIFIC = ['으세요', '으셔', '세요', '셔'];
// 2글자 단어에서도 떼는 조사 ("옷은" → 옷)
const SHORT_PARTICLES = ['은', '는', '을', '를', '도', '에'];

function stripParticle(word) {
  if (!/[가-힯]$/.test(word)) return word;
  if (word.length === 2) return SHORT_PARTICLES.includes(word[1]) ? word[0] : word;
  for (const p of HONORIFIC) {
    if (word.endsWith(p) && word.length - p.length >= 1) return word.slice(0, -p.length);
  }
  for (const p of PARTICLES) {
    if (word.endsWith(p) && word.length - p.length >= 2) return word.slice(0, -p.length);
  }
  return word;
}

/** 문장 → 단어 목록 (소문자, 기호 제거, 조사 떼기) */
export function words(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean)
    .map(stripParticle);
}

/** 단어 → 검색 단위(token): 한글 · 일본어는 2글자씩, 1글자 단어는 그대로, 영어 · 숫자는 단어 그대로 */
function tokensOfWord(w) {
  if (!CJK.test(w)) return w.length > 1 ? [w] : [];
  if (w.length === 1) return [w];
  const out = [];
  for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
  return out;
}

// 한글 1글자 단위(앞에 '·' 표시) — "먹어"와 "먹은", "입고"와 "입어"처럼 끝만 바뀌는 말을 약하게 이어 줌
const unigramsOfWord = (w) => (/[가-힯]/.test(w) && w.length > 1 ? [...w].map((ch) => `·${ch}`) : []);
const UNI_WEIGHT = 0.3;

export function tokenize(text) {
  return words(text).flatMap((w) => [...tokensOfWord(w), ...unigramsOfWord(w)]);
}

/** 질문 → { token → 가중치 } (불용어 제거 + 비슷한 말 추가). 가중치 1 = 질문에 직접 나온 말 */
export function queryTokens(question) {
  const weights = new Map();
  const put = (t, w) => { if (w > (weights.get(t) ?? 0)) weights.set(t, w); };
  const ws = words(question).filter((w) => !STOP_WORDS.has(w));
  for (const w of ws) {
    for (const t of tokensOfWord(w)) put(t, 1);
    for (const t of unigramsOfWord(w)) put(t, UNI_WEIGHT);
    for (const [key, alts] of Object.entries(SYNONYMS)) {
      if (!synonymHit(w, key)) continue;
      for (const alt of alts) for (const t of [...tokensOfWord(alt), ...unigramsOfWord(alt)]) put(t, SYN_WEIGHT);
    }
  }
  return weights;
}

/**
 * 자료 목록 → 검색 색인
 * docs: [{ id, texts: [한국어 문장, 일본어 문장] }]
 */
export function buildIndex(docs) {
  // 언어별 문서 하나씩 = "필드"
  const fields = [];
  docs.forEach((d, di) => {
    for (const text of d.texts) {
      if (!text) continue;
      const tf = new Map();
      const toks = tokenize(text);
      for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
      fields.push({ doc: di, tf, len: toks.length });
    }
  });
  const N = fields.length || 1;
  const avgLen = fields.reduce((s, f) => s + f.len, 0) / N || 1;
  const df = new Map();
  for (const f of fields) for (const t of f.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t) => Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));

  /** 질문 → [{ doc, score(0~1) }] 높은 순 */
  function search(question, k = 5) {
    const q = queryTokens(question);
    if (!q.size) return [];
    // 점수를 0~1로 맞추기 위한 기준: 질문에 직접 나온 말(2글자 단위)이 모두 충분히 나왔을 때의 점수.
    // 자료에 한 번도 안 나오는 말("토익", "기숙사")도 기준에 넣음 → 모르는 주제일수록 점수가 낮아져 "자료 없음"으로
    // (처음 보는 말은 절반만 — 말투 · 어미 차이까지 크게 깎이지 않게)
    let ideal = 0;
    for (const [t, w] of q) if (w === 1) ideal += idf(t) * (K1 + 1) * (df.has(t) ? 1 : UNSEEN_WEIGHT);
    if (ideal === 0) return [];
    const best = new Map();
    for (const f of fields) {
      let s = 0;
      let strong = false; // 1글자 단위만 겹친 자료("생일" ↔ "일본어 · 학생")는 결과로 치지 않음
      for (const [t, w] of q) {
        const n = f.tf.get(t);
        if (!n) continue;
        if (!t.startsWith('·')) strong = true;
        s += w * idf(t) * (n * (K1 + 1)) / (n + K1 * (1 - B + B * f.len / avgLen));
      }
      if (strong && s > (best.get(f.doc) ?? 0)) best.set(f.doc, s);
    }
    // 순서는 원래 점수로 (0~1로 자르면 1등이 여러 개가 됨), 보여 줄 점수만 0~1
    return [...best.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([doc, s]) => ({ doc: docs[doc], score: Math.min(1, s / ideal) }));
  }

  return { search, size: docs.length };
}

export const SEARCH_MODEL = 'keyword-bm25';
