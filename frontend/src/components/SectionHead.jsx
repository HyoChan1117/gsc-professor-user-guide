/** 섹션 제목 — title은 t()로 이미 고른 문자열 */
export default function SectionHead({ file, id, title }) {
  return (
    <div className="sec-head">
      <span className="sec-file">{file}</span>
      <h2 className="sec-title" id={id}>{title}</h2>
    </div>
  );
}
