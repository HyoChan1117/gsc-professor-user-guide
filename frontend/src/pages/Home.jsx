import { useEffect } from 'react';
import SiteHeader from '../components/SiteHeader.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import BottomNav from '../components/BottomNav.jsx';
import Hero from '../components/home/Hero.jsx';
import Status from '../components/home/Status.jsx';
import Traits from '../components/home/Traits.jsx';
import Scenes from '../components/home/Scenes.jsx';
import Warnings from '../components/home/Warnings.jsx';
import Talk from '../components/home/Talk.jsx';
import DictTeaser from '../components/home/DictTeaser.jsx';
import Thread from '../components/home/Thread.jsx';
import Join from '../components/home/Join.jsx';
import SectionNav from '../components/home/SectionNav.jsx';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

export default function Home() {
  const { profId } = useProf();
  const { t } = useLang();

  useEffect(() => {
    document.title = t('GSC 교수님 사용 설명서', 'GSC教授 取扱説明書');
  });

  return (
    <>
      <div id="top">
        <SiteHeader />
        {/* key: 교수님을 바꾸면 투표·별점·체크 상태가 초기화됨 */}
        <main key={profId}>
          <Hero />
          <Status />
          <SectionNav />
          <Traits />
          <Scenes />
          <Warnings />
          <Talk />
          <DictTeaser />
          <Thread />
          <Join />
        </main>
        <SiteFooter />
      </div>
      <BottomNav />
    </>
  );
}
