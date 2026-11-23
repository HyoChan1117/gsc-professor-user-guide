import PageLayout from '../components/page/PageLayout.jsx';
import PageHero from '../components/page/PageHero.jsx';
import PageCta from '../components/page/PageCta.jsx';
import { TalkGrid } from '../components/home/Talk.jsx';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

/** /talk — 스몰토크 소재 */
export default function TalkPage() {
  const { prof } = useProf();
  const { t } = useLang();
  const short = t(prof.short);

  return (
    <PageLayout path="/smalltalk.yml" title={{ ko: '스몰토크', ja: '雑談ネタ' }}>
      <PageHero
        file="// 03 smalltalk.yml"
        title={t(`${short} 교수님 스몰토크 소재`, `${short}教授の雑談ネタ`)}
        lead={t('면담 전 어색한 3초를 줄여 줄 이야깃거리.', '面談前の気まずい3秒を減らす話のネタ。')}
        desc={t(
          '선배들이 실제로 대화해 보고 반응이 좋았던 주제들이에요. 억지로 꺼내기보다는 자연스럽게 이어질 때 써 보세요.',
          '先輩たちが実際に話してみて反応が良かった話題です。無理に持ち出すより、自然な流れで使ってみてください。'
        )}
        stats={prof.talk.length ? [{ label: t('소재', 'ネタ'), value: t(`${prof.talk.length}개`, `${prof.talk.length}件`) }] : []}
      />
      <section className="container page-body">
        <TalkGrid />
        <PageCta
          kind="talk"
          title={t('다른 이야깃거리를 알고 있나요?', 'ほかの話のネタを知っていますか？')}
          desc={t('교수님이 좋아하시는 주제를 알려 주세요.', '教授が好きな話題を教えてください。')}
        />
      </section>
    </PageLayout>
  );
}
