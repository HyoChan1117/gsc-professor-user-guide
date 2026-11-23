import { Link } from 'react-router-dom';
import { SURVEY_PATH } from '../../data/siteData.js';
import { useLang } from '../../context/LangContext.jsx';

const RULES = [
  { ko: '추측보다 실제 경험 우선', ja: '推測より実際の経験を優先' },
  { ko: '사실과 개인 감상을 구분', ja: '事実と個人の感想を区別' },
  { ko: '여러 선배의 응답을 비교해 공통 경향만', ja: '複数の先輩の回答を比べて、共通する傾向だけを掲載' },
  { ko: '이름·이메일 수집 없음, 원문 그대로 게재 안 함', ja: '名前・メールアドレスは収集せず、原文はそのまま掲載しない' },
];

export default function Join() {
  const { t } = useLang();
  return (
    <section className="section" id="join" aria-labelledby="join-h">
      <div className="container join">
        <div className="join__main">
          <span className="sec-file">// 06 CONTRIBUTING.md</span>
          <h2 className="sec-title" id="join-h">
            {t(<>한 줄 경험도<br />다음 학년에게는 힌트가 됩니다.</>, <>ひとことの経験も<br />次の学年にはヒントになります。</>)}
          </h2>
          <p>
            {t('학년만 고르는 익명 설문. 몇 번이든 OK.', '学年を選ぶだけの匿名アンケート。何度でもOK。')}<br />
            한국어 · 日本語
          </p>
          <Link className="btn-primary" to={SURVEY_PATH}>
            $ git commit -m "{t('내 경험', '私の経験')}"
          </Link>
        </div>
        <div className="card join__rules">
          <div className="c-comment">{t('# 정보 신뢰성 · 익명성 원칙', '# 情報の信頼性・匿名性の原則')}</div>
          {RULES.map((r) => (
            <div key={r.ko}><span className="c-green">[x]</span> {t(r)}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
