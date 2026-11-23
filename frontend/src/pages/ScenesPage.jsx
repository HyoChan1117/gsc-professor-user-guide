import PageLayout from '../components/page/PageLayout.jsx';
import PageHero from '../components/page/PageHero.jsx';
import PageCta from '../components/page/PageCta.jsx';
import Pending from '../components/Pending.jsx';
import { SceneCard } from '../components/home/Scenes.jsx';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

/** /scenes — 상황별 가이드 (모바일에서도 탭 없이 전부 펼쳐서) */
export default function ScenesPage() {
  const { prof } = useProf();
  const { t } = useLang();
  const short = t(prof.short);
  const { scenes } = prof;
  const itemCount = scenes.reduce((n, s) => n + s.items.length, 0);

  return (
    <PageLayout path="/scenes/" title={{ ko: '상황별 가이드', ja: '場面別ガイド' }}>
      <PageHero
        file="// 02 scenes/"
        title={t(`${short} 교수님 상황별 가이드`, `${short}教授 場面別ガイド`)}
        lead={t('피드백 · 면담 · 질문, 상황마다 미리 챙길 것.', 'フィードバック・面談・質問、場面ごとに準備すること。')}
        desc={t(
          '체크리스트를 하나씩 체크하면서 준비해 보세요. 별점으로 도움이 됐는지 알려 주시면 가이드를 다듬는 데 참고합니다.',
          'チェックリストをひとつずつ確認しながら準備してみてください。星で役に立ったか教えてもらえると、ガイドの改善に役立てます。'
        )}
        stats={scenes.length ? [
          { label: t('상황', '場面'), value: t(`${scenes.length}개`, `${scenes.length}件`) },
          { label: t('체크리스트', 'チェックリスト'), value: t(`${itemCount}개`, `${itemCount}件`) },
        ] : []}
      />
      <section className="container page-body">
        {scenes.length === 0 ? <Pending kind="scene" /> : (
          <div className="scenes scenes--all">
            {scenes.map((s, i) => <SceneCard key={s.file} scene={s} index={i} />)}
          </div>
        )}
        <PageCta
          kind="scene"
          title={t('다른 상황도 겪어 봤나요?', 'ほかの場面も経験しましたか？')}
          desc={t('새로운 상황과 대처법을 알려 주시면 가이드에 추가할게요.', '新しい場面と対処法を教えてもらえれば、ガイドに追加します。')}
        />
      </section>
    </PageLayout>
  );
}
