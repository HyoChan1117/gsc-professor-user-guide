import { Link } from 'react-router-dom';
import { SURVEY_PATH } from '../data/siteData.js';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

/** 아직 데이터가 없는 섹션에 표시 (kind: 해당 섹션 제보 폼으로) */
export default function Pending({ kind }) {
  const { prof } = useProf();
  const { t } = useLang();
  const name = t(prof.name);
  return (
    <div className="card pending">
      <span className="c-comment">// TODO</span>{' '}
      {t(`${name} 데이터 수집 중`, `${name}のデータを収集中`)} —{' '}
      <Link to={kind ? `${SURVEY_PATH}/${kind}` : SURVEY_PATH}>{t('경험 제보하기 →', '体験を投稿する →')}</Link>
    </div>
  );
}
