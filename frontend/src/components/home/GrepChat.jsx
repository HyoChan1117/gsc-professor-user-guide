import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';

/* 출처 종류 → 해당 내용이 있는 페이지 */
const SOURCE_LINK = {
  profile: '/', traits: '/traits', scene: '/scenes', warning: '/warnings',
  talk: '/talk', dict: '/dialect', posts: '/#thread',
};

const SUGGEST = {
  ko: ['면담 가기 전에 뭘 준비해야 해?', '교수님이랑 무슨 얘기하면 좋아?', '“시마이하자”가 무슨 뜻이야?'],
  ja: ['面談の前に何を準備すればいい？', '先生と何を話せばいい？', '「시마이하자」ってどういう意味？'],
};

/* 답변 텍스트 → 화면 (마크다운 일부만: **굵게**, "- " 목록, [1] 출처 번호)
   HTML을 직접 넣지 않고 React 요소로 만들기 때문에 안전함 */
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\[\d+\]$/.test(part)) return <sup className="chat-cite" key={i}>{part.slice(1, -1)}</sup>;
    return part;
  });
}

function Answer({ text }) {
  const blocks = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const item = line.match(/^[-*•]\s+(.*)$/);
    if (item) {
      const last = blocks[blocks.length - 1];
      if (last?.type === 'list') last.items.push(item[1]);
      else blocks.push({ type: 'list', items: [item[1]] });
    } else {
      blocks.push({ type: 'p', text: line.replace(/^#+\s*/, '') });
    }
  }
  return (
    <div className="chat-text">
      {blocks.map((b, i) => (b.type === 'list' ? (
        <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>
      ) : (
        <p key={i}>{renderInline(b.text)}</p>
      )))}
    </div>
  );
}

/** 히어로 GREP 입력창 → RAG 챗봇 (POST /api/chat) */
export default function GrepChat() {
  const { prof, profId } = useProf();
  const { t, lang } = useLang();
  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);        // { role: 'user' | 'assistant', content, sources?, notice? }
  const [loading, setLoading] = useState(false);
  const logRef = useRef(null);

  // 새 메시지가 생기면 맨 아래로
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, loading]);

  async function ask(text) {
    const message = text.trim();
    if (!message || loading) return;
    setInput('');
    const history = log.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setLog((l) => [...l, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profId, lang, message, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 429
          ? t('질문이 너무 많아요. 잠시 후 다시 시도해 주세요.', '質問が多すぎます。少し待ってから試してください。')
          : t('답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요.', '回答を作成できませんでした。少し待ってから試してください。');
        throw new Error(msg);
      }
      setLog((l) => [...l, { role: 'assistant', content: data.answer, sources: data.sources, notice: data.notice }]);
    } catch (err) {
      const msg = err instanceof TypeError
        ? t('서버에 연결할 수 없어요. 백엔드가 켜져 있는지 확인해 주세요.', 'サーバーに接続できません。バックエンドが起動しているか確認してください。')
        : err.message;
      setLog((l) => [...l, { role: 'assistant', content: msg, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grep-chat">
      <form className="grep" role="search" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <label className="grep__label" htmlFor="q">
          GREP <span>— {t(`${t(prof.name)}에 대해 물어보세요`, `${t(prof.name)}について質問してください`)}</span>
        </label>
        <div className="grep__box">
          <span className="grep__chev" aria-hidden="true">&gt;</span>
          <input
            className="grep__input"
            id="q"
            type="search"
            autoComplete="off"
            maxLength={500}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('면담 준비, 과제 피드백, 사투리…', '面談の準備、課題フィードバック、方言…')}
          />
          <button className="grep__submit" type="submit" aria-label={t('질문하기', '質問する')} disabled={loading || !input.trim()}>
            <span className="grep__submit-text">Enter </span>↵
          </button>
        </div>
      </form>

      {log.length === 0 ? (
        <div className="chat-suggest" aria-label={t('예시 질문', '質問の例')}>
          {SUGGEST[lang].map((s) => (
            <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      ) : (
        <div className="card chat-log" ref={logRef} aria-live="polite">
          <div className="chat-log__bar">
            <span className="c-comment"># grep.log — {t('선배들의 설문 자료를 바탕으로 답해요', '先輩のアンケート資料をもとに答えます')}</span>
            <button type="button" className="chat-log__clear" onClick={() => setLog([])}>clear</button>
          </div>
          {log.map((m, i) => (
            m.role === 'user' ? (
              <div className="chat-msg chat-msg--user" key={i}><span className="c-green">&gt;</span> {m.content}</div>
            ) : (
              <div className={'chat-msg chat-msg--bot' + (m.error ? ' is-error' : '')} key={i}>
                {m.notice && <div className="chat-notice">⚠ {m.notice}</div>}
                {m.error ? <div className="chat-text"><p>{m.content}</p></div> : <Answer text={m.content} />}
                {m.sources?.length > 0 && (
                  <div className="chat-sources">
                    {m.sources.map((s) => (
                      <Link key={s.n} to={SOURCE_LINK[s.type] || '/'} className="chat-source">
                        [{s.n}] {s.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          ))}
          {loading && (
            <div className="chat-msg chat-msg--bot c-muted">
              {t('자료 찾는 중', '資料を検索中')}<span className="caret" aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
