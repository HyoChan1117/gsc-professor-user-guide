/* ==========================================================================
   교수님과 상관없이 공통으로 쓰는 값
   교수님별 내용은 data/profs/ 폴더에 있습니다.
   ========================================================================== */

/* 사이트 안 설문 페이지 (한국어 · 日本語) — 모든 "제보하기" 버튼이 여기로 */
export const SURVEY_PATH = '/survey';

/* 예전 구글 폼 (다국어 원본 · 지금은 사용하지 않음) */
export const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe4R1VesZcISdOqrMd1UAsrO_x0ikL3RgJzRs7xV_HmjvSmHQ/viewform?usp=header';

/* 사전 태그 (데이터에는 한국어 값으로 저장) */
export const DICT_TAGS = ['전체', '사투리', '말버릇', '외래어', '추정'];
export const TAG_LABEL = {
  전체: { ko: '전체', ja: 'すべて' },
  사투리: { ko: '사투리', ja: '方言' },
  말버릇: { ko: '말버릇', ja: '口癖' },
  외래어: { ko: '외래어', ja: '外来語' },
  추정: { ko: '추정', ja: '推定' },
};
