import { useLang } from '../context/LangContext.jsx';

/** KO / JA 버튼 */
export default function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <>
      {['ko', 'ja'].map((l) => (
        <button key={l} type="button" className="lang-btn" aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </>
  );
}
