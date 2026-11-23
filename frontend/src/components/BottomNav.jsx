import { NavLink } from 'react-router-dom';
import { SURVEY_PATH } from '../data/siteData.js';
import { useLang } from '../context/LangContext.jsx';

const ICONS = {
  home: 'M3 11l9-7 9 7v9h-6v-6H9v6H3z',
  scenes: 'M3 6h7l2 2h9v11H3z',
  dict: 'M4 5h16v11H9l-5 4z',
  submit: 'M4 20h4L19 9l-4-4L4 16z',
};

function Icon({ name }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** 모바일 하단 탭바 — 자주 쓰는 페이지만 (전체 메뉴는 헤더 햄버거) */
export default function BottomNav() {
  const { t } = useLang();
  return (
    <nav className="bottom-nav" aria-label={t('빠른 메뉴', 'クイックメニュー')}>
      <NavLink to="/" end><Icon name="home" />{t('홈', 'ホーム')}</NavLink>
      <NavLink to="/scenes"><Icon name="scenes" />{t('가이드', 'ガイド')}</NavLink>
      <NavLink to="/dialect"><Icon name="dict" />{t('사전', '辞典')}</NavLink>
      <NavLink to={SURVEY_PATH}><Icon name="submit" />{t('제보하기', '投稿する')}</NavLink>
    </nav>
  );
}
