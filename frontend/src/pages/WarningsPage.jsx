import { useState } from 'react';
import PageLayout from '../components/page/PageLayout.jsx';
import PageHero from '../components/page/PageHero.jsx';
import PageCta from '../components/page/PageCta.jsx';
import { Diagnostics, LEVEL_COLOR } from '../components/home/Warnings.jsx';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

const LEVELS = [
  { key: 'all', label: { ko: '전체', ja: 'すべて' } },
  { key: 'warning', label: { ko: '경고', ja: '警告' } },
  { key: 'hint', label: { ko: '팁', ja: 'ヒント' } },
  { key: 'error', label: { ko: '금지', ja: '禁止' } },
  { key: 'note', label: { ko: '참고', ja: '参考' } },
];

/** /warnings — 주의사항 (단계별 필터) */
export default function WarningsPage() {
  const { prof } = useProf();
  const { t } = useLang();
  const [level, setLevel] = useState('all');
  const short = t(prof.short);
  const { warnings } = prof;
  const rows = level === 'all' ? warnings : warnings.filter((w) => w.level === level);
  const count = (key) => (key === 'all' ? warnings.length : warnings.filter((w) => w.level === key).length);

  return (
    <PageLayout path="/warnings.log" title={{ ko: '주의사항', ja: '注意事項' }}>
      <PageHero
        file="// warnings.log"
        title={t(`${short} 교수님 사용 시 주의사항`, `${short}教授 ご使用上の注意`)}
        lead={t('이것만은 알고 가자.', 'これだけは知っておこう。')}
        desc={t(
          '컴파일러 메시지처럼 단계별로 정리했어요. error는 꼭 피해야 할 것, warning은 조심할 것, hint는 해 두면 좋은 것, note는 알아 두면 마음 편한 것.',
          'コンパイラのメッセージのように段階別にまとめました。errorは必ず避けること、warningは気をつけること、hintはしておくと良いこと、noteは知っておくと安心なこと。'
        )}
      />
      <section className="container page-body">
        {warnings.length > 0 && (
          <div className="dict-toolbar">
            <div className="filters" role="group" aria-label={t('단계 필터', '段階で絞り込み')}>
              {LEVELS.filter((l) => count(l.key) > 0).map((l) => (
                <button key={l.key} type="button" className="filter" aria-pressed={level === l.key} onClick={() => setLevel(l.key)}>
                  {l.key !== 'all' && <span className={level === l.key ? '' : LEVEL_COLOR[l.key]}>● </span>}
                  {t(l.label)} {count(l.key)}
                </button>
              ))}
            </div>
            <p className="dict-count" aria-live="polite">{rows.length} diagnostics</p>
          </div>
        )}
        <Diagnostics items={rows} full />
        <PageCta
          kind="warning"
          title={t('조심해야 할 점을 알고 있나요?', '気をつけるべき点を知っていますか？')}
          desc={t('직접 겪은 실수나 팁을 알려 주세요. 익명으로 정리해서 반영합니다.', '実際の失敗やコツを教えてください。匿名で整理して反映します。')}
        />
      </section>
    </PageLayout>
  );
}
