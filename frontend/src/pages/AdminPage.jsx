import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LangToggle from '../components/LangToggle.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { GRADES, KINDS, DEFAULT_TRAITS, kindOf, optionLabel, resolveOptions } from '../data/contrib.js';
import { PROFS } from '../data/profs/index.js';

// 교수님 기본 데이터 (상황 카드 이름 · 성향 항목 라벨 찾기용)
const profOf = (id) => PROFS.find((p) => p.id === id);
// 성향 투표 값(label_ko) → { ko, ja } 라벨
const traitLabel = (ko) => {
  for (const p of PROFS) { const tr = p.traits?.find((x) => x.label.ko === ko); if (tr) return tr.label; }
  return DEFAULT_TRAITS.find((d) => d.ko === ko) ?? { ko, ja: ko };
};
import { useLang } from '../context/LangContext.jsx';

/* ==========================================================================
   /admin — 관리자 페이지 (메뉴에는 노출하지 않음)
   로그인 토큰은 sessionStorage 에만 (탭을 닫으면 로그아웃)
   ========================================================================== */
const TOKEN_KEY = 'gsc-admin-token';
const PAGE = 30;

// 제보 흐름: new(검수 대기) → published(게시 = 사이트 공개) / reviewed(보류) / rejected(반려)
const STATUS = {
  new: { ko: '검수 대기', ja: '未確認' },
  published: { ko: '게시됨', ja: '掲載中' },
  reviewed: { ko: '보류', ja: '保留' },
  rejected: { ko: '반려', ja: '却下' },
};
const MODES = {
  generate: { ko: 'AI 답변', ja: 'AI回答' },
  retrieval: { ko: '검색 모드', ja: '検索モード' },
  empty: { ko: '자료 없음', ja: '資料なし' },
};
const ERRORS = {
  wrong_password: { ko: '비밀번호가 틀렸어요.', ja: 'パスワードが違います。' },
  admin_disabled: { ko: '관리자 기능이 꺼져 있어요. backend/.env 에 ADMIN_PASSWORD 를 설정하고 서버를 다시 시작하세요.', ja: '管理者機能が無効です。backend/.env に ADMIN_PASSWORD を設定し、サーバーを再起動してください。' },
  too_many_requests: { ko: '시도가 너무 많아요. 1분 뒤에 다시 해 주세요.', ja: '試行回数が多すぎます。1分後にもう一度どうぞ。' },
  network: { ko: '서버에 연결할 수 없어요.', ja: 'サーバーに接続できません。' },
  missing_field: { ko: '필수 항목이 비어 있어요. (이모지만으로는 저장되지 않아요)', ja: '必須項目が空です。（絵文字だけでは保存されません）' },
  not_publishable: { ko: '이 종류는 사이트에 게시할 수 없어요.', ja: 'この種類はサイトに掲載できません。' },
  ai_failed: { ko: 'AI 정리에 실패했어요. (Claude API 키 · 한도를 확인해 주세요) 내용은 그대로예요.', ja: 'AI整理に失敗しました。（Claude APIキー・上限を確認してください）内容はそのままです。' },
  ai_unavailable: { ko: 'AI 정리 기능을 쓸 수 없어요.', ja: 'AI整理機能が使えません。' },
  busy: { ko: '이미 정리 중이에요. 잠시 후 다시 시도해 주세요.', ja: 'すでに整理中です。少し後でもう一度どうぞ。' },
  default: { ko: '요청을 처리하지 못했어요.', ja: 'リクエストを処理できませんでした。' },
};

const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const writeToken = (v) => { try { v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* 무시 */ } };
const fmtDate = (s) => (s ? s.replace('T', ' ').slice(0, 16) + ' UTC' : '');

class ApiError extends Error {
  constructor(code, status, field) { super(code); this.code = code; this.status = status; this.field = field; }
}

/** 토큰을 붙여 요청 — 401 이면 onUnauthorized */
function useApi(token, onUnauthorized) {
  return useCallback(async (path, { method = 'GET', body } = {}) => {
    let res;
    try {
      res = await fetch(`/api/admin${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { throw new ApiError('network', 0); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { onUnauthorized(); throw new ApiError('unauthorized', 401); }
    if (!res.ok) throw new ApiError(data.error || 'default', res.status, data.field);
    return data;
  }, [token, onUnauthorized]);
}

/* ---------------------------------------------------------------- 로그인 */
function Login({ onLogin }) {
  const { t } = useLang();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(data.error || 'default', res.status);
      onLogin(data.token);
    } catch (err) {
      setError(ERRORS[err.code] ? err.code : 'network');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container admin-login">
      <form className="card admin-login__box" onSubmit={submit}>
        <p className="mono c-comment">$ sudo gsc-admin</p>
        <h1>{t('관리자 로그인', '管理者ログイン')}</h1>
        <label className="admin-field">
          <span>{t('비밀번호', 'パスワード')}</span>
          <input className="survey-input" type="password" autoComplete="current-password" autoFocus
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="survey-error" role="alert">✗ {t(ERRORS[error])}</p>}
        <button type="submit" className="btn-primary admin-btn" disabled={busy || !password}>
          {busy ? t('확인 중…', '確認中…') : t('로그인', 'ログイン')}
        </button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- 개요 */
function Bars({ title, list, counts, total }) {
  const { t } = useLang();
  return (
    <div className="admin-bars">
      <h4>{title}</h4>
      {list.map((x) => {
        const n = counts?.[x.key] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div className="admin-bar" key={x.key}>
            <span className="admin-bar__label">{x.icon ? `${x.icon} ` : ''}{t(x.label)}</span>
            <span className="admin-bar__track"><span style={{ width: `${pct}%` }} /></span>
            <span className="admin-bar__num mono">{n} · {pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function Overview({ api, onOpen }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/overview').then(setData).catch((e) => setError(e.code));
  }, [api]);

  if (error) return <p className="survey-error">✗ {t(ERRORS[error] || ERRORS.default)}</p>;
  if (!data) return <p className="c-muted">{t('불러오는 중…', '読み込み中…')}</p>;

  return (
    <div className="admin-overview">
      {data.profs.map((p) => {
        const c = p.contrib;
        const counted = c.total - c.status.rejected;
        return (
          <section className="card admin-prof" key={p.id}>
            <header className="admin-prof__head">
              <h3>{t(p.name_ko, p.name_ja)} <span className="mono c-comment">{p.id}</span></h3>
            </header>
            <div className="admin-stats">
              <button type="button" className="admin-stat is-link" onClick={() => onOpen({ prof: p.id })}>
                <span>{t('전체 제보', '投稿合計')}</span><strong>{c.total}</strong>
              </button>
              <button type="button" className="admin-stat is-link is-new" onClick={() => onOpen({ prof: p.id, status: 'new' })}>
                <span>{t('검수 대기', '未確認')}</span><strong>{c.status.new}</strong>
              </button>
              <button type="button" className="admin-stat is-link" onClick={() => onOpen({ prof: p.id, status: 'published' })}>
                <span>{t('게시됨', '掲載中')}</span><strong>{c.status.published}</strong>
              </button>
              <div className="admin-stat"><span>{t('챗봇 질문', 'チャットボット質問')}</span><strong>{p.chat.total}</strong></div>
              <div className="admin-stat"><span>{t('최근 7일 질문', '直近7日の質問')}</span><strong>{p.chat.week}</strong></div>
            </div>

            <div className="admin-kinds">
              {KINDS.map((k) => (
                <button key={k.key} type="button" className="admin-kind" onClick={() => onOpen({ prof: p.id, kind: k.key })}>
                  <span aria-hidden="true">{k.icon}</span>
                  <span className="admin-kind__name">{t(k.title)}</span>
                  <strong className="mono">{c.kinds[k.key]?.total ?? 0}</strong>
                  {c.kinds[k.key]?.new > 0 && <span className="admin-badge is-new">+{c.kinds[k.key].new}</span>}
                </button>
              ))}
            </div>

            {counted > 0 ? (
              <div className="admin-prof__grid">
                {c.traitsN > 0
                  ? <Bars title={t(`성향 투표 (${c.traitsN}건 기준, 반려 제외)`, `性格の投票（${c.traitsN}件基準、却下除く）`)}
                    list={Object.keys(c.traits).sort((a, b) => c.traits[b] - c.traits[a]).map((k) => ({ key: k, label: traitLabel(k) }))}
                    counts={c.traits} total={c.traitsN} />
                  : <p className="c-muted">{t('아직 성향 제보가 없어요.', 'まだ性格の投稿がありません。')}</p>}
                <Bars title={t(`제보자 학년 (반려 제외 ${counted}건)`, `投稿者の学年（却下除く${counted}件）`)} list={GRADES} counts={c.grades} total={counted} />
              </div>
            ) : (
              <p className="c-muted">{t('아직 집계할 제보가 없어요.', 'まだ集計できる投稿がありません。')}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- 섹션별 제보 */
const csvCell = (v) => {
  const s = Array.isArray(v) ? v.join(' | ') : String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// 종류를 하나 고르면 그 종류의 항목이 열로, 아니면 모든 종류 항목을 합쳐서
function downloadCsv(rows, kindKey) {
  const fieldKeys = [...new Set((kindKey ? [kindOf(kindKey)] : KINDS).flatMap((k) => k.fields.map((f) => f.key)))];
  const cols = ['id', 'created_at', 'prof_id', 'kind', 'lang', 'grade', 'status', ...fieldKeys];
  const csv = '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(fieldKeys.includes(c) ? r.data[c] : r[c])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `contrib_${kindKey || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Field({ label, children }) {
  if (!children) return null;
  return (
    <div className="admin-kv">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** 제보 한 건의 항목들 — 선택지는 라벨로, 첫 항목은 크게 */
function ContribFields({ row, data = row.data }) {
  const { t } = useLang();
  const kind = kindOf(row.kind);
  if (!kind) return <pre className="admin-raw">{JSON.stringify(data, null, 2)}</pre>;
  const prof = profOf(row.prof_id);
  const show = (f) => {
    const v = data[f.key];
    if (v == null || (Array.isArray(v) && !v.length)) return null;
    if (f.type === 'lines') return <ul className="admin-lines">{v.map((x, i) => <li key={i}>{x}</li>)}</ul>;
    if (f.type === 'multi') return v.map((x) => t(optionLabel(row.kind, f.key, x, prof))).join(' · ');
    if (f.type === 'choice') return t(optionLabel(row.kind, f.key, v, prof));
    return v;
  };
  const [main, ...rest] = kind.fields.filter((f) => show(f) != null);
  return (
    <>
      {main && (
        <div className="admin-item__main">
          <span className="admin-item__label">{t(main.label)}</span>
          <p className="admin-item__episode">{show(main)}</p>
        </div>
      )}
      {rest.length > 0 && (
        <dl className="admin-kvs">
          {rest.map((f) => <Field key={f.key} label={t(f.label)}>{show(f)}</Field>)}
        </dl>
      )}
    </>
  );
}

/** 수정 폼의 입력 하나 */
function EditInput({ field, value, onChange, profId }) {
  const { t } = useLang();
  const prof = profOf(profId);
  let options = resolveOptions(field, prof);
  if (field.options === 'traits') {
    // 기본 성향 + 이미 고른 값도 선택지에 (교수님 데이터에 없는 항목이 지워지지 않게)
    const keys = new Set(options.map((o) => o.key));
    for (const d of DEFAULT_TRAITS) if (!keys.has(d.ko)) { options.push({ key: d.ko, label: d }); keys.add(d.ko); }
    for (const v of value ?? []) if (!keys.has(v)) options.push({ key: v, label: { ko: v, ja: v } });
  }
  if (field.type === 'lines') {
    const text = Array.isArray(value) ? value.join('\n') : value ?? '';
    return <textarea className="survey-input" rows={4} value={text} onChange={(e) => onChange(e.target.value.split('\n'))} />;
  }
  if (field.type === 'choice') {
    return (
      <select className="survey-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        {!field.required && <option value="">{t('(없음)', '（なし）')}</option>}
        {options.map((o) => <option key={o.key} value={o.key}>{o.mono ? `${o.mono} · ` : ''}{t(o.label)}</option>)}
      </select>
    );
  }
  if (field.type === 'multi') {
    const list = value ?? [];
    return (
      <div className="admin-edit__checks">
        {options.map((o) => (
          <label key={o.key}>
            <input type="checkbox" checked={list.includes(o.key)}
              onChange={() => onChange(list.includes(o.key) ? list.filter((x) => x !== o.key) : [...list, o.key])} />
            {' '}{t(o.label)}
          </label>
        ))}
      </div>
    );
  }
  const Tag = field.type === 'textarea' ? 'textarea' : 'input';
  return <Tag className="survey-input" rows={field.type === 'textarea' ? 3 : undefined} maxLength={field.max}
    value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

/** AI 정리 상태 줄 — 무엇을 고쳤는지 · 주의/반려 권장 · 원문 보기 */
function AiBar({ row, showOriginal, setShowOriginal }) {
  const { t } = useLang();
  const note = row.ai_note;
  const changed = JSON.stringify(row.original) !== JSON.stringify(row.data);
  if (!row.ai_status && !changed) return null;
  return (
    <div className={`admin-ai is-${row.ai_status || 'none'}`}>
      <div className="admin-ai__line">
        {row.ai_status === 'pending' && <span className="admin-ai__tag">{t('✨ AI 정리 중…', '✨ AI整理中…')}</span>}
        {row.ai_status === 'done' && <span className="admin-ai__tag">{t('✨ AI 정리됨', '✨ AI整理済み')}</span>}
        {row.ai_status === 'failed' && <span className="admin-ai__tag c-pink">{t('AI 정리 실패 — 원문 그대로', 'AI整理に失敗 — 原文のまま')}</span>}
        {row.ai_status === 'skipped' && <span className="admin-ai__tag">{t('관리자가 직접 수정', '管理者が直接編集')}</span>}
        {note?.verdict === 'caution' && <span className="admin-badge is-caution">{t('확인 필요', '要確認')}</span>}
        {note?.verdict === 'reject' && <span className="admin-badge is-rejected">{t('AI: 반려 권장', 'AI：却下を推奨')}</span>}
        {changed && (
          <button type="button" className="admin-link" onClick={() => setShowOriginal((v) => !v)}>
            {showOriginal ? t('정리본 보기', '整理版を見る') : t('원문 보기', '原文を見る')}
          </button>
        )}
      </div>
      {note?.changes && <p className="admin-ai__note">{note.changes}</p>}
      {note?.reason && note.verdict !== 'ok' && <p className="admin-ai__note c-yellow">{note.reason}</p>}
    </div>
  );
}

/** 제보 한 건 — AI 정리 확인 + 검수(게시 · 보류 · 반려) + 내용 수정 */
function ContribItem({ row, profName, onUpdate, onRemove, onOrganize }) {
  const { t } = useLang();
  const kind = kindOf(row.kind);
  const publishable = row.kind !== 'other';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.data);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null); // { code, field? }
  const [showOriginal, setShowOriginal] = useState(false);
  const changed = JSON.stringify(row.original) !== JSON.stringify(row.data);

  async function run(body, fn = onUpdate) {
    setBusy(true);
    setErr(null);
    try {
      await fn(body);
      if (body?.data) setEditing(false);
      setShowOriginal(false);
    } catch (e) {
      setErr({ code: e.code, field: e.field });
    } finally {
      setBusy(false);
    }
  }
  const startEdit = () => { setDraft(row.data); setErr(null); setEditing(true); };

  return (
    <article className={`card admin-item is-${row.status}`}>
      <header className="admin-item__head">
        <span className="mono">#{row.id}</span>
        <span className="admin-chip">{kind ? <>{kind.icon} {t(kind.title)}</> : row.kind}</span>
        <span className={`admin-badge is-${row.status}`}>{t(STATUS[row.status])}</span>
        <span>{profName}</span>
        <span className="c-muted">{t(GRADES.find((g) => g.key === row.grade)?.label ?? { ko: row.grade, ja: row.grade })}</span>
        <span className="c-muted mono">{row.lang.toUpperCase()}</span>
        <span className="c-comment mono admin-item__date">
          {fmtDate(row.created_at)}
          {row.published_at && <> · {t('게시', '掲載')} {fmtDate(row.published_at)}</>}
        </span>
      </header>

      {editing && kind ? (
        <div className="admin-edit">
          {kind.fields.map((f) => (
            <label key={f.key} className={'admin-edit__field' + (err?.field === f.key ? ' is-invalid' : '')}>
              <span>{t(f.label)}{f.required && <span className="survey-q__req"> *</span>}</span>
              <EditInput field={f} profId={row.prof_id} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
            </label>
          ))}
          <p className="c-comment admin-edit__note">{t('# 개인이 특정될 수 있는 내용(이름 · 날짜 · 장소 등)은 지우거나 일반화해 주세요.', '# 個人が特定されうる内容（名前・日付・場所など）は削除または一般化してください。')}</p>
        </div>
      ) : (
        <>
          <AiBar row={row} showOriginal={showOriginal} setShowOriginal={setShowOriginal} />
          <div className={showOriginal ? 'admin-original' : undefined}>
            {showOriginal && <span className="admin-item__label">{t('제보자 원문', '投稿者の原文')}</span>}
            <ContribFields row={row} data={showOriginal ? row.original : row.data} />
          </div>
        </>
      )}

      {err && <p className="survey-error" role="alert">✗ {t(ERRORS[err.code] || ERRORS.default)}</p>}

      <footer className="admin-item__actions">
        {editing ? (
          <div className="admin-review">
            {publishable && (
              <button type="button" className="btn-primary btn-primary--sm admin-btn" disabled={busy}
                onClick={() => run({ data: draft, status: 'published' })}>{t('저장 후 게시', '保存して掲載')}</button>
            )}
            <button type="button" className="btn-outline admin-btn-sm" disabled={busy} onClick={() => run({ data: draft })}>{t('저장', '保存')}</button>
            <button type="button" className="admin-link" disabled={busy} onClick={() => setEditing(false)}>{t('취소', 'キャンセル')}</button>
          </div>
        ) : (
          <div className="admin-review">
            {publishable && (row.status === 'published' ? (
              <button type="button" className="btn-outline admin-btn-sm" disabled={busy} onClick={() => run({ status: 'reviewed' })}>{t('게시 내리기', '掲載を取り下げ')}</button>
            ) : (
              <button type="button" className="btn-primary btn-primary--sm admin-btn" disabled={busy} onClick={() => run({ status: 'published' })}>{t('✓ 게시', '✓ 掲載')}</button>
            ))}
            {kind && <button type="button" className="btn-outline admin-btn-sm" disabled={busy} onClick={startEdit}>{t('수정', '編集')}</button>}
            {kind && (
              <button type="button" className="admin-link" disabled={busy || row.ai_status === 'pending'} onClick={() => run(null, onOrganize)}>
                {busy ? t('정리 중…', '整理中…') : t('✨ AI로 다시 정리', '✨ AIで整理し直す')}
              </button>
            )}
            {changed && (
              <button type="button" className="admin-link" disabled={busy} onClick={() => run({ data: row.original })}>{t('원문으로 되돌리기', '原文に戻す')}</button>
            )}
            {row.status !== 'reviewed' && row.status !== 'published' && (
              <button type="button" className="admin-link" disabled={busy} onClick={() => run({ status: 'reviewed' })}>{publishable ? t('보류', '保留') : t('확인함', '確認済み')}</button>
            )}
            {row.status !== 'rejected' && (
              <button type="button" className="admin-link" disabled={busy} onClick={() => run({ status: 'rejected' })}>{t('반려', '却下')}</button>
            )}
            {row.status !== 'new' && (
              <button type="button" className="admin-link" disabled={busy} onClick={() => run({ status: 'new' })}>{t('대기로', '未確認に戻す')}</button>
            )}
          </div>
        )}
        <button type="button" className="admin-danger" onClick={onRemove}>{t('삭제', '削除')}</button>
      </footer>
    </article>
  );
}

function ContribList({ api, profs, filter, setFilter }) {
  const { t } = useLang();
  const [data, setData] = useState({ total: 0, rows: [] });
  const [page, setPage] = useState(0);
  const [q, setQ] = useState(filter.q);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const query = useCallback((extra = {}) => {
    const p = new URLSearchParams();
    for (const k of ['kind', 'prof', 'status', 'q']) if (filter[k]) p.set(k, filter[k]);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  }, [filter]);

  const load = useCallback(() => {
    setLoading(true);
    api(`/contrib?${query({ limit: PAGE, offset: page * PAGE })}`)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.code))
      .finally(() => setLoading(false));
  }, [api, query, page]);

  useEffect(() => { load(); }, [load]);
  const change = (next) => { setPage(0); setFilter(next); };

  /** 상태 변경 · 내용 수정 → 서버가 돌려준 행으로 바꿔 끼움. 실패하면 오류 코드를 그대로 던짐 (항목 표시용) */
  async function update(id, body) {
    const d = await api(`/contrib/${id}`, { method: 'PATCH', body });
    // 상태 필터가 걸려 있는데 상태가 바뀌면 목록에서 빠져야 하니 다시 불러오기
    if (filter.status && body.status && body.status !== filter.status) load();
    else setData((prev) => ({ ...prev, rows: prev.rows.map((r) => (r.id === id ? d.row : r)) }));
  }

  /** AI로 다시 정리 (원문에서 새로) */
  async function organize(id) {
    try {
      const d = await api(`/contrib/${id}/organize`, { method: 'POST' });
      setData((prev) => ({ ...prev, rows: prev.rows.map((r) => (r.id === id ? d.row : r)) }));
    } catch (e) {
      load(); // 실패해도 상태(failed 등)가 바뀌었을 수 있으니 다시 불러오기
      throw e;
    }
  }

  // AI 정리 중인 제보가 있으면 몇 초마다 새로고침
  const hasPending = data.rows.some((r) => r.ai_status === 'pending');
  useEffect(() => {
    if (!hasPending) return undefined;
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [hasPending, data, load]);

  async function remove(id) {
    if (!window.confirm(t(`#${id} 제보를 완전히 삭제할까요? 되돌릴 수 없어요.`, `#${id} の投稿を完全に削除しますか？元に戻せません。`))) return;
    try { await api(`/contrib/${id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.code); }
  }

  async function exportCsv() {
    try {
      const d = await api(`/contrib?${query({ limit: 1000, offset: 0 })}`);
      downloadCsv(d.rows, filter.kind);
    } catch (e) { setError(e.code); }
  }

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const profName = (id) => { const p = profs.find((x) => x.id === id); return p ? t(p.name_ko, p.name_ja) : id; };

  return (
    <div className="admin-list">
      <div className="admin-kind-tabs" role="group" aria-label={t('제보 종류', '投稿の種類')}>
        <button type="button" aria-pressed={!filter.kind} onClick={() => change({ ...filter, kind: '' })}>{t('전체', 'すべて')}</button>
        {KINDS.map((k) => (
          <button key={k.key} type="button" aria-pressed={filter.kind === k.key} onClick={() => change({ ...filter, kind: k.key })}>
            <span aria-hidden="true">{k.icon}</span> {t(k.title)}
          </button>
        ))}
      </div>

      <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); change({ ...filter, q: q.trim() }); }}>
        <select className="survey-input" value={filter.prof} onChange={(e) => change({ ...filter, prof: e.target.value })} aria-label={t('교수님', '教授')}>
          <option value="">{t('모든 교수님', 'すべての教授')}</option>
          {profs.map((p) => <option key={p.id} value={p.id}>{t(p.name_ko, p.name_ja)}</option>)}
        </select>
        <select className="survey-input" value={filter.status} onChange={(e) => change({ ...filter, status: e.target.value })} aria-label={t('상태', '状態')}>
          <option value="">{t('모든 상태', 'すべての状態')}</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
        </select>
        <input className="survey-input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t('내용 검색', '内容を検索')} />
        <button type="submit" className="btn-outline">{t('검색', '検索')}</button>
        <button type="button" className="btn-outline" onClick={exportCsv} disabled={!data.total}>CSV ↓</button>
      </form>

      <p className="admin-count mono">{data.total} {t('건', '件')}{loading && ' …'}</p>
      {error && <p className="survey-error" role="alert">✗ {t(ERRORS[error] || ERRORS.default)}</p>}

      {data.rows.map((r) => (
        <ContribItem key={r.id} row={r} profName={profName(r.prof_id)} onUpdate={(body) => update(r.id, body)}
          onOrganize={() => organize(r.id)} onRemove={() => remove(r.id)} />
      ))}
      {!loading && data.rows.length === 0 && <p className="c-muted">{t('조건에 맞는 제보가 없어요.', '条件に合う投稿がありません。')}</p>}

      {pages > 1 && (
        <nav className="admin-pager" aria-label={t('페이지', 'ページ')}>
          <button type="button" className="btn-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>←</button>
          <span className="mono">{page + 1} / {pages}</span>
          <button type="button" className="btn-outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>→</button>
        </nav>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- 챗봇 기록 */
function ChatLogs({ api, profs }) {
  const { t } = useLang();
  const [filter, setFilter] = useState({ prof: '', mode: '', q: '' });
  const [q, setQ] = useState('');
  const [data, setData] = useState({ total: 0, rows: [] });
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const p = new URLSearchParams({ limit: PAGE, offset: page * PAGE });
    if (filter.prof) p.set('prof', filter.prof);
    if (filter.mode) p.set('mode', filter.mode);
    if (filter.q) p.set('q', filter.q);
    setLoading(true);
    api(`/chat?${p}`)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.code))
      .finally(() => setLoading(false));
  }, [api, filter, page]);

  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    if (!window.confirm(t(`#${id} 기록을 삭제할까요?`, `#${id} の記録を削除しますか？`))) return;
    try { await api(`/chat/${id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.code); }
  }

  const change = (next) => { setPage(0); setFilter(next); };
  const pages = Math.max(1, Math.ceil(data.total / PAGE));

  return (
    <div className="admin-list">
      <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); change({ ...filter, q: q.trim() }); }}>
        <select className="survey-input" value={filter.prof} onChange={(e) => change({ ...filter, prof: e.target.value })} aria-label={t('교수님', '教授')}>
          <option value="">{t('모든 교수님', 'すべての教授')}</option>
          {profs.map((p) => <option key={p.id} value={p.id}>{t(p.name_ko, p.name_ja)}</option>)}
        </select>
        <select className="survey-input" value={filter.mode} onChange={(e) => change({ ...filter, mode: e.target.value })} aria-label={t('답변 방식', '回答方式')}>
          <option value="">{t('모든 답변 방식', 'すべての回答方式')}</option>
          {Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
        </select>
        <input className="survey-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('질문 · 답변 검색', '質問・回答を検索')} />
        <button type="submit" className="btn-outline">{t('검색', '検索')}</button>
      </form>

      <p className="admin-count mono">{data.total} {t('건', '件')}{loading && ' …'}</p>
      {error && <p className="survey-error" role="alert">✗ {t(ERRORS[error] || ERRORS.default)}</p>}

      {data.rows.map((r) => (
        <article className="card admin-item" key={r.id}>
          <header className="admin-item__head">
            <span className="mono">#{r.id}</span>
            <span className={`admin-badge is-${r.mode}`}>{MODES[r.mode] ? t(MODES[r.mode]) : r.mode}</span>
            <span>{r.prof_id}</span>
            <span className="c-muted mono">{(r.lang || '').toUpperCase()}</span>
            {r.top_score != null && <span className="c-muted mono">score {Number(r.top_score).toFixed(2)}</span>}
            <span className="c-comment mono admin-item__date">{fmtDate(r.created_at)}</span>
          </header>
          <p className="admin-item__episode"><span className="c-green mono">Q </span>{r.question}</p>
          {r.answer && (
            <details className="admin-answer">
              <summary>{t('답변 보기', '回答を見る')}</summary>
              <p>{r.answer}</p>
            </details>
          )}
          <footer className="admin-item__actions">
            <span />
            <button type="button" className="admin-danger" onClick={() => remove(r.id)}>{t('삭제', '削除')}</button>
          </footer>
        </article>
      ))}
      {!loading && data.rows.length === 0 && <p className="c-muted">{t('기록이 없어요.', '記録がありません。')}</p>}

      {pages > 1 && (
        <nav className="admin-pager" aria-label={t('페이지', 'ページ')}>
          <button type="button" className="btn-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>←</button>
          <span className="mono">{page + 1} / {pages}</span>
          <button type="button" className="btn-outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>→</button>
        </nav>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- 페이지 */
export default function AdminPage() {
  const { t } = useLang();
  const [token, setToken] = useState(readToken);
  const [tab, setTab] = useState('overview');
  const [profs, setProfs] = useState([]);
  const [contribFilter, setContribFilter] = useState({ kind: '', prof: '', status: '', q: '' });

  const logoutLocal = useCallback(() => { writeToken(''); setToken(''); }, []);
  const api = useApi(token, logoutLocal);

  useEffect(() => {
    document.title = t('관리자 — GSC 교수님 사용 설명서', '管理者 — GSC教授 取扱説明書');
    // 검색엔진에 노출되지 않도록
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  });

  useEffect(() => {
    fetch('/api/profs').then((r) => r.json()).then(setProfs).catch(() => setProfs([]));
  }, []);

  const login = (tk) => { writeToken(tk); setToken(tk); };
  const logout = async () => {
    try { await api('/logout', { method: 'POST' }); } catch { /* 무시 */ }
    logoutLocal();
  };
  const openContrib = (f) => { setContribFilter({ kind: '', prof: '', status: '', q: '', ...f }); setTab('contrib'); };

  const TABS = [
    { key: 'overview', label: { ko: '개요', ja: '概要' } },
    { key: 'contrib', label: { ko: '섹션별 제보', ja: 'セクション別の投稿' } },
    { key: 'chat', label: { ko: '챗봇 기록', ja: 'チャットボット記録' } },
  ];

  return (
    <div className="admin">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link className="brand" to="/">
            <span className="brand__home">~/gsc</span>
            <span className="brand__sep">/</span>
            <span className="brand__name">admin</span>
          </Link>
          {token && (
            <nav className="admin-tabs" aria-label={t('관리자 메뉴', '管理者メニュー')}>
              {TABS.map((x) => (
                <button key={x.key} type="button" className={tab === x.key ? 'active' : ''} aria-current={tab === x.key ? 'page' : undefined}
                  onClick={() => setTab(x.key)}>{t(x.label)}</button>
              ))}
            </nav>
          )}
          <div className="admin-actions">
            <ThemeToggle />
            <LangToggle />
            {token && <button type="button" className="btn-outline admin-btn-sm" onClick={logout}>{t('로그아웃', 'ログアウト')}</button>}
          </div>
        </div>
      </header>

      <main>
        {!token ? <Login onLogin={login} /> : (
          <div className="container admin-body">
            {tab === 'overview' && <Overview api={api} onOpen={openContrib} />}
            {tab === 'contrib' && <ContribList api={api} profs={profs} filter={contribFilter} setFilter={setContribFilter} />}
            {tab === 'chat' && <ChatLogs api={api} profs={profs} />}
          </div>
        )}
      </main>
    </div>
  );
}
