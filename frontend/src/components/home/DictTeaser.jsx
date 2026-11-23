import { Link } from 'react-router-dom';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import Pending from '../Pending.jsx';

export default function DictTeaser() {
  const { dictPreview } = useProf().prof;
  const { t, lang } = useLang();
  return (
    <section className="section" aria-labelledby="dict-h">
      <div className="container dict-teaser">
        <div className="dict-teaser__intro">
          <span className="sec-file">// 04 dialect.dict</span>
          <h2 className="sec-title" id="dict-h">{t('말버릇 · 사투리 사전', '口癖・方言辞典')}</h2>
          <p>{t('처음 들으면 알아듣기 힘든 표현을 표준어와 일본어로 번역.', '初めて聞くと分かりにくい表現を、標準語と日本語で。')}</p>
          <Link className="btn-outline" to="/dialect">open dialect.dict →</Link>
        </div>
        {dictPreview.length === 0 ? <Pending kind="dict" /> : <div className="card dict-teaser__list">
          {dictPreview.map((d) => (
            <div key={d.term}>
              <span className="c-green">"{d.term}"</span> <span className="c-comment">→</span> {lang === 'ja' ? d.ja : d.ko}
            </div>
          ))}
        </div>}
      </div>
    </section>
  );
}
