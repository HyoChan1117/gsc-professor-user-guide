import { useState } from 'react';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';

const MOODS = [
  { key: 'sunny', label: { ko: '맑음', ja: '晴れ' }, mod: 'mood-btn--sunny' },
  { key: 'cloudy', label: { ko: '흐림', ja: 'くもり' }, mod: '' },
  { key: 'alert', label: { ko: '주의보', ja: '注意報' }, mod: 'mood-btn--alert' },
];

const EMPTY = { mood: '—', reason: { ko: '집계 전', ja: '集計前' }, votes: 0 };

export default function Status() {
  const [vote, setVote] = useState(null);
  const status = useProf().prof.status || EMPTY;
  const { t } = useLang();
  const votes = status.votes + (vote ? 1 : 0);

  return (
    <section className="container status-wrap" aria-labelledby="status-h">
      <div className="card status">
        <div className="status__info">
          <h2 className="status__title" id="status-h">STATUS <span>(beta)</span></h2>
          <span><span className="c-muted">mood:</span> <span className="c-green" style={{ fontWeight: 700 }}>{t(status.mood)}</span></span>
          <span><span className="c-muted">reason:</span> {t(status.reason)}</span>
          <span><span className="c-muted">votes:</span> {t(`오늘 ${votes}표`, `今日 ${votes}票`)}</span>
        </div>
        <div className="status__vote">
          <span className="status__q">{t('오늘 분위기는?', '今日の雰囲気は？')}</span>
          <div className="mood-btns">
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={('mood-btn ' + m.mod).trim()}
                aria-pressed={vote === m.key}
                onClick={() => setVote(m.key)}
              >
                <span>{t(m.label)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
