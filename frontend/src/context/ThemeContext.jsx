import { createContext, useContext, useEffect, useState } from 'react';

/* ==========================================================================
   테마: 'light' | 'dark' | 'system'
   - light/dark → <html data-theme="…">,  system → 속성 제거 (CSS가 OS 설정을 따름)
   - 선택은 localStorage 'gsc-theme' 에 저장
   - 첫 화면 깜빡임 방지용으로 index.html 의 인라인 스크립트가 같은 일을 먼저 함
   ========================================================================== */
export const THEME_KEY = 'gsc-theme';
const THEMES = ['light', 'dark', 'system'];
const META_COLOR = { light: '#FFFFFF', dark: '#151B27' };
const ThemeContext = createContext(null);

function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch { /* 저장소 사용 불가 */ }
  return 'system';
}

const systemPrefersLight = () => window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  const [systemLight, setSystemLight] = useState(systemPrefersLight);

  // OS 설정이 바뀌면 따라가기 ("시스템"일 때 화면 표시 · 브라우저 상단 색)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return undefined;
    const onChange = (e) => setSystemLight(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = theme === 'system' ? (systemLight ? 'light' : 'dark') : theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* 무시 */ }
  }, [theme]);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[resolved]);
  }, [resolved]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
