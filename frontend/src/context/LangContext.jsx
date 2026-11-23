import { createContext, isValidElement, useContext, useEffect, useState } from 'react';

const KEY = 'gsc-lang';
const LangContext = createContext(null);

// 처음 언어: ?lang=ja → 지난번 선택(localStorage) → 한국어
function initialLang() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'ko' || fromUrl === 'ja') return fromUrl;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ko' || saved === 'ja') return saved;
  } catch { /* 저장소 사용 불가 */ }
  return 'ko';
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch { /* 무시 */ }
  }, [lang]);

  /**
   * 번역 고르기
   *   t('한국어', '日本語')       → 현재 언어 쪽
   *   t({ ko: '…', ja: '…' })    → 데이터 파일의 번역 쌍
   *   t('그냥 문자열')            → 번역이 없으면 그대로
   */
  const t = (a, b) => {
    if (a && typeof a === 'object' && !Array.isArray(a) && !isValidElement(a) && 'ko' in a) {
      return a[lang] ?? a.ko;
    }
    if (b !== undefined) return lang === 'ja' ? b : a;
    return a;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
