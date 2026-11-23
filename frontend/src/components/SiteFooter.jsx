import { useLang } from '../context/LangContext.jsx';

export default function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="site-footer">
      <div className="container">
        <div>
          {t(
            <><strong>Team 한일반반</strong> — 김효찬 (팀장) · 조원준 (개발) · 오오이 아야메 (선배 사례) · 카와이 사츠키 (상황별 대처)</>,
            <><strong>Team 韓日半々</strong> — キム・ヒョチャン（リーダー）· チョ・ウォンジュン（開発）· オオイ・アヤメ（先輩の事例）· カワイ・サツキ（場面別の対処）</>
          )}
        </div>
        <div className="mono">
          {t('여러 학생의 익명 응답을 종합·일반화한 정보입니다 · 2026', '複数の学生の匿名回答をまとめ、一般化した情報です · 2026')}
        </div>
      </div>
    </footer>
  );
}
