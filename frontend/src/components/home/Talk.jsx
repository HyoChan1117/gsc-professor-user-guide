import SectionHead from '../SectionHead.jsx';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import Pending from '../Pending.jsx';
import ContribBadge from '../ContribBadge.jsx';

/** 스몰토크 카드 그리드 — 홈 섹션과 /talk 페이지가 같이 씀 */
export function TalkGrid() {
  const { talk } = useProf().prof;
  const { t } = useLang();
  if (talk.length === 0) return <Pending kind="talk" />;
  return (
    <div className="talk-grid">
      {talk.map((k) => (
        <article className="talk" key={k.key}>
          <span className="talk__key">{k.key}:</span>
          <h3 className="talk__title">{t(k.title)} <ContribBadge contrib={k.contrib} /></h3>
          <p className="talk__body">{t(k.body)}</p>
        </article>
      ))}
    </div>
  );
}

/** 홈 섹션 */
export default function Talk() {
  const { t } = useLang();
  return (
    <section className="section section--alt" id="talk" aria-labelledby="talk-h">
      <div className="container">
        <SectionHead file="// 03 smalltalk.yml" id="talk-h" title={t('스몰토크 소재', '雑談ネタ')} />
        <TalkGrid />
      </div>
    </section>
  );
}
