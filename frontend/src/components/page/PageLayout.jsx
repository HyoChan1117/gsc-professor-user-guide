import { useEffect } from 'react';
import SiteHeader from '../SiteHeader.jsx';
import SiteFooter from '../SiteFooter.jsx';
import BottomNav from '../BottomNav.jsx';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';

/**
 * 메뉴 페이지 공통 틀 (헤더 · 푸터 · 하단 탭바 · 탭 제목)
 *   path:  로고 뒤 경로 표시 (예: '/traits.json')
 *   title: 탭 제목 { ko, ja }
 */
export default function PageLayout({ path, title, children }) {
  const { profId } = useProf();
  const { t } = useLang();

  useEffect(() => {
    document.title = `${t(title)} — ${t('GSC 교수님 사용 설명서', 'GSC教授 取扱説明書')}`;
  });

  return (
    <>
      <SiteHeader path={path} />
      {/* key: 교수님을 바꾸면 체크·별점·필터 상태 초기화 */}
      <main key={profId}>{children}</main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
