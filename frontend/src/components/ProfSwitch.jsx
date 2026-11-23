import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

/** 교수님 선택 버튼 줄 */
export default function ProfSwitch() {
  const { profs, profId, setProfId } = useProf();
  const { t } = useLang();
  return (
    <div className="prof-switch" role="group" aria-label={t('교수님 선택', '教授を選択')}>
      <span className="prof-switch__label">$ ls profs/</span>
      {profs.map((p) => (
        <button
          key={p.id}
          type="button"
          className="filter"
          aria-pressed={profId === p.id}
          onClick={() => setProfId(p.id)}
        >
          {t(p.name)}
        </button>
      ))}
    </div>
  );
}
