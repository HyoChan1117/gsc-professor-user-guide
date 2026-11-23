import { useEffect, useRef, useState } from 'react';
import SectionHead from '../SectionHead.jsx';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';

/* ==========================================================================
   05 교수님께 한마디 — 프론트 전용 (DB · API 사용 안 함)
   - 기본 글: data/profs/*.jsx 의 posts
   - 새로 쓴 글: 이 브라우저의 localStorage 에만 저장 (다른 사람에게는 안 보임)
   - 글이 SCROLL_FROM 개 이상이면 목록을 스크롤 박스로
   ========================================================================== */
const SCROLL_FROM = 6;
const MAX_LEN = 200;
const MAX_LOCAL = 100; // 브라우저에 남길 내 글 최대 개수

const IDS = ['a3Kf9x', 'Qz81Lp', 'M0wY2e', 'bT7nRc', 'Xe4Hk1', 'p9DuVs', 'J2rqWm', 'L6aZtN'];
const DAYS = { ko: ['일', '월', '화', '수', '목', '금', '토'], ja: ['日', '月', '火', '水', '木', '金', '土'] };
const SAMPLE_DAYS = { ko: ['목', '금', '토'], ja: ['木', '金', '土'] };

const storageKey = (profId) => `gsc-thread-${profId}`;

function loadLocal(profId) {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey(profId)) || '[]');
    return Array.isArray(list) ? list.filter((p) => p && typeof p.body === 'string') : [];
  } catch { return []; }
}

function saveLocal(profId, list) {
  try { localStorage.setItem(storageKey(profId), JSON.stringify(list.slice(-MAX_LOCAL))); } catch { /* 저장소 사용 불가 */ }
}

const pad = (n) => String(n).padStart(2, '0');
const randomId = () => Math.random().toString(36).slice(2, 8);

// 데이터 파일의 기본 글 → 표시용 (날짜·ID는 장식)
const sampleRows = (posts, lang) => posts.map((p, i) => ({
  ...p,
  id: IDS[i % IDS.length],
  date: `2026/11/${13 + (i % 3)}(${SAMPLE_DAYS[lang][i % 3]}) ${14 + (i % 9)}:${pad((i * 7) % 60)}`,
}));

// 내가 쓴 글 → 표시용 (저장된 시각을 현재 언어 요일로)
const localRows = (list, lang) => list.map((p) => {
  const d = new Date(p.time);
  return {
    ...p,
    date: `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${DAYS[lang][d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
});

function PostList({ rows }) {
  const { t } = useLang();
  const anon = t('익명의 글시융러', '名無しのGSC生');
  return rows.map((p) => (
    <div className={'post' + (p.mine ? ' post--mine' : '')} key={p.no}>
      <div className="post__meta">
        {p.no} ：<span className="post__name">{anon}</span>
        <span className="post__date">：{p.date}</span> ID:{p.id}
        {p.mine && <span className="post__mine"> ({t('나', '自分')})</span>}
      </div>
      <div className="post__body">
        {p.anchor && <span className="post__anchor">{p.anchor}</span>}
        {t(p.body)}
      </div>
    </div>
  ));
}

export default function Thread() {
  const { prof, profId } = useProf();
  const { t, lang } = useLang();
  const [text, setText] = useState('');
  const [mine, setMine] = useState(() => loadLocal(profId));
  const windowRef = useRef(null);
  const justPosted = useRef(false);
  const name = t(prof.name);

  // 교수님을 바꾸면 그 교수님 스레드의 내 글 불러오기
  useEffect(() => { setMine(loadLocal(profId)); }, [profId]);

  const rows = [...sampleRows(prof.posts, lang), ...localRows(mine, lang)].map((p, i) => ({ ...p, no: i + 1 }));
  const scrollable = rows.length >= SCROLL_FROM;

  // 글을 쓴 직후에는 맨 아래(새 글)로 스크롤
  useEffect(() => {
    if (!justPosted.current) return;
    justPosted.current = false;
    const el = windowRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mine]);

  const onSubmit = (e) => {
    e.preventDefault();
    let body = text.trim().slice(0, MAX_LEN);
    if (!body) return;
    // ">>3 내용" → 앵커 + 본문
    let anchor = '';
    const m = body.match(/^>>(\d{1,4})\s*/);
    if (m) { anchor = `>>${m[1]} `; body = body.slice(m[0].length).trim(); }
    if (!body) return;

    const next = [...mine, { body, anchor, id: randomId(), time: Date.now(), mine: true }];
    saveLocal(profId, next);
    justPosted.current = true;
    setMine(next);
    setText('');
  };

  return (
    <section className="section section--alt" id="thread" aria-labelledby="thread-h">
      <div className="container">
        <SectionHead file="// 05 thread.log" id="thread-h" title={t('교수님께 한마디', '教授へのひとこと')} />
        <div className="bbs">
          <div className="bbs__head">
            <h3 className="bbs__title">
              {t(`【글시융】${name}한테 한마디 하는 스레 Part.1`, `【GSC】${name}にひとこと言うスレ Part.1`)}
            </h3>
            <span className="bbs__meta">
              {rows.length} {t('개의 글', '件の書き込み')}{scrollable && t(' · 스크롤해서 보기', ' · スクロールで表示')}
            </span>
          </div>
          <div
            ref={windowRef}
            className={'bbs__window' + (scrollable ? ' bbs__window--scroll' : '')}
            tabIndex={scrollable ? 0 : undefined}
            aria-label={t('게시글 목록', '書き込み一覧')}
          >
            {rows.length === 0 ? (
              <div className="post">
                <div className="post__body">{t('아직 글이 없습니다. 첫 번째로 한마디 남겨 주세요!', 'まだ書き込みがありません。最初のひとことをどうぞ！')}</div>
              </div>
            ) : (
              <PostList rows={rows} />
            )}
          </div>
          <form className="bbs__form" onSubmit={onSubmit}>
            <label htmlFor="bbs">{t('이름：', '名前：')}<span className="post__name">{t('익명의 글시융러', '名無しのGSC生')}</span></label>
            <input
              id="bbs"
              type="text"
              maxLength={MAX_LEN}
              placeholder={t('한마디 남기기 (이 브라우저에만 저장돼요)', 'ひとこと書き込む（このブラウザにだけ保存されます）')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit">{t('등록', '書き込む')}</button>
          </form>
        </div>
      </div>
    </section>
  );
}
