import { useState } from 'react';
import SectionHead from '../SectionHead.jsx';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import Pending from '../Pending.jsx';
import ContribBadge from '../ContribBadge.jsx';

const STAR_PATH = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';

// 별점: 마우스 오버 미리보기 + 클릭 고정
function Rating() {
  const [picked, setPicked] = useState(0);
  const [hover, setHover] = useState(0);
  const { t } = useLang();
  const shown = hover || picked;
  return (
    <div className="rating">
      <span className="rating__q">{t('도움이 됐나요?', '役に立ちましたか？')}</span>
      <div className="stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={'star' + (n <= shown ? ' is-on' : '')}
            aria-label={t(`별 ${n}개`, `星${n}つ`)}
            aria-pressed={picked === n}
            onMouseEnter={() => setHover(n)}
            onClick={() => setPicked(n)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR_PATH} /></svg>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 상황 카드 하나 — 홈 섹션과 /scenes 페이지가 같이 씀 */
export function SceneCard({ scene: s, index: i, active = true, tabbed = false }) {
  const { t } = useLang();
  return (
    <article
      className={'card scene' + (active ? ' is-active' : '')}
      id={tabbed ? `scene-${i}` : undefined}
      role={tabbed ? 'tabpanel' : undefined}
      aria-labelledby={tabbed ? `scene-tab-${i}` : undefined}
    >
      <div className="scene__file">{s.file}</div>
      <div className="scene__body">
        <div>
          <h3 className="scene__title">{t(s.title)} <ContribBadge contrib={s.contrib} /></h3>
        </div>
        <div className="checklist">
          {s.items.map((it, j) => (
            <label className="check" key={j}>
              <input type="checkbox" />
              <span>{t(it)}{!s.contrib && <> <ContribBadge contrib={it.contrib} /></>}</span>
            </label>
          ))}
        </div>
        {t(s.tip) && <p className="tip"><span className="tip__label">{t('# 선배 tip', '# 先輩のtip')}</span><br />{t(s.tip)}</p>}
        <Rating />
      </div>
    </article>
  );
}

/** 홈 섹션 (모바일에서는 탭으로 하나씩) */
export default function Scenes() {
  const [activeTab, setActiveTab] = useState(0);
  const { scenes } = useProf().prof;
  const { t } = useLang();

  return (
    <section className="section section--alt" id="scenes" aria-labelledby="scenes-h">
      <div className="container">
        <SectionHead file="// 02 scenes/" id="scenes-h" title={t('상황별 가이드', '場面別ガイド')} />

        {scenes.length === 0 && <Pending kind="scene" />}
        {/* 탭은 모바일에서만 보임 (CSS) */}
        <div className="scene-tabs" role="tablist">
          {scenes.map((s, i) => (
            <button
              key={s.tab}
              type="button"
              role="tab"
              className="scene-tab"
              id={`scene-tab-${i}`}
              aria-controls={`scene-${i}`}
              aria-selected={activeTab === i}
              onClick={() => setActiveTab(i)}
            >
              {s.tab}
            </button>
          ))}
        </div>

        <div className="scenes">
          {scenes.map((s, i) => (
            <SceneCard key={s.file} scene={s} index={i} active={activeTab === i} tabbed />
          ))}
        </div>
      </div>
    </section>
  );
}
