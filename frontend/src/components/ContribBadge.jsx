import { useLang } from '../context/LangContext.jsx';

/** 선배 제보로 들어온 항목 표시 — contrib: { id, lang } (서버 view.js 가 붙임)
 *  제보 글은 쓴 언어 그대로라, 화면 언어와 다르면 "원문"을 함께 알려 줌 */
export default function ContribBadge({ contrib }) {
  const { t, lang } = useLang();
  if (!contrib) return null;
  const other = contrib.lang && contrib.lang !== lang;
  return (
    <span className="contrib-badge" title={t('관리자 검수를 거친 익명 선배 제보', '管理者が確認した匿名の先輩の投稿')}>
      {t('선배 제보', '先輩の投稿')}
      {other && <> · {contrib.lang === 'ja' ? t('일본어 원문', '日本語の原文') : t('한국어 원문', '韓国語の原文')}</>}
    </span>
  );
}
