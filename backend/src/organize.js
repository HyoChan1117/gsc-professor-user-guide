/* ==========================================================================
   제보 AI 정리 — 제보가 들어오면 Claude가 글을 다듬어서 data 에 넣음 (원문은 original 에 보관)
   - 오타 · 띄어쓰기 수정, 개인 식별 정보 제거 · 일반화, 읽기 좋게 정리 (내용 · 사실은 바꾸지 않음)
   - 비방 · 무관한 내용이면 verdict 로 관리자에게 알림 (게시 여부는 관리자가 결정)
   - 제보자는 기다리지 않음: 저장 후 백그라운드에서 실행, 서버 재시작 시 남은 것 다시 실행
   - 관리자가 먼저 손댄 제보(ai_status = skipped)는 덮어쓰지 않음
   ========================================================================== */
import { generateJson, ChatUnavailableError, CHAT_MODEL, claudeEnabled } from './claude.js';
import { validate } from './contrib.js';

// AI가 다듬는 글 항목 (선택지 항목은 그대로 둠) — 프롬프트에 쓸 이름
// 홈 섹션 항목 모양 그대로 — 제목은 짧게, 설명은 한두 문장
const TEXT_FIELDS = {
  talk: { title: '스몰토크 카드 제목 (짧은 주제, 20자 안팎)', body: '카드 설명 (한두 문장)' },
  dict: { term: '교수님 표현 (원문 그대로 — 고치지 않음)', meaning: '표준어 뜻 (짧게)', tip: '후배에게 주는 팁 (한 문장)' },
  traits: { one_word: '한마디 인상 (짧게)' },
  scene: { title: '새 상황 카드 제목 (예: "과제 피드백 받기 전", 비어 있으면 빈 문자열)', items: '체크리스트 — 한 줄에 한 항목, 각각 짧은 행동 지침', tip: '선배 한 줄 팁' },
  warning: { title: '주의사항 제목 (짧게, 15자 안팎)', msg: '설명 (한두 문장)' },
  other: { feedback: '사이트 요청', advice: '후배에게 조언' },
};
const KIND_NAME = { talk: '스몰토크 소재', dict: '말버릇 · 사투리 사전', traits: '성향 분석 투표', scene: '상황별 가이드 체크리스트', warning: '사용 시 주의사항', other: '기타 · 사이트 의견' };
// 원문을 그대로 두는 항목 (교수님 표현은 한 글자도 바꾸면 안 됨)
const KEEP = { dict: ['term'] };
// 목록 항목 (배열 ↔ 줄바꿈 문자열)
const LINES = { scene: ['items'] };

function schemaFor(kind) {
  const fields = Object.keys(TEXT_FIELDS[kind]);
  return {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        properties: Object.fromEntries(fields.map((k) => [k, { type: 'string', description: TEXT_FIELDS[kind][k] }])),
        required: fields,
        additionalProperties: false,
      },
      changes: { type: 'string', description: '관리자에게: 무엇을 고쳤는지 한두 문장 (한국어)' },
      verdict: { type: 'string', enum: ['ok', 'caution', 'reject'] },
      reason: { type: 'string', description: 'caution/reject 인 이유 (한국어, ok면 빈 문자열)' },
    },
    required: ['fields', 'changes', 'verdict', 'reason'],
    additionalProperties: false,
  };
}

function systemPrompt(lang) {
  const langName = lang === 'ja' ? '일본어' : '한국어';
  return [
    `너는 영진전문대 글로벌시스템융합과 학생들이 만든 "GSC 교수님 사용 설명서" 사이트의 제보 편집자다.`,
    `후배들이 교수님과의 수업 · 면담을 준비하도록 선배들이 익명으로 남긴 제보를, 사이트에 게시하기 좋게 다듬는다.`,
    ``,
    `할 일:`,
    `1. 오타 · 띄어쓰기 · 맞춤법을 고치고, 문장을 짧고 읽기 쉽게 정리한다. 반말 · 비속어는 부드러운 존댓말 서술로 바꾼다.`,
    `2. 내용과 사실은 바꾸지 않는다. 제보에 없는 정보 · 해석 · 조언을 덧붙이지 않는다. 길이는 원문과 비슷하거나 더 짧게.`,
    `3. 제보자나 다른 학생을 알아볼 수 있는 정보(학생 이름 · 학번 · 연락처 · 정확한 날짜 · 특정 과목 성적 등)는 지우거나 일반화한다.`,
    `   예: "김OO 선배랑" → "선배와", "2026년 4월 3일" → "2026년 봄", 시기 칸은 "학기 · 계절" 정도로.`,
    `4. 교수님에 대한 정보(취미 · 말버릇 · 성향 · 수업 방식)는 그대로 둔다. 단 교수님을 비하 · 조롱하는 표현은 중립적으로 바꾼다.`,
    `5. 원문의 언어(${langName})를 그대로 쓴다. 번역하지 않는다. 한국어 사투리 · 말버릇 인용은 원문 그대로 둔다.`,
    `6. "교수님 표현 (원문 그대로)" 항목은 한 글자도 바꾸지 않는다. 비어 있는 항목은 빈 문자열로 둔다.`,
    `7. 결과는 홈 화면 카드에 그대로 들어간다. 제목은 짧게, 설명은 한두 문장. 체크리스트는 한 줄에 한 항목(최대 5줄), 목록 기호(- 등) 없이.`,
    ``,
    `판단(verdict):`,
    `- ok: 게시해도 괜찮음`,
    `- caution: 확인이 필요함 (사실인지 애매함, 개인정보가 남아 있을 수 있음, 한 사람에 대한 부정적 경험이 강함 등)`,
    `- reject: 게시하면 안 됨 (교수님 · 학생 비방, 장난 · 무의미한 글, 교수님과 무관한 내용, 개인 신상 폭로)`,
  ].join('\n');
}

const parse = (s, fb = null) => { try { return JSON.parse(s); } catch { return fb; } };

export function createOrganizer(db, contribIndex) {
  const rowStmt = db.prepare('SELECT * FROM contributions WHERE id = ?');
  const profStmt = db.prepare('SELECT name_ko FROM professors WHERE id = ?');
  const running = new Set();

  /**
   * 제보 하나 정리. force: 관리자가 "AI로 다시 정리"를 눌렀을 때 (원문에서 다시, 상태와 상관없이)
   * 반환: { ok, row?, error? }
   */
  async function organize(id, { force = false } = {}) {
    if (running.has(id)) return { ok: false, error: 'busy' };
    const row = await rowStmt.get(id);
    if (!row) return { ok: false, error: 'not_found' };
    if (!force && row.ai_status !== 'pending') return { ok: false, error: 'not_pending' };
    if (!TEXT_FIELDS[row.kind]) return { ok: false, error: 'unknown_kind' };

    running.add(id);
    const source = parse(row.original) ?? parse(row.data, {});
    if (force) await db.prepare(`UPDATE contributions SET ai_status = 'pending' WHERE id = ?`).run(id);
    try {
      const prof = (await profStmt.get(row.prof_id))?.name_ko ?? row.prof_id;
      const isLines = (k) => LINES[row.kind]?.includes(k);
      const input = Object.fromEntries(Object.keys(TEXT_FIELDS[row.kind]).map((k) => [k,
        isLines(k) ? (source[k] || []).join('\n') : (source[k] ?? '')]));
      const user = [
        `교수님: ${prof}`,
        `제보 종류: ${KIND_NAME[row.kind]}`,
        `원문 언어: ${row.lang === 'ja' ? '일본어' : '한국어'}`,
        ``,
        `[원문 항목]`,
        ...Object.entries(input).map(([k, v]) => `- ${k} (${TEXT_FIELDS[row.kind][k]}):${isLines(k) ? '\n' : ' '}${v || '(비어 있음)'}`),
        ...(row.kind === 'scene' && source.scene && source.scene !== '__new'
          ? [``, `(기존 상황 카드 "${source.scene}"에 체크리스트를 추가하는 제보라서 title 은 빈 문자열로 둔다)`] : []),
      ].join('\n');

      const out = await generateJson(systemPrompt(row.lang), user, schemaFor(row.kind));

      // 선택지 항목 · 원문 유지 항목은 원문 그대로, 글 항목만 AI 결과로
      const merged = { ...source };
      for (const k of Object.keys(TEXT_FIELDS[row.kind])) {
        if (KEEP[row.kind]?.includes(k)) continue;
        const v = typeof out.fields?.[k] === 'string' ? out.fields[k] : input[k];
        if (!v || !v.trim()) { delete merged[k]; continue; }
        merged[k] = isLines(k) ? v.split('\n') : v; // 목록은 다시 배열로 (검사에서 목록 기호 · 빈 줄 정리)
      }
      // 제보할 때와 같은 검사 (필수 항목 · 길이 · 이모지) — 통과 못 하면 원문 유지
      const checked = validate(row.kind, merged);
      if (checked.error) throw new ChatUnavailableError('api_error', `정리 결과가 검사를 통과하지 못함 (${checked.field})`);

      const note = {
        changes: String(out.changes || '').slice(0, 500),
        verdict: ['ok', 'caution', 'reject'].includes(out.verdict) ? out.verdict : 'caution',
        reason: String(out.reason || '').slice(0, 500),
      };
      // 자동 정리 중에 관리자가 먼저 손댔으면(skipped) 덮어쓰지 않음
      const info = await db.prepare(`UPDATE contributions SET data = ?, ai_status = 'done', ai_note = ?
        WHERE id = ? AND ai_status = 'pending'`).run(JSON.stringify(checked.data), JSON.stringify(note), id);
      if (!info.changes) return { ok: false, error: 'skipped' };
      if (row.status === 'published') await contribIndex?.sync(id); // 게시 중인 제보를 다시 정리한 경우 챗봇 자료도
      return { ok: true, row: await rowStmt.get(id) };
    } catch (err) {
      if (!(err instanceof ChatUnavailableError)) console.error('[organize]', err);
      else console.warn(`[organize] #${id} ${CHAT_MODEL} 정리 실패 → 원문 유지 (${err.code}: ${err.message})`);
      await db.prepare(`UPDATE contributions SET ai_status = 'failed', ai_note = ? WHERE id = ? AND ai_status = 'pending'`)
        .run(JSON.stringify({ changes: '', verdict: null, reason: '', error: err.code || 'error' }), id);
      return { ok: false, error: 'ai_failed' };
    } finally {
      running.delete(id);
    }
  }

  /** 서버 시작 시 — 정리 중이던(pending) 제보 다시 실행 */
  async function organizePending() {
    const ids = (await db.prepare(`SELECT id FROM contributions WHERE ai_status = 'pending' ORDER BY id`).all()).map((r) => r.id);
    for (const id of ids) await organize(id);
    if (ids.length) console.log(`[organize] 대기 중이던 제보 ${ids.length}개 정리 시도`);
  }

  // enabled: Claude 키가 있을 때만 제보를 AI 정리 대기(pending)로 저장 — 없으면 원문 그대로 검수 대기
  return { organize, organizePending, enabled: claudeEnabled };
}
