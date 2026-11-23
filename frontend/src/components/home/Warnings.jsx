import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import Pending from '../Pending.jsx';
import ContribBadge from '../ContribBadge.jsx';

export const LEVEL_COLOR = { warning: 'c-yellow', hint: 'c-green', error: 'c-pink', note: 'c-blue' };

/** 주의사항 목록 — 홈 섹션과 /warnings 페이지가 같이 씀
 *  full: 모바일에서도 설명까지 모두 보이기 */
export function Diagnostics({ items, full = false }) {
  const { t } = useLang();
  if (items.length === 0) return <Pending kind="warning" />;
  return (
    <div className={'card diagnostics' + (full ? ' diagnostics--full' : '')}>
      {items.map((w) => (
        <div key={w.id}>
          <span className={'diag__code ' + (LEVEL_COLOR[w.level] || '')}>
            {w.level}<span className="diag__id">[{w.id}]</span>
          </span>
          : <strong>{t(w.title)}</strong> <ContribBadge contrib={w.contrib} />
          <br />
          <span className="diag__arrow">  --&gt;</span> <span className="diag__msg">{t(w.msg)}</span>
        </div>
      ))}
    </div>
  );
}

/** 홈 섹션 */
export default function Warnings() {
  const { warnings } = useProf().prof;
  const { t } = useLang();
  return (
    <section className="section section--warn" id="warnings" aria-labelledby="warn-h">
      <div className="container">
        <h2 className="warn-title" id="warn-h">{t('사용 시 주의사항', 'ご使用上の注意')}</h2>
        <Diagnostics items={warnings} />
      </div>
    </section>
  );
}
