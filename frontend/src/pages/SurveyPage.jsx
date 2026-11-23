import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageLayout from '../components/page/PageLayout.jsx';
import PageHero from '../components/page/PageHero.jsx';
import { SceneCard } from '../components/home/Scenes.jsx';
import { Diagnostics } from '../components/home/Warnings.jsx';
import ContribBadge from '../components/ContribBadge.jsx';
import { GRADES, KINDS, NEW_SCENE, kindOf, resolveOptions } from '../data/contrib.js';
import { SURVEY_PATH, TAG_LABEL } from '../data/siteData.js';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

/* ==========================================================================
   /survey        제보 종류 고르기 (홈 섹션 순서)
   /survey/:kind  섹션 항목 모양 그대로 받는 폼 + 홈에 올라갈 모습 미리보기
   ========================================================================== */

const ERRORS = {
  missing_grade: { ko: '학년을 골라 주세요.', ja: '学年を選んでください。' },
  missing_field: { ko: '필수 항목을 채워 주세요. (이모지만으로는 저장되지 않아요)', ja: '必須項目を入力してください。（絵文字だけでは保存されません）' },
  too_many_requests: { ko: '잠시 후 다시 보내 주세요. (1분에 5번까지)', ja: '少し時間をおいてから送信してください。（1分に5回まで）' },
  unknown_professor: { ko: '교수님 정보를 찾을 수 없어요.', ja: '教授の情報が見つかりません。' },
  network: { ko: '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.', ja: 'サーバーに接続できません。しばらくしてから再度お試しください。' },
};

const emptyFor = (kind) => Object.fromEntries([
  ['grade', ''], ['website', ''],
  ...kind.fields.map((f) => [f.key, f.type === 'multi' ? [] : '']),
]);
const linesOf = (v) => String(v || '').split('\n').map((s) => s.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim()).filter(Boolean);
const visible = (f, form) => !f.showIf || f.showIf(form);

/** 질문 카드 하나 */
function Q({ no, field, children, invalid }) {
  const { t } = useLang();
  const group = field.type === 'choice' || field.type === 'multi';
  const Wrap = group ? 'fieldset' : 'div';
  const Head = group ? 'legend' : 'label';
  return (
    <Wrap className={'card survey-q' + (invalid ? ' is-invalid' : '')}>
      <Head className="survey-q__title" htmlFor={group ? undefined : `sv-${field.key}`}>
        <span className="survey-q__no">{String(no).padStart(2, '0')}</span>
        {t(field.label)}
        {field.required
          ? <span className="survey-q__req" aria-label={t('필수', '必須')}> *</span>
          : <span className="survey-q__opt"> {t('(선택)', '（任意）')}</span>}
      </Head>
      {field.desc && <p className="survey-q__desc">{t(field.desc)}</p>}
      {children}
    </Wrap>
  );
}

/** 항목 type 에 맞는 입력 */
function Input({ field, value, onChange, options }) {
  const { t } = useLang();
  const id = `sv-${field.key}`;
  if (field.type === 'text' || field.type === 'textarea' || field.type === 'lines') {
    const Tag = field.type === 'text' ? 'input' : 'textarea';
    const count = field.type === 'lines' ? linesOf(value).length : value.length;
    const max = field.max;
    return (
      <>
        <Tag id={id} className="survey-input" maxLength={field.type === 'lines' ? undefined : max}
          rows={field.type === 'text' ? undefined : field.type === 'lines' ? 5 : 4}
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ? t(field.placeholder) : undefined} />
        {field.type !== 'text' && (
          <span className={'survey-count' + (count > max ? ' is-over' : count > max * 0.9 ? ' is-near' : '')}>
            {count}/{max}{field.type === 'lines' ? t('줄', '行') : ''}
          </span>
        )}
      </>
    );
  }
  const multi = field.type === 'multi';
  const row = !multi && options.length <= 4 && !options.some((o) => o.mono);
  return (
    <div className={'survey-opts' + (row ? ' survey-opts--row' : '')}>
      {options.map((o) => {
        const checked = multi ? value.includes(o.key) : value === o.key;
        return (
          <label key={o.key} className="survey-opt">
            <input type={multi ? 'checkbox' : 'radio'} name={field.key} checked={checked}
              onChange={() => onChange(multi ? (checked ? value.filter((v) => v !== o.key) : [...value, o.key]) : o.key)} />
            <span>
              {o.mono && <span className="survey-opt__mono mono">{o.mono}</span>}
              {t(o.label)}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- 홈에 올라갈 모습 미리보기 */
function Preview({ kind, form }) {
  const { prof } = useProf();
  const { t, lang } = useLang();
  const mine = { lang };
  const same = (s) => ({ ko: s, ja: s });
  const ph = (f) => t(kind.fields.find((x) => x.key === f)?.placeholder || { ko: '', ja: '' }).split('\n')[0].replace(/^예:\s*|^例：/, '');

  let body = null;
  if (kind.key === 'traits') {
    const picked = new Set(form.traits);
    const opts = resolveOptions(kind.fields[0], prof);
    body = (
      <div className="card traits__chart preview-traits">
        {opts.map((o) => {
          const base = prof.traits?.find((tr) => tr.label.ko === o.key)?.pct ?? 0;
          return (
            <div className={'bar' + (picked.has(o.key) ? ' is-picked' : '')} key={o.key}>
              <div className="bar__head">
                <span className="bar__label">{t(o.label)}{picked.has(o.key) && <span className="contrib-badge">+1</span>}</span>
                <span className="bar__pct">{base}%</span>
              </div>
              <div className="bar__track"><div className="bar__fill" style={{ width: `${base}%` }} /></div>
            </div>
          );
        })}
      </div>
    );
  } else if (kind.key === 'scene') {
    const items = linesOf(form.items).map((s) => ({ ...same(s), contrib: mine }));
    const tipItem = form.tip.trim() ? [{ ...same(form.tip.trim()), contrib: mine }] : [];
    const existing = form.scene && form.scene !== NEW_SCENE ? prof.scenes.find((s) => s.tab === form.scene) : null;
    const scene = existing
      ? { ...existing, items: [...existing.items, ...items, ...tipItem] }
      : { file: 'scenes/NN_senpai.md', tab: 'new', title: same(form.title.trim() || ph('title')), tip: same(form.tip.trim()), items: items.length ? items : [same(ph('items'))], contrib: mine };
    body = form.scene ? <SceneCard scene={scene} index={0} /> : <p className="c-muted">{t('상황 카드를 고르면 미리보기가 보여요.', '場面カードを選ぶとプレビューが表示されます。')}</p>;
  } else if (kind.key === 'warning') {
    const level = form.level || 'warning';
    const n = (prof.warnings?.length || 0) + 1;
    const id = `${{ warning: 'W', hint: 'H', error: 'E', note: 'N' }[level]}${String(n).padStart(2, '0')}`;
    body = <Diagnostics full items={[{ level, id, title: same(form.title.trim() || ph('title')), msg: same(form.msg.trim() || ph('msg')), contrib: mine }]} />;
  } else if (kind.key === 'talk') {
    body = (
      <article className="talk">
        <span className="talk__key">senpai_new:</span>
        <h3 className="talk__title">{form.title.trim() || ph('title')} <ContribBadge contrib={mine} /></h3>
        <p className="talk__body">{form.body.trim() || ph('body')}</p>
      </article>
    );
  } else if (kind.key === 'dict') {
    const tag = form.tag || '추정';
    const meaning = form.meaning.trim() || (lang === 'ja' ? '意味を調査中' : '의미 조사 중');
    body = (
      <article className="card entry">
        <div className="entry__top">
          <h2 className="entry__term">{form.term.trim() || ph('term')}</h2>
          <span className="entry__tag">@{t(TAG_LABEL[tag])}</span>
          <ContribBadge contrib={mine} />
        </div>
        <dl><div><dt>ko</dt><dd className="ko">{meaning}</dd></div></dl>
        {form.tip.trim() && <p className="tip"><span className="tip__label"># tip </span>{form.tip.trim()}</p>}
      </article>
    );
  }
  if (!body) return null;
  return (
    <aside className="contrib-preview" aria-label={t('미리보기', 'プレビュー')}>
      <p className="contrib-preview__head mono">
        <span className="c-comment">// preview — {kind.file}</span>
        <span className="c-muted"> {t('게시되면 이렇게 보여요 (AI 정리 · 관리자 검수 후)', '掲載されるとこう見えます（AI整理・管理者の確認後）')}</span>
      </p>
      {body}
    </aside>
  );
}

/** 종류 탭 (모든 종류로 바로 이동) */
function KindTabs({ current }) {
  const { t } = useLang();
  return (
    <nav className="contrib-tabs" aria-label={t('제보 종류', '投稿の種類')}>
      {KINDS.map((k) => (
        <Link key={k.key} to={`${SURVEY_PATH}/${k.key}`} className="contrib-tab" aria-current={current === k.key ? 'page' : undefined}>
          <span aria-hidden="true">{k.icon}</span> {t(k.title)}
        </Link>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------- 종류 고르기 */
function KindPicker() {
  const { t } = useLang();
  return (
    <div className="contrib-grid">
      {KINDS.map((k) => (
        <Link key={k.key} to={`${SURVEY_PATH}/${k.key}`} className="card contrib-card">
          <span className="contrib-card__icon" aria-hidden="true">{k.icon}</span>
          <span className="contrib-card__file mono">// {k.file}</span>
          <strong>{t(k.title)}</strong>
          <span className="c-muted">{t(k.desc)}</span>
          <span className="contrib-card__cmd mono">$ {k.cmd} →</span>
        </Link>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- 종류별 폼 */
function KindForm({ kind }) {
  const { profId, prof } = useProf();
  const { t, lang } = useLang();
  const [form, setForm] = useState(() => emptyFor(kind));
  const [state, setState] = useState('idle'); // idle | sending | done
  const [error, setError] = useState(null);   // { code, field? }

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const fields = kind.fields.filter((f) => visible(f, form));
  const isEmpty = (f) => (f.type === 'multi' ? form[f.key].length === 0 : f.type === 'lines' ? linesOf(form[f.key]).length === 0 : !String(form[f.key]).trim());

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.grade) return setError({ code: 'missing_grade', field: 'grade' });
    const missing = fields.find((f) => f.required && isEmpty(f));
    if (missing) return setError({ code: 'missing_field', field: missing.key });
    if (kind.oneOf && kind.fields.filter((f) => kind.oneOf.includes(f.key)).every(isEmpty)) {
      return setError({ code: 'missing_field', field: kind.oneOf[0] });
    }

    // 보이지 않는 항목은 빼고, 목록은 배열로
    const payload = { grade: form.grade, website: form.website, kind: kind.key, profId, lang };
    for (const f of fields) payload[f.key] = f.type === 'lines' ? linesOf(form[f.key]).slice(0, f.max) : form[f.key];

    setState('sending');
    try {
      const res = await fetch('/api/contrib', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError({ code: ERRORS[data.error] ? data.error : 'network', field: data.field });
        setState('idle');
        return;
      }
      setState('done');
      window.scrollTo(0, 0);
    } catch {
      setError({ code: 'network' });
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className="card survey-done" role="status">
        <p className="mono">$ {kind.cmd} --anon<br />✓ 1 file changed — {t('제보 완료!', '投稿完了！')}</p>
        <h2>{t(`고마워요! ${t(kind.title)} 제보가 저장됐어요.`, `ありがとうございます！${t(kind.title)}の投稿が保存されました。`)}</h2>
        <p>{kind.key === 'other'
          ? t('보내 주신 의견은 관리자가 확인해요. 사이트에 공개되지는 않아요.', 'いただいた意見は管理者が確認します。サイトには公開されません。')
          : t(`AI가 문장을 다듬고 개인정보를 지운 뒤, 관리자가 검수해서 ${t(kind.title)} 섹션에 올라가요. 바로 보이지 않아도 걱정 마세요!`, `AIが文章を整えて個人情報を取り除き、管理者が確認したあと「${t(kind.title)}」に載ります。すぐに表示されなくても大丈夫です！`)}</p>
        <div className="survey-done__actions">
          <button type="button" className="btn-primary" onClick={() => { setForm(emptyFor(kind)); setState('idle'); }}>
            {t('같은 종류 하나 더', '同じ種類をもう一つ')}
          </button>
          <Link className="btn-outline" to={SURVEY_PATH}>{t('다른 종류 제보하기', 'ほかの種類を投稿する')}</Link>
          {kind.page && <Link className="btn-outline" to={kind.page}>{t(`${t(kind.title)} 보기`, `${t(kind.title)}を見る`)}</Link>}
        </div>
      </div>
    );
  }

  const gradeField = { key: 'grade', type: 'choice', required: true, label: { ko: '학년을 알려 주세요', ja: '学年を教えてください' } };

  return (
    <div className="contrib-layout">
      <form className="survey" onSubmit={submit} noValidate>
        {/* 봇 함정 — 사람에게는 보이지 않음 */}
        <div className="survey-trap" aria-hidden="true">
          <label>website <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website')(e.target.value)} /></label>
        </div>

        <p className="contrib-target c-muted">
          <span aria-hidden="true">{kind.icon} </span>
          {t(<><strong>{t(prof.name)}</strong> · <span className="mono">{kind.file}</span> 섹션에 제보</>, <><strong>{t(prof.name)}</strong> · <span className="mono">{kind.file}</span> に投稿</>)}
          {kind.oneOf && <span> · {t('아래 중 하나 이상 적어 주세요', '下のどれか一つ以上を書いてください')}</span>}
        </p>
        <p className="contrib-review mono">
          {kind.key === 'other'
            ? t('# 관리자만 보는 의견이에요 (사이트에 공개되지 않음)', '# 管理者だけが見る意見です（サイトには公開されません）')
            : t('# 제보 → AI 정리(오타 · 개인정보) → 관리자 검수 → 섹션에 추가. 편하게 적어 주세요!', '# 投稿 → AI整理（誤字・個人情報）→ 管理者の確認 → セクションに追加。気軽に書いてください！')}
        </p>

        <Q no={1} field={gradeField} invalid={error?.field === 'grade'}>
          <Input field={gradeField} options={GRADES} value={form.grade} onChange={set('grade')} />
        </Q>
        {fields.map((f, i) => (
          <Q key={f.key} no={i + 2} field={f} invalid={error?.field === f.key}>
            <Input field={f} options={resolveOptions(f, prof)} value={form[f.key]} onChange={set(f.key)} />
          </Q>
        ))}

        <div className="survey-submit">
          {error && <p className="survey-error" role="alert">✗ {t(ERRORS[error.code])}</p>}
          <p className="c-comment mono">{t('# 한국어 · 日本語 어느 쪽으로 써도 괜찮아요', '# 日本語・한국어 どちらで書いても大丈夫です')}</p>
          <button type="submit" className="btn-primary" disabled={state === 'sending'}>
            {state === 'sending' ? t('보내는 중…', '送信中…') : `$ ${kind.cmd} --anon`}
          </button>
        </div>
      </form>
      <Preview kind={kind} form={form} />
    </div>
  );
}

/* ---------------------------------------------------------------- 페이지 */
export default function SurveyPage() {
  const { kind: kindKey } = useParams();
  const { prof } = useProf();
  const { t } = useLang();
  const kind = kindOf(kindKey);
  const short = t(prof.short);

  return (
    <PageLayout path={kind ? `/contrib/${kind.key}` : '/CONTRIBUTING.md'} title={{ ko: '제보하기', ja: '投稿する' }}>
      <PageHero
        file={`// 06 CONTRIBUTING.md${kind ? ` — ${kind.file}` : ''}`}
        title={kind
          ? t(`${short} 교수님 ${t(kind.title)} 제보`, `${short}教授の${t(kind.title)}を投稿`)
          : t(`${short} 교수님 경험 제보하기`, `${short}教授の体験を投稿する`)}
        lead={kind ? t(kind.desc) : t('홈의 어느 섹션에 더하고 싶나요?', 'ホームのどのセクションに追加しますか？')}
        desc={t(
          '이름 · 이메일은 받지 않는 익명 제보예요. 몇 번이든 보내도 OK. AI가 다듬고 관리자가 검수한 뒤 홈 섹션에 그대로 추가돼요.',
          '名前・メールアドレスは収集しない匿名の投稿です。何度送ってもOK。AIが整えて管理者が確認したあと、ホームのセクションにそのまま追加されます。'
        )}
      />
      <section className="container page-body">
        {kind ? (
          <>
            <KindTabs current={kind.key} />
            {/* key: 종류 · 교수님을 바꾸면 폼 초기화 */}
            <KindForm key={kind.key} kind={kind} />
          </>
        ) : <KindPicker />}
      </section>
    </PageLayout>
  );
}
