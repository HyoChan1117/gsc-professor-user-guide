/* ==========================================================================
   게시된 선배 제보 → 챗봇 검색 자료(chunks)
   - 관리자가 게시(published)하면 검색 자료를 만들고, 게시 취소 · 수정 · 삭제 시 지우거나 다시 만듦
   - chunks.source_type 은 섹션 종류(talk · dict …) 그대로 → 챗봇 출처 링크가 해당 섹션 페이지로 감
   - chunks.source_ref = 'contrib:<제보 id>' 로 구분 (seed 로 만든 자료와 섞이지 않게)
   ========================================================================== */
import { embed, EMBED_MODEL } from './openai.js';
import { PUBLIC_KINDS, NEW_SCENE } from './contrib.js';

// 선택지 key → 문장에 쓸 말 (frontend/src/data/contrib.js 의 라벨과 같은 뜻)
const LABEL = {
  level: { warning: { ko: '경고', ja: '警告' }, hint: { ko: '팁', ja: 'ヒント' }, error: { ko: '금지', ja: '禁止' }, note: { ko: '참고', ja: '参考' } },
  tag: { 사투리: { ko: '사투리', ja: '方言' }, 말버릇: { ko: '말버릇', ja: '口癖' }, 외래어: { ko: '외래어', ja: '外来語' }, 추정: { ko: '뜻 추정', ja: '意味は推定' } },
};
const KIND_NAME = {
  talk: { ko: '스몰토크', ja: '雑談ネタ' }, dict: { ko: '말버릇', ja: '口癖' }, traits: { ko: '성향', ja: '性格' },
  scene: { ko: '상황별 가이드', ja: '場面別ガイド' }, warning: { ko: '주의사항', ja: '注意事項' },
};
// 검색이 잘 되도록 앞에 붙이는 "이런 질문에 답하는 자료" 힌트 (seed.js 의 HINT 와 같은 역할)
const HINT = {
  talk: { ko: '스몰토크, 대화 주제, 교수님과 무슨 이야기를 하면 좋은지', ja: '雑談・話題、教授と何を話せばいいか' },
  dict: { ko: '교수님 말버릇·사투리 표현의 뜻', ja: '教授の口癖・方言の意味' },
  traits: { ko: '교수님 성격, 성향, 어떤 분인지', ja: '教授の性格・タイプ、どんな人か' },
  scene: { ko: '이런 상황에서 어떻게 준비하고 대처하면 되는지', ja: 'この場面でどう準備・対処すればいいか' },
  warning: { ko: '조심할 점, 하면 안 되는 것, 주의사항', ja: '気をつけること、してはいけないこと' },
};

const lab = (field, key, lang) => LABEL[field]?.[key]?.[lang] ?? key;
const parse = (s) => { try { return JSON.parse(s); } catch { return {}; } };

/** 제보 한 건 → 문장 (제보자가 쓴 원문은 그대로, 앞뒤 설명만 언어별)
 *  sceneTitle: 기존 상황 카드에 붙인 제보일 때 그 카드 제목 { ko, ja } */
function describe(kind, d, lang, sceneTitle) {
  const ko = lang === 'ko';
  const parts = [];
  if (kind === 'talk') {
    parts.push(ko ? `대화 주제: "${d.title}".` : `話題：「${d.title}」。`, d.body);
  } else if (kind === 'dict') {
    parts.push(ko ? `교수님이 쓰시는 표현 "${d.term}"` : `教授が使う表現「${d.term}」`);
    if (d.tag) parts.push(`(${lab('tag', d.tag, lang)})`);
    parts.push(d.meaning ? (ko ? `뜻: ${d.meaning}.` : `意味：${d.meaning}。`) : (ko ? '뜻은 아직 확실하지 않음.' : '意味はまだはっきりしない。'));
    if (d.tip) parts.push(ko ? `팁: ${d.tip}` : `コツ：${d.tip}`);
  } else if (kind === 'traits') {
    if (d.traits?.length) parts.push(ko ? `이 선배가 느낀 교수님 성향: ${d.traits.join(', ')}.` : `この先輩が感じた教授の性格：${d.traits.join('、')}。`);
    if (d.one_word) parts.push(ko ? `한마디 인상: "${d.one_word}".` : `一言の印象：「${d.one_word}」。`);
  } else if (kind === 'scene') {
    const title = sceneTitle?.[lang] || d.title || '';
    if (title) parts.push(ko ? `상황: ${title}.` : `場面：${title}。`);
    if (d.items?.length) parts.push(ko ? `준비 · 대처 체크리스트: ${d.items.join(' / ')}.` : `準備・対処チェックリスト：${d.items.join(' / ')}。`);
    if (d.tip) parts.push(ko ? `팁: ${d.tip}` : `コツ：${d.tip}`);
  } else if (kind === 'warning') {
    if (d.level) parts.push(`[${lab('level', d.level, lang)}]`);
    parts.push(d.title ? `${d.title}.` : '', d.msg);
  }
  return parts.filter(Boolean).join(' ');
}

/** contributions 행 → 검색 자료 한 개 (seed.js 의 chunk 형식과 같음)
 *  ctx.sceneTitle: 기존 상황 카드 제목 { ko, ja } (상황별 가이드 제보일 때) */
export function contribChunk(row, ctx = {}) {
  const d = typeof row.data === 'string' ? parse(row.data) : row.data;
  const head = (lang) => (lang === 'ko' ? `선배 제보 · ${KIND_NAME[row.kind].ko}` : `先輩の投稿・${KIND_NAME[row.kind].ja}`);
  const note = { ko: '(한 선배의 익명 제보, 관리자 검수 후 게시)', ja: '（一人の先輩の匿名投稿、管理者の確認後に掲載）' };
  return {
    prof_id: row.prof_id,
    type: row.kind,
    ref: `contrib:${row.id}`,
    title: { ko: head('ko'), ja: head('ja') },
    content: { ko: `${describe(row.kind, d, 'ko', ctx.sceneTitle)} ${note.ko}`, ja: `${describe(row.kind, d, 'ja', ctx.sceneTitle)} ${note.ja}` },
  };
}

/** 상황별 가이드 제보가 붙은 기존 카드의 제목 (DB scenes) — 없으면 undefined */
export function sceneTitleFor(db, row) {
  if (row.kind !== 'scene') return undefined;
  const d = typeof row.data === 'string' ? parse(row.data) : row.data;
  if (!d.scene || d.scene === NEW_SCENE) return undefined;
  const s = db.prepare('SELECT title_ko, title_ja FROM scenes WHERE prof_id = ? AND tab = ?').get(row.prof_id, d.scene);
  return s ? { ko: s.title_ko, ja: s.title_ja || s.title_ko } : undefined;
}

/** 임베딩할 문장 — 교수님 이름 · 힌트 · 제목 · 내용 */
export const contribEmbedText = (c, name, lang) => `${name[lang]} · ${HINT[c.type][lang]}\n${c.title[lang]}\n${c.content[lang]}`;

export function createContribIndex(db, rag) {
  const rowStmt = db.prepare('SELECT id, prof_id, kind, data, status FROM contributions WHERE id = ?');
  const profStmt = db.prepare('SELECT name_ko, name_ja FROM professors WHERE id = ?');
  const delStmt = db.prepare('DELETE FROM chunks WHERE source_ref = ?');
  const insStmt = db.prepare(`INSERT INTO chunks (prof_id, source_type, source_ref, title_ko, title_ja, content_ko, content_ja, embedding, embedding_ja, embed_model)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const blob = (v) => new Uint8Array(v.buffer, v.byteOffset, v.byteLength);

  /** 제보 하나의 검색 자료를 현재 상태에 맞춤 — 게시 중이면 (다시) 만들고, 아니면 지움. 성공 여부 반환 */
  async function sync(id) {
    const row = rowStmt.get(id);
    const ref = `contrib:${id}`;
    if (!row || row.status !== 'published' || !PUBLIC_KINDS.includes(row.kind)) {
      const info = delStmt.run(ref);
      if (info.changes && row) rag.invalidate(row.prof_id);
      return true;
    }
    const p = profStmt.get(row.prof_id);
    const name = { ko: p?.name_ko ?? row.prof_id, ja: p?.name_ja ?? p?.name_ko ?? row.prof_id };
    const c = contribChunk(row, { sceneTitle: sceneTitleFor(db, row) });
    let inTx = false;
    try {
      const [vKo, vJa] = await embed([contribEmbedText(c, name, 'ko'), contribEmbedText(c, name, 'ja')]);
      db.exec('BEGIN');
      inTx = true;
      delStmt.run(ref);
      insStmt.run(c.prof_id, c.type, c.ref, c.title.ko, c.title.ja, c.content.ko, c.content.ja, blob(vKo), blob(vJa), EMBED_MODEL);
      db.exec('COMMIT');
      inTx = false;
      rag.invalidate(row.prof_id);
      return true;
    } catch (err) {
      if (inTx) db.exec('ROLLBACK');
      // 임베딩 실패(키 없음 등) — 수정 전 내용(개인정보를 지웠을 수도 있음)이 남지 않도록 옛 자료는 지움.
      // 게시는 유지되고, 다음 서버 시작 때 다시 시도
      if (delStmt.run(ref).changes) rag.invalidate(row.prof_id);
      console.warn(`[contrib-index] #${id} 검색 자료 생성 실패: ${err.message}`);
      return false;
    }
  }

  /** 삭제된 제보의 검색 자료 지우기 */
  function remove(id, profId) {
    const info = delStmt.run(`contrib:${id}`);
    if (info.changes && profId) rag.invalidate(profId);
  }

  /** 서버 시작 시: 게시 중인데 검색 자료가 없는 제보 채우기 + 게시가 내려간 제보의 자료 정리 */
  async function syncMissing() {
    const missing = db.prepare(`SELECT id FROM contributions c WHERE status = 'published' AND kind != 'other'
      AND NOT EXISTS (SELECT 1 FROM chunks WHERE source_ref = 'contrib:' || c.id)`).all();
    const stale = db.prepare(`SELECT DISTINCT prof_id FROM chunks WHERE source_ref LIKE 'contrib:%'
      AND CAST(substr(source_ref, 9) AS INTEGER) NOT IN (SELECT id FROM contributions WHERE status = 'published')`).all();
    if (stale.length) {
      db.exec(`DELETE FROM chunks WHERE source_ref LIKE 'contrib:%'
        AND CAST(substr(source_ref, 9) AS INTEGER) NOT IN (SELECT id FROM contributions WHERE status = 'published')`);
      for (const s of stale) rag.invalidate(s.prof_id);
    }
    let ok = 0;
    for (const { id } of missing) if (await sync(id)) ok += 1;
    if (missing.length) console.log(`[contrib-index] 게시된 제보 검색 자료 ${ok}/${missing.length}개 생성`);
  }

  return { sync, remove, syncMissing };
}
