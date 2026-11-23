import { useCallback, useEffect, useRef, useState } from 'react';
import SectionHead from '../SectionHead.jsx';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';

/* ==========================================================================
   05 교수님께 한마디 — 익명 게시판
   - 기본 글: data/profs/*.jsx 의 posts (선배 설문의 한마디)
   - 새로 쓴 글: 서버 DB 에 저장 → 접속한 모든 사람에게 바로 보임 (GET/POST /api/thread)
     관리자 페이지 > 한마디 에서 숨기기 · 삭제
   - 서버에 연결할 수 없으면 예전처럼 이 브라우저(localStorage)에만 저장
   - 글이 SCROLL_FROM 개 이상이면 목록을 스크롤 박스로
   ========================================================================== */
const SCROLL_FROM = 6;
const MAX_LEN = 200;
const MAX_LOCAL = 100; // (서버 없을 때) 브라우저에 남길 내 글 최대 개수

const IDS = ['a3Kf9x', 'Qz81Lp', 'M0wY2e', 'bT7nRc', 'Xe4Hk1', 'p9DuVs', 'J2rqWm', 'L6aZtN'];
const DAYS = { ko: ['일', '월', '화', '수', '목', '금', '토'], ja: ['日', '月', '火', '水', '木', '金', '土'] };
const SAMPLE_DAYS = { ko: ['목', '금', '토'], ja: ['木', '金', '土'] };

const storageKey = (profId) => `gsc-thread-${profId}`;
const AUTHOR_KEY = 'gsc-thread-author';

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
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALNUM[b % ALNUM.length]).join('');

// 이 브라우저의 게시판 ID (화면의 ID:xxxx, "(나)" 표시용 — 개인정보 아님)
function myAuthor() {
  try {
    let id = localStorage.getItem(AUTHOR_KEY);
    if (!/^[A-Za-z0-9]{6}$/.test(id || '')) { id = randomId(); localStorage.setItem(AUTHOR_KEY, id); }
    return id;
  } catch { return randomId(); }
}

const fmt = (d, lang) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${DAYS[lang][d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
// 서버 시각 'YYYY-MM-DD HH:MM:SS' (UTC) → Date
const fromServer = (s) => new Date(`${s.replace(' ', 'T')}Z`);

// 데이터 파일의 기본 글 → 표시용 (날짜·ID는 장식)
const sampleRows = (posts, lang) => posts.map((p, i) => ({
  ...p,
  key: `s${i}`,
  id: IDS[i % IDS.length],
  date: `2026/11/${13 + (i % 3)}(${SAMPLE_DAYS[lang][i % 3]}) ${14 + (i % 9)}:${pad((i * 7) % 60)}`,
}));

// 서버 글 → 표시용
const serverRows = (list, lang, me) => list.map((p) => ({
  key: `d${p.id}`,
  anchor: p.anchor || '',
  body: p.body,
  id: p.author || '????',
  date: fmt(fromServer(p.created_at), lang),
  mine: !!p.author && p.author === me,
}));

// (서버 없을 때) 내가 쓴 글 → 표시용
const localRows = (list, lang) => list.map((p, i) => ({ ...p, key: `l${i}`, date: fmt(new Date(p.time), lang) }));

function PostList({ rows }) {
  const { t } = useLang();
  const anon = t('익명의 글시융러', '名無しのGSC生');
  return rows.map((p) => (
    <div className={'post' + (p.mine ? ' post--mine' : '')} key={p.key}>
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
  const [remote, setRemote] = useState(null);   // 서버 글 목록 (null = 아직 / 서버 없음)
  const [online, setOnline] = useState(true);   // false = 서버 연결 실패 → 브라우저 저장
  const [mine, setMine] = useState(() => loadLocal(profId));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const windowRef = useRef(null);
  const justPosted = useRef(false);
  const me = useRef(myAuthor()).current;
  const name = t(prof.name);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/thread/${encodeURIComponent(profId)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setRemote(data.posts || []);
      setOnline(true);
    } catch {
      setRemote(null);
      setOnline(false);
    }
  }, [profId]);

  // 교수님을 바꾸면 그 교수님 스레드 불러오기
  useEffect(() => {
    setRemote(null);
    setMine(loadLocal(profId));
    load();
  }, [profId, load]);

  const extra = online ? serverRows(remote || [], lang, me) : localRows(mine, lang);
  const rows = [...sampleRows(prof.posts, lang), ...extra].map((p, i) => ({ ...p, no: i + 1 }));
  const scrollable = rows.length >= SCROLL_FROM;

  // 글을 쓴 직후에는 맨 아래(새 글)로 스크롤
  useEffect(() => {
    if (!justPosted.current) return;
    justPosted.current = false;
    const el = windowRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [remote, mine]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const raw = text.trim().slice(0, MAX_LEN + 10);
    if (!raw || sending) return;
    setError('');

    if (online) {
      setSending(true);
      try {
        const res = await fetch('/api/thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profId, body: raw, author: me, lang }),
        });
        if (res.status === 429) { setError(t('잠시 후 다시 써 주세요. (1분에 5번까지)', '少し時間をおいてから書き込んでください。（1分に5回まで）')); return; }
        if (!res.ok) { setError(t('글을 저장하지 못했어요. (이모지만으로는 저장되지 않아요)', '保存できませんでした。（絵文字だけでは保存されません）')); return; }
        setText('');
        justPosted.current = true;
        await load(); // 그사이 다른 사람이 쓴 글까지 함께
      } catch {
        setError(t('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.', 'サーバーに接続できません。しばらくしてから再度お試しください。'));
      } finally {
        setSending(false);
      }
      return;
    }

    // 서버 없음 → 이 브라우저에만
    let body = raw.slice(0, MAX_LEN);
    let anchor = '';
    const m = body.match(/^>>(\d{1,4})\s*/);
    if (m) { anchor = `>>${m[1]} `; body = body.slice(m[0].length).trim(); }
    if (!body) return;
    const next = [...mine, { body, anchor, id: me, time: Date.now(), mine: true }];
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
              {' '}<button type="button" className="bbs__reload" onClick={load} aria-label={t('새로고침', '再読み込み')}>↻</button>
            </span>
          </div>
          <div
            ref={windowRef}
            className={'bbs__window' + (scrollable ? ' bbs__window--scroll' : '')}
            tabIndex={scrollable ? 0 : undefined}
            aria-label={t('게시글 목록', '書き込み一覧')}
            aria-live="polite"
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
              maxLength={MAX_LEN + 10}
              placeholder={online
                ? t('한마디 남기기 (익명 · 모두에게 보여요, >>번호 로 답글)', 'ひとこと書き込む（匿名・全員に表示、>>番号 で返信）')
                : t('한마디 남기기 (서버 연결 전이라 이 브라우저에만 저장돼요)', 'ひとこと書き込む（サーバー未接続のため、このブラウザにだけ保存）')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" disabled={sending}>{sending ? '…' : t('등록', '書き込む')}</button>
          </form>
          {error && <p className="bbs__error" role="alert">✗ {error}</p>}
        </div>
      </div>
    </section>
  );
}
