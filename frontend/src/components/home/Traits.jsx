import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SectionHead from '../SectionHead.jsx';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import Pending from '../Pending.jsx';

/** 성향 막대 그래프 + 요약 — 홈 섹션과 /traits 페이지가 같이 씀 */
export function TraitsBody() {
  const chartRef = useRef(null);
  const [grown, setGrown] = useState(false);
  const { traits, survey, traitsLead, traitsSub } = useProf().prof;
  const { t } = useLang();

  // 화면에 보일 때 막대가 차오르는 효과
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setGrown(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setGrown(true); io.disconnect(); }
    }, { threshold: 0.3 });
    if (chartRef.current) io.observe(chartRef.current);
    return () => io.disconnect();
  }, [traits]);

  if (traits.length === 0) return <Pending kind="traits" />;

  return (
    <div className="traits">
      <div className="card traits__chart">
        <p className="traits__cmd">
          $ survey --summary --n={survey?.n ?? 0}  {survey?.note && <span className="c-muted"># {t(survey.note)}</span>}
        </p>
        <div ref={chartRef} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {traits.map((tr, i) => (
            <div className="bar" key={i}>
              <div className="bar__head">
                <span className="bar__label">
                  {t(tr.label)}
                  {tr.contrib && <span className="contrib-badge">{t(`+${tr.contrib.votes} 선배 제보`, `+${tr.contrib.votes} 先輩の投稿`)}</span>}
                </span>
                <span className="bar__pct">{tr.pct}%</span>
              </div>
              <div className="bar__track" role="presentation">
                <div className="bar__fill" style={{ width: grown ? tr.pct + '%' : 0 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="traits__summary">
        <p className="traits__lead">{t(traitsLead)}</p>
        <p className="traits__sub">
          {traitsSub && <>{t(traitsSub)} </>}
          {t(
            <>학생들이 남긴 한마디는 <Link to="/#thread">thread.log</Link>에서.</>,
            <>学生たちのひとことは <Link to="/#thread">thread.log</Link> で。</>
          )}
        </p>
      </div>
    </div>
  );
}

/** 홈 섹션 */
export default function Traits() {
  const { t } = useLang();
  return (
    <section className="section" id="traits" aria-labelledby="traits-h">
      <div className="container">
        <SectionHead file="// 01 traits.json" id="traits-h" title={t('성향 분석', '性格分析')} />
        <TraitsBody />
      </div>
    </section>
  );
}
