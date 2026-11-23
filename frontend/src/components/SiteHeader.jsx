import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { SURVEY_PATH } from '../data/siteData.js';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import LangToggle from './LangToggle.jsx';
import ThemeToggle, { ThemeCycle } from './ThemeToggle.jsx';

/* 메뉴 = 페이지 이동만 담당 (홈 안 섹션 이동은 SectionNav) */
const MENU = [
  { to: '/', end: true, label: { ko: '홈', ja: 'ホーム' } },
  { to: '/traits', label: { ko: '성향 분석', ja: '性格分析' } },
  { to: '/scenes', label: { ko: '상황별 가이드', ja: '場面別ガイド' } },
  { to: '/warnings', label: { ko: '주의사항', ja: '注意事項' } },
  { to: '/talk', label: { ko: '스몰토크', ja: '雑談ネタ' } },
  { to: '/dialect', label: { ko: '말버릇 사전', ja: '口癖辞典' } },
  { to: '/quiz', label: { ko: '퀴즈', ja: 'クイズ' } },
];

/** 모든 페이지 공통 헤더 — path: 로고 뒤에 붙는 경로 표시 (예: '/dialect.dict') */
export default function SiteHeader({ path }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { profId } = useProf();
  const { lang, setLang, t } = useLang();
  const close = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" to="/">
          <span className="brand__home">~/gsc</span>
          <span className="brand__sep">/</span>
          <span className="brand__name">{profId}-manual</span>
          {path ? <span className="brand__path">{path}</span> : <span className="brand__ver">v1.0.0</span>}
        </Link>

        <nav className={'nav' + (menuOpen ? ' is-open' : '')} id="main-nav" aria-label={t('메뉴', 'メニュー')}>
          {MENU.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} onClick={close}>{t(m.label)}</NavLink>
          ))}
          {/* 햄버거 메뉴로 접혔을 때만 보임 (넓은 화면에서는 오른쪽 버튼) */}
          <NavLink className="nav__cta" to={SURVEY_PATH} onClick={close}>{t('+ 제보하기', '+ 投稿する')}</NavLink>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <LangToggle />
          <Link className="btn-primary btn-primary--sm" to={SURVEY_PATH}>
            {t('제보하기', '投稿する')}
          </Link>
        </div>

        {/* 모바일: 언어 전환 + 전체 메뉴(햄버거) */}
        <div className="m-actions">
          <ThemeCycle />
          <button type="button" className="m-lang" onClick={() => setLang(lang === 'ko' ? 'ja' : 'ko')}>
            {lang === 'ko' ? 'KO/ja' : 'ko/JA'}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={menuOpen ? t('메뉴 닫기', 'メニューを閉じる') : t('메뉴 열기', 'メニューを開く')}
            aria-controls="main-nav"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
