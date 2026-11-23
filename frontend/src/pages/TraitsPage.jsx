import PageLayout from '../components/page/PageLayout.jsx';
import PageHero from '../components/page/PageHero.jsx';
import PageCta from '../components/page/PageCta.jsx';
import { TraitsBody } from '../components/home/Traits.jsx';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

/** /traits — 성향 분석 */
export default function TraitsPage() {
  const { prof } = useProf();
  const { t } = useLang();
  const short = t(prof.short);
  const top = prof.traits[0];

  return (
    <PageLayout path="/traits.json" title={{ ko: '성향 분석', ja: '性格分析' }}>
      <PageHero
        file="// 01 traits.json"
        title={t(`${short} 교수님 성향 분석`, `${short}教授の性格分析`)}
        lead={t('선배들의 익명 설문으로 본 교수님의 성향.', '先輩たちの匿名アンケートから見た教授の性格。')}
        desc={t(
          '한 사람이 여러 항목을 고를 수 있는 복수 선택 설문입니다. 비율은 전체 응답자 중 그 항목을 고른 사람의 비율이에요.',
          '一人で複数の項目を選べる複数選択式のアンケートです。割合は、全回答者のうちその項目を選んだ人の割合です。'
        )}
        stats={prof.survey ? [
          { label: t('응답자', '回答者'), value: t(`${prof.survey.n}명`, `${prof.survey.n}人`) },
          { label: t('구성', '内訳'), value: t(prof.survey.note) },
          ...(top ? [{ label: t('1위', '1位'), value: `${t(top.label)} · ${top.pct}%` }] : []),
        ] : []}
      />
      <section className="container page-body">
        <TraitsBody />
        <PageCta kind="traits" />
      </section>
    </PageLayout>
  );
}
