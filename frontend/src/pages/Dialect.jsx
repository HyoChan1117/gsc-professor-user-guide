import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav.jsx';
import SiteHeader from '../components/SiteHeader.jsx';
import ProfSwitch from '../components/ProfSwitch.jsx';
import ContribBadge from '../components/ContribBadge.jsx';
import Pending from '../components/Pending.jsx';
import { DICT_TAGS, TAG_LABEL, SURVEY_PATH } from '../data/siteData.js';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

export default function Dialect() {
  const [filter, setFilter] = useState('전체');
  const { prof } = useProf();
  const { t, lang } = useLang();
  const { dict } = prof;
  const rows = filter === '전체' ? dict : dict.filter((e) => e.tag === filter);
  const short = t(prof.short);

  useEffect(() => {
    document.title = t('말버릇·사투리 사전', '口癖・方言辞典');
  });

  return (
    <>
      <SiteHeader path="/dialect.dict" />

      <main>
        <section className="dict-hero">
          <div className="container">
            <span className="sec-file">// 04 dialect.dict</span>
            <ProfSwitch />
            <h1>{t(`${short} 교수님 말버릇 · 사투리 사전`, `${short}教授の口癖・方言辞典`)}</h1>
            <p className="dict-hero__ja">
              {t('처음 들으면 알아듣기 힘든 표현을 표준어와 일본어로.', '初めて聞くと分かりにくい表現を、標準語と日本語で。')}
            </p>
            <p className="dict-hero__desc">
              {prof.dictDesc && <>{t(prof.dictDesc)} </>}
              {t(
                <>의미가 확실하지 않은 표현은 <span className="c-yellow mono">@추정</span>으로 표시했어요.</>,
                <>意味がはっきりしない表現は <span className="c-yellow mono">@推定</span> と表示しています。</>
              )}
            </p>
          </div>
        </section>

        <section className="container dict-body">
          <div className="dict-toolbar">
            <div className="filters" role="group" aria-label={t('태그 필터', 'タグで絞り込み')}>
              {DICT_TAGS.map((tag) => (
                <button key={tag} type="button" className="filter" aria-pressed={filter === tag} onClick={() => setFilter(tag)}>
                  {tag === '전체' ? '*' : '@' + t(TAG_LABEL[tag])}
                </button>
              ))}
            </div>
            <p className="dict-count" aria-live="polite">{rows.length} entries</p>
          </div>

          {dict.length === 0 && <Pending kind="dict" />}
          <div className="entries">
            {rows.map((e, i) => (
              <article className="card entry" key={`${e.term}-${i}`}>
                <div className="entry__top">
                  <h2 className="entry__term">{e.term}</h2>
                  <span className="entry__tag">@{t(TAG_LABEL[e.tag])}</span>
                  <ContribBadge contrib={e.contrib} />
                </div>
                {/* KO: 표준어 뜻만 / JA: 표준어 + 일본어 뜻 */}
                <dl>
                  <div><dt>ko</dt><dd className="ko">{e.ko}</dd></div>
                  {lang === 'ja' && <div><dt>ja</dt><dd className="ja">{e.ja}</dd></div>}
                </dl>
                {t(e.tip) && <p className="tip"><span className="tip__label"># tip </span>{t(e.tip)}</p>}
              </article>
            ))}
          </div>


          <div className="card dict-cta">
            <div>
              <h2>{t('새로운 말버릇을 들었나요?', '新しい口癖を聞きましたか？')}</h2>
              <p>{t('들은 말버릇을 알려 주세요. 의미를 몰라도 괜찮아요!', '聞いた口癖を教えてください。意味が分からなくても大丈夫！')}</p>
            </div>
            <Link className="btn-primary" to={`${SURVEY_PATH}/dict`}>$ dict add --anon</Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
