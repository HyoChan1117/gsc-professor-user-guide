import { Link } from 'react-router-dom';
import { SURVEY_PATH } from '../../data/siteData.js';
import { useLang } from '../../context/LangContext.jsx';

/** 메뉴 페이지 하단 — 제보 유도 박스 (kind: 해당 섹션 제보 폼으로 바로 이동) */
export default function PageCta({ title, desc, cmd = '$ submit --anon', kind }) {
  const { t } = useLang();
  return (
    <div className="card dict-cta">
      <div>
        <h2>{title ?? t('알고 있는 경험이 있나요?', '知っている経験はありますか？')}</h2>
        <p>{desc ?? t('한 줄이라도 다음 학년에게는 큰 힌트가 됩니다. 익명으로 남겨 주세요.', 'ひとことでも次の学年には大きなヒントになります。匿名でどうぞ。')}</p>
      </div>
      <Link className="btn-primary" to={kind ? `${SURVEY_PATH}/${kind}` : SURVEY_PATH}>{cmd}</Link>
    </div>
  );
}
