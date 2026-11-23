import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';

/* 내비게이션 = 홈 안의 섹션 이동만 담당 (페이지 이동은 SiteHeader 메뉴) */
const SECTIONS = [
  { id: 'traits', label: { ko: '성향 분석', ja: '性格分析' } },
  { id: 'scenes', label: { ko: '상황별 가이드', ja: '場面別ガイド' } },
  { id: 'warnings', label: { ko: '주의사항', ja: '注意事項' } },
  { id: 'talk', label: { ko: '스몰토크', ja: '雑談ネタ' } },
  { id: 'thread', label: { ko: '한마디', ja: 'ひとこと' } },
  { id: 'join', label: { ko: '참여하기', ja: '参加する' } },
];

// 스크롤 위치에 따라 지금 보고 있는 섹션 id
function useActiveSection(ids) {
  const [active, setActive] = useState(null);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && setActive(en.target.id)),
      { rootMargin: '-40% 0px -55% 0px' }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids]);
  return active;
}

const IDS = SECTIONS.map((s) => s.id);

export default function SectionNav() {
  const { t } = useLang();
  const active = useActiveSection(IDS);
  const barRef = useRef(null);

  // 모바일처럼 바가 가로로 넘칠 때, 현재 항목이 보이도록 가로 스크롤
  useEffect(() => {
    const bar = barRef.current;
    const link = bar?.querySelector('[aria-current]');
    if (!bar || !link) return;
    const left = link.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft || left + link.offsetWidth > bar.scrollLeft + bar.clientWidth) {
      bar.scrollTo({ left: left - 16, behavior: 'smooth' });
    }
  }, [active]);

  return (
    <nav className="section-nav" aria-label={t('이 페이지의 섹션', 'このページのセクション')}>
      <div className="container section-nav__inner" ref={barRef}>
        <span className="section-nav__label" aria-hidden="true">#</span>
        {SECTIONS.map((s) => (
          <a key={s.id} href={'#' + s.id} aria-current={active === s.id ? 'location' : undefined}>
            {t(s.label)}
          </a>
        ))}
      </div>
    </nav>
  );
}
