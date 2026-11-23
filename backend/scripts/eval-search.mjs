/* ==========================================================================
   키워드 검색 정확도 측정 — npm run eval
   - CASES: 질문 + 정답 자료(하나라도 맞으면 정답). 'talk:*' 처럼 섹션 전체도 가능
   - 정답이 [] 인 질문 = 자료에 없는 내용 → "관련 자료 없음"이 나와야 정답
   - 데이터나 search.js 를 고친 뒤 돌려서 숫자가 떨어지지 않았는지 확인
   ========================================================================== */
import { openDb } from '../src/db.js';
import { createRag } from '../src/rag.js';

const CASES = [
  // 상황별 가이드
  ['면담 갈 때 뭘 준비해야 돼?', ['scene:02_meeting']],
  ['지도교수님이랑 상담할 때 팁 있어?', ['scene:02_meeting']],
  ['휴학 상담하러 가도 될까', ['scene:02_meeting']],
  ['과제 피드백 받을 때 주의할 점', ['scene:01_feedback']],
  ['레포트 지적받으면 어떻게 해', ['scene:01_feedback']],
  ['갑자기 질문 받으면 어떻게 대답해?', ['scene:03_why', 'dict:이게 맞나? 그래서? 왜?']],
  ['모르는 걸 물어보시면 어떡해', ['scene:03_why']],
  ['왜냐고 계속 물어보시는데 뭐라고 해야 돼', ['scene:03_why', 'dict:이게 맞나? 그래서? 왜?']],
  // 성향
  ['교수님 성격 어때?', ['traits:traits']],
  ['어떤 스타일의 교수님이야?', ['traits:traits']],
  ['엄격하셔?', ['traits:traits', 'warning:E03', 'warning:N04']],
  ['무서운 분이야?', ['warning:N04', 'traits:traits']],
  // 주의사항
  ['화나시는 포인트가 뭐야', ['warning:E03', 'warning:W01']],
  ['복습 꼭 해야 돼?', ['warning:W01']],
  ['예습해 가면 좋아하셔?', ['warning:H02']],
  ['과제 마감 늦으면 어떻게 돼?', ['warning:E03']],
  ['지각하면 혼나?', ['warning:E03']],
  // 스몰토크
  ['교수님이랑 무슨 얘기하면 좋아?', ['talk:*']],
  ['야구 좋아하셔?', ['talk:baseball']],
  ['좋아하는 가수 있어?', ['talk:music']],
  ['같이 밥 먹으러 가면 뭐 먹어?', ['talk:food']],
  ['좋아하는 음식 있으셔?', ['talk:food']],
  ['교수님 취미가 뭐야', ['talk:*']],
  ['단 거 좋아하셔?', ['talk:gap_moe', 'traits:traits']],
  ['옷은 어떻게 입고 다니셔?', ['talk:fashion']],
  ['교수님 일 엄청 많이 하셔?', ['talk:workaholic']],
  ['교수님 기분 좋을 때는 언제야', ['talk:baseball', 'profile:jeong']],
  // 말버릇 사전
  ['시마이하자가 무슨 뜻이야', ['dict:시마이하자']],
  ['맞나? 는 무슨 말이야', ['dict:맞나?']],
  ['아이가는 부정하는 말이야?', ['dict:그거 아이가 / 아닌가']],
  ['난중에 뜻', ['dict:난중에']],
  ['우예 할라 그라노 무슨 말이야', ['dict:우예 할라 그라노?']],
  ['시다바리가 뭐야', ['dict:내가 니 시다바리가?']],
  ['나와바리 뜻 알려줘', ['dict:나와바리']],
  ['사투리 쓰셔?', ['dict:about', 'profile:jeong', 'dict:*']],
  ['실망이야 라고 하시면 어떡해', ['dict:실망이야 / 이해한 사람 손 들어 보세요']],
  ['인연 얘기 자주 하셔?', ['dict:연(緣)을 중요시하라']],
  ['수업 끝낼 때 하시는 말', ['dict:시마이하자']],
  ['영어로 핀잔 주실 때 있어?', ['dict:What’s wrong with you~']],
  ['이것저것 부탁드려도 돼?', ['dict:내가 니 시다바리가?']],
  // 日本語
  ['面談の前に何を準備すればいい？', ['scene:02_meeting']],
  ['教授の性格は？', ['traits:traits']],
  ['好きな音楽は？', ['talk:music']],
  ['課題のフィードバックのコツ', ['scene:01_feedback']],
  ['気をつけることは？', ['warning:*']],
  // 자료에 없는 질문 → "관련 자료 없음"이 정답
  ['학식 메뉴 추천해줘', []],
  ['기숙사 신청 언제야', []],
  ['교수님 전화번호 알려줘', []],
  ['주차 어디에 해?', []],
  ['오늘 날씨 어때', []],
  ['장학금 기준이 뭐야', []],
  ['졸업 요건 알려줘', []],
  ['토익 몇 점 필요해', []],
];

// 검증용 — search.js 를 조정할 때 보지 않은 질문 (node scripts/eval-search.mjs --holdout)
const HOLDOUT = [
  ['연구실 찾아갈 때 미리 뭘 정리해 가?', ['scene:02_meeting']],
  ['자퇴 고민 상담해도 돼?', ['scene:02_meeting']],
  ['과제 방향을 어떻게 잡아야 좋아하셔?', ['scene:01_feedback']],
  ['수업 중에 대답 못 하면 큰일나?', ['warning:W01', 'scene:03_why', 'dict:실망이야 / 이해한 사람 손 들어 보세요']],
  ['기한 넘겨서 내면 안 돼?', ['warning:E03']],
  ['교수님 열정 많으셔?', ['traits:traits']],
  ['논리적인 분이야?', ['traits:traits']],
  ['츤데레라는 게 무슨 말?', ['warning:N04']],
  ['삼성 이기면 기분 좋으셔?', ['talk:baseball', 'profile:jeong']],
  ['마라탕 좋아하셔?', ['talk:food']],
  ['J-POP 들으셔?', ['talk:music']],
  ['파란색 옷 자주 입으셔?', ['talk:fashion']],
  ['귀여운 거 좋아하신다며?', ['talk:gap_moe', 'traits:traits']],
  ['그라노가 뭐야?', ['dict:우예 할라 그라노?', 'dict:난중에']],
  ['뭐 묵노가 무슨 뜻이야', ['dict:뭐 묵노? (뭐문노)']],
  ['나빠또는 무슨 뜻이에요?', ['dict:나빠또~']],
  ['이해한 사람 손 들라고 하시면?', ['dict:실망이야 / 이해한 사람 손 들어 보세요']],
  ['研究室に行くときのコツは？', ['scene:02_meeting']],
  ['교수님 생일 언제야?', []],
  ['수강신청 팁 알려줘', []],
];

const MIN_SCORE = 0.2; // rag.js 와 같은 값

const db = openDb();
const rag = createRag(db);
const key = (c) => `${c.source_type}:${c.source_ref}`;
const ok = (c, want) => want.some((w) => w === key(c) || (w.endsWith(':*') && c.source_type === w.slice(0, -2)));

let top1 = 0, top3 = 0, answerable = 0, rejected = 0, offTopic = 0;
const misses = [];
const set = process.argv.includes('--holdout') ? HOLDOUT : CASES;
console.log(`${set === HOLDOUT ? '검증용(HOLDOUT)' : '조정용(CASES)'} ${set.length}문항\n`);
for (const [q, want] of set) {
  const hits = rag.retrieve('jeong', q).filter((h) => h.score >= MIN_SCORE);
  const show = hits.slice(0, 3).map((h) => `${key(h.chunk)}(${h.score.toFixed(2)})`).join(', ') || '(없음)';
  if (want.length === 0) {
    offTopic += 1;
    if (hits.length === 0) rejected += 1; else misses.push(`[무관인데 답함] ${q} → ${show}`);
    continue;
  }
  answerable += 1;
  const r1 = hits[0] && ok(hits[0].chunk, want);
  const r3 = hits.slice(0, 3).some((h) => ok(h.chunk, want));
  if (r1) top1 += 1;
  if (r3) top3 += 1;
  if (!r1) misses.push(`[${r3 ? '2~3위' : '못 찾음'}] ${q} → ${show}`);
}

const pct = (a, b) => `${a}/${b} (${Math.round((a / b) * 100)}%)`;
console.log(`1위가 정답        ${pct(top1, answerable)}`);
console.log(`3위 안에 정답     ${pct(top3, answerable)}`);
console.log(`무관한 질문 거르기 ${pct(rejected, offTopic)}`);
if (misses.length) console.log('\n' + misses.join('\n'));
