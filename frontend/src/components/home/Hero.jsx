import { Fragment } from 'react';
import ProfSwitch from '../ProfSwitch.jsx';
import GrepChat from './GrepChat.jsx';
import { useProf } from '../../context/ProfContext.jsx';
import { useLang } from '../../context/LangContext.jsx';

// 코드 블록 값: 배열이면 ["a", "b"], 아니면 "a"
function CodeValue({ v }) {
  if (Array.isArray(v)) {
    return <>[{v.map((x, i) => <Fragment key={x}>{i > 0 && ', '}<span className="c-green">"{x}"</span></Fragment>)}]</>;
  }
  return <span className="c-green">"{v}"</span>;
}

function Avatar({ src, alt }) {
  return src ? <img src={src} alt={alt} /> : <div className="img-placeholder">no image</div>;
}

export default function Hero() {
  const { prof } = useProf();
  const { t } = useLang();
  const cmd = prof.id;
  const head = cmd.toUpperCase() + '(1)';
  const alt = t(prof.avatarAlt);

  return (
    <section className="container hero">
      <div className="hero__main">
        <ProfSwitch />

        <div className="man-head">
          <span>{head}</span>
          <span>{t('글로벌시스템융합과 매뉴얼', 'グローバルシステム融合科 マニュアル')}</span>
          <span>{head}</span>
        </div>

        <p className="prompt">
          <span className="c-green">student@gsc</span><span className="c-muted">:~$</span> man {cmd}
          <span className="caret" aria-hidden="true" />
        </p>

        <div className="hero__name-row">
          <div>
            <p className="man-label">NAME</p>
            <h1 className="hero__title">
              {t(<>GSC 교수님<br />사용 설명서</>, <>GSC教授<br />取扱説明書</>)}
            </h1>
            <p className="hero__ja"><span className="c-blue">{t(prof.name)}</span></p>
          </div>
          <div className="hero__thumb">
            <Avatar src={prof.avatar} alt={alt} />
          </div>
        </div>

        <div className="hero__synopsis">
          <p className="man-label">SYNOPSIS</p>
          <p className="synopsis">
            <span className="c-blue">{cmd}</span>
            {prof.synopsis.map((s) => {
              const [flag, ...arg] = t(s).split(' ');
              return (
                <Fragment key={flag}>
                  {' '}[<span className="c-green">{flag}</span>{arg.length > 0 && <> <span className="c-pink">{arg.join(' ')}</span></>}]
                </Fragment>
              );
            })}
          </p>
        </div>

        <div className="hero__description">
          <p className="man-label">DESCRIPTION</p>
          <p className="hero__desc">
            {t(
              '수업·과제 피드백·지도교수 면담에서 선배들이 실제로 겪은 일과 대처법을 모은 학과 공략 가이드. 처음 겪는 상황이라도, 누군가의 경험을 힌트 삼아 미리 준비할 수 있도록.',
              '授業・課題フィードバック・指導教授との面談で、先輩たちが実際に経験したことと対処法を集めた学科攻略ガイド。初めての場面でも、誰かの経験をヒントに前もって準備できるように。'
            )}
          </p>
        </div>

        <GrepChat />
      </div>

      <div className="hero__side">
        <figure className="card preview">
          <div className="window-bar">
            <span className="dot dot--r" aria-hidden="true" />
            <span className="dot dot--y" aria-hidden="true" />
            <span className="dot dot--g" aria-hidden="true" />
            <span className="window-bar__name">{cmd}/avatar.png — preview</span>
            <span className="window-bar__meta">{prof.avatarSize}</span>
          </div>
          <div className="preview__stage">
            <Avatar src={prof.avatar} alt={alt} />
            {prof.badges.status && <span className="badge badge--status">{t(prof.badges.status)}</span>}
            {prof.badges.music && <span className="badge badge--music">{t(prof.badges.music)}</span>}
          </div>
          <figcaption className="code-block">
            <div><span className="c-pink">const</span> <span className="c-blue">prof</span> = {'{'}</div>
            <div className="indent"><span className="c-purple">name</span>: <span className="c-green">"{t(prof.short)}"</span>,</div>
            {prof.code.map((line) => (
              <div className="indent" key={line.map((x) => x.k).join()}>
                {line.map((x, i) => (
                  <Fragment key={x.k}>
                    {i > 0 && ' '}
                    <span className="c-purple">{x.k}</span>: <CodeValue v={t(x.v)} />,
                    {x.note && <> <span className="c-comment">// {t(x.note)}</span></>}
                  </Fragment>
                ))}
              </div>
            ))}
            <div>{'};'}</div>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
