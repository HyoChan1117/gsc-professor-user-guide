import ProfSwitch from '../ProfSwitch.jsx';

/**
 * 메뉴 페이지 상단 — 파일명 주석 · 교수님 선택 · 제목 · 설명
 *   stats: [{ label, value }] 작은 수치 칩 (선택)
 */
export default function PageHero({ file, title, lead, desc, stats }) {
  return (
    <section className="dict-hero page-hero">
      <div className="container">
        <span className="sec-file">{file}</span>
        <ProfSwitch />
        <h1>{title}</h1>
        {lead && <p className="dict-hero__ja">{lead}</p>}
        {desc && <p className="dict-hero__desc">{desc}</p>}
        {stats && stats.length > 0 && (
          <div className="page-stats">
            {stats.map((s) => (
              <span className="page-stat" key={s.label}>
                <span className="c-muted">{s.label}</span> <strong>{s.value}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
