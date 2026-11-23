import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LangContext.jsx';

/* 라이트 · 다크 · 시스템 테마 선택 */
const OPTIONS = [
  { key: 'light', label: { ko: '라이트', ja: 'ライト' } },
  { key: 'dark', label: { ko: '다크', ja: 'ダーク' } },
  { key: 'system', label: { ko: '시스템', ja: 'システム' } },
];

const PATHS = {
  light: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  dark: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  system: 'M3 5h18v11H3zM8 20h8M12 16v4',
};

export function ThemeIcon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** 데스크톱: 아이콘 버튼 하나 → 펼치면 라이트 · 다크 · 시스템 (헤더 공간 절약) */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = OPTIONS.find((o) => o.key === theme) ?? OPTIONS[2];

  // 바깥을 누르거나 Esc 로 닫기
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="theme-menu" ref={ref}>
      <button type="button" className="theme-menu__btn" aria-haspopup="true" aria-expanded={open}
        aria-label={t(`화면 테마: ${t(current.label)}`, `画面テーマ：${t(current.label)}`)} title={t(current.label)}
        onClick={() => setOpen((o) => !o)}>
        <ThemeIcon name={current.key} />
      </button>
      {open && (
        <div className="theme-menu__list" role="group" aria-label={t('화면 테마', '画面テーマ')}>
          {OPTIONS.map((o) => (
            <button key={o.key} type="button" className="theme-menu__item" aria-pressed={theme === o.key}
              onClick={() => { setTheme(o.key); setOpen(false); }}>
              <ThemeIcon name={o.key} />
              <span>{t(o.label)}</span>
              {theme === o.key && <span className="theme-menu__check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 모바일: 버튼 하나로 라이트 → 다크 → 시스템 순환 */
export function ThemeCycle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLang();
  const i = OPTIONS.findIndex((o) => o.key === theme);
  const current = OPTIONS[i] ?? OPTIONS[2];
  const next = OPTIONS[(Math.max(i, 0) + 1) % OPTIONS.length];
  return (
    <button type="button" className="icon-btn m-theme" onClick={() => setTheme(next.key)}
      aria-label={t(`화면 테마: ${t(current.label)} (눌러서 ${t(next.label)}로)`, `画面テーマ：${t(current.label)}（タップで${t(next.label)}へ）`)}>
      <ThemeIcon name={current.key} size={20} />
    </button>
  );
}
