import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '../components/page/PageLayout.jsx';
import PageHero from '../components/page/PageHero.jsx';
import { useProf } from '../context/ProfContext.jsx';
import { useLang } from '../context/LangContext.jsx';

/* ==========================================================================
   /quiz — AI가 매번 새로 내는 4지선다 퀴즈 (POST /api/quiz)
   최근에 푼 문제는 브라우저에 기억했다가 서버에 보내서 겹치지 않게 함
   ========================================================================== */
const RECENT_MAX = 30;
const recentKey = (profId) => `gsc-quiz-recent-${profId}`;
const LETTERS = ['A', 'B', 'C', 'D'];

function loadRecent(profId) {
  try {
    const list = JSON.parse(localStorage.getItem(recentKey(profId)) || '[]');
    return Array.isArray(list) ? list.filter((q) => typeof q === 'string') : [];
  } catch { return []; }
}
function saveRecent(profId, questions) {
  try {
    const next = [...loadRecent(profId), ...questions.map((q) => q.question)].slice(-RECENT_MAX);
    localStorage.setItem(recentKey(profId), JSON.stringify(next));
  } catch { /* 저장소 사용 불가 */ }
}

const ERRORS = {
  too_many_requests: { ko: '문제를 너무 자주 요청했어요. 1분 뒤에 다시 해 주세요.', ja: 'リクエストが多すぎます。1分後にもう一度どうぞ。' },
  empty: { ko: '아직 이 교수님 자료가 부족해서 문제를 낼 수 없어요.', ja: 'この教授の資料がまだ少なく、問題を作れません。' },
  network: { ko: '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.', ja: 'サーバーに接続できません。しばらくしてから再度お試しください。' },
};

function grade(score, total, t) {
  const r = total ? score / total : 0;
  if (r === 1) return t('완벽해요! 교수님 사용 설명서 마스터 🎓', 'パーフェクト！取扱説明書マスター 🎓');
  if (r >= 0.6) return t('꽤 잘 아시네요! 면담도 문제없겠어요.', 'かなり詳しいですね！面談も大丈夫そう。');
  if (r >= 0.4) return t('절반쯤! 상황별 가이드를 한 번 더 읽어 볼까요?', '半分くらい！場面別ガイドをもう一度読んでみましょう。');
  return t('아직 낯설어요. 사이트를 둘러본 뒤 다시 도전!', 'まだ慣れていないかも。サイトを見てから再挑戦！');
}

export default function QuizPage() {
  const { prof, profId } = useProf();
  const { t, lang } = useLang();
  const short = t(prof.short);

  const [phase, setPhase] = useState('start'); // start | loading | play | result
  const [quiz, setQuiz] = useState(null);       // { mode, questions }
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState([]);       // 문제별 고른 번호
  const [error, setError] = useState('');

  async function start() {
    setPhase('loading');
    setError('');
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profId, lang, exclude: loadRecent(profId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error === 'too_many_requests' ? 'too_many_requests' : 'network');
      if (!data.questions?.length) throw new Error('empty');
      saveRecent(profId, data.questions);
      setQuiz(data);
      setIdx(0);
      setPicks([]);
      setPhase('play');
    } catch (err) {
      setError(ERRORS[err.message] ? err.message : 'network');
      setPhase(quiz ? 'result' : 'start');
    }
  }

  const q = quiz?.questions[idx];
  const picked = picks[idx];
  const answered = picked !== undefined;
  const total = quiz?.questions.length ?? 0;
  const score = quiz ? picks.filter((p, i) => p === quiz.questions[i].answer).length : 0;

  const pick = (i) => { if (!answered) setPicks((p) => { const n = [...p]; n[idx] = i; return n; }); };
  const next = () => (idx + 1 < total ? setIdx(idx + 1) : setPhase('result'));

  const startBtn = (label) => (
    <button type="button" className="btn-primary quiz-btn" onClick={start} disabled={phase === 'loading'}>
      {phase === 'loading' ? t('문제를 준비하는 중…', '問題を準備中…') : label}
    </button>
  );

  return (
    <PageLayout path="/quiz.test.js" title={{ ko: '퀴즈', ja: 'クイズ' }}>
      <PageHero
        file="// 07 quiz.test.js"
        title={t(`${short} 교수님 퀴즈`, `${short}教授クイズ`)}
        lead={t('선배들의 자료로 만든 4지선다 퀴즈를 풀어 보세요.', '先輩の資料をもとにした4択クイズに挑戦しよう。')}
        desc={t(
          '5문제 4지선다. 풀 때마다 다른 자료 · 다른 유형으로 출제되고, 최근에 푼 문제는 피해서 나와요.',
          '5問の4択。毎回ちがう資料・ちがうタイプで出題され、最近解いた問題は避けて出ます。'
        )}
      />
      <section className="container page-body">
        <div className="quiz">
          {error && <p className="survey-error" role="alert">✗ {t(ERRORS[error])}</p>}

          {(phase === 'start' || (phase === 'loading' && !quiz)) && (
            <div className="card quiz-card quiz-intro">
              <p className="mono c-comment">$ npm test -- --prof={profId} --random</p>
              <h2>{t('준비됐나요?', '準備はいいですか？')}</h2>
              <p className="c-muted">{t('문제를 만드는 데 몇 초 걸릴 수 있어요.', '問題の作成に数秒かかることがあります。')}</p>
              {startBtn(t('$ 퀴즈 시작', '$ クイズ開始'))}
            </div>
          )}

          {phase === 'play' && q && (
            <div className="card quiz-card">
              <div className="quiz-progress" aria-hidden="true">
                {quiz.questions.map((_, i) => (
                  <span key={i} className={
                    'quiz-progress__dot' +
                    (i === idx ? ' is-current' : '') +
                    (picks[i] !== undefined ? (picks[i] === quiz.questions[i].answer ? ' is-ok' : ' is-ng') : '')
                  } />
                ))}
              </div>
              <p className="quiz-meta mono">
                Q{idx + 1} / {total}{q.section && <span className="c-comment"> · {q.section}</span>}
              </p>
              <h2 className="quiz-q">{q.question}</h2>

              <div className="quiz-choices" role="group" aria-label={t('보기', '選択肢')}>
                {q.choices.map((c, i) => {
                  const state = !answered ? '' : i === q.answer ? ' is-answer' : i === picked ? ' is-wrong' : ' is-dim';
                  return (
                    <button key={i} type="button" className={'quiz-choice' + state} onClick={() => pick(i)}
                      disabled={answered} aria-pressed={picked === i}>
                      <span className="quiz-choice__letter mono">{LETTERS[i]}</span>
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>

              {answered && (
                <div className="quiz-feedback" role="status">
                  <p className={picked === q.answer ? 'c-green' : 'c-pink'}>
                    <strong>{picked === q.answer ? t('✓ 정답!', '✓ 正解！') : t(`✗ 아쉬워요 — 정답은 ${LETTERS[q.answer]}`, `✗ 残念 — 正解は ${LETTERS[q.answer]}`)}</strong>
                  </p>
                  {q.explanation && <p className="tip"><span className="tip__label"># </span>{q.explanation}</p>}
                  <button type="button" className="btn-primary quiz-btn" onClick={next}>
                    {idx + 1 < total ? t('다음 문제 →', '次の問題 →') : t('결과 보기', '結果を見る')}
                  </button>
                </div>
              )}
            </div>
          )}

          {(phase === 'result' || (phase === 'loading' && quiz)) && quiz && (
            <div className="card quiz-card quiz-result">
              <p className="mono c-comment">
                Tests: {score} passed, {total - score} failed, {total} total
              </p>
              <p className="quiz-score mono"><strong>{score}</strong> / {total}</p>
              <h2>{grade(score, total, t)}</h2>

              <ol className="quiz-review">
                {quiz.questions.map((x, i) => (
                  <li key={i} className={picks[i] === x.answer ? 'is-ok' : 'is-ng'}>
                    <span className="mono">{picks[i] === x.answer ? '✓' : '✗'}</span>
                    <span>
                      {x.question}
                      <span className="quiz-review__ans"> → {x.choices[x.answer]}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="quiz-actions">
                {startBtn(t('$ 새 문제로 다시', '$ 新しい問題で再挑戦'))}
                <Link className="btn-outline" to="/scenes">{t('상황별 가이드 보기', '場面別ガイドを見る')}</Link>
              </div>
            </div>
          )}

          {quiz?.mode === 'basic' && phase !== 'start' && (
            <p className="quiz-note c-comment">
              {t('# 위키 자료에서 고른 기본 문제예요.', '# ウィキの資料から選んだ基本問題です。')}
            </p>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
