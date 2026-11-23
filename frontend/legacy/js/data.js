/* ==========================================================================
   사이트 내용 데이터 — 지금은 디자인 확인용 자리표시(placeholder)입니다.
   실제 내용은 이 파일의 값만 바꾸면 화면에 그대로 반영됩니다.
   ========================================================================== */
window.SITE_DATA = {
  /* 01 traits.json — 성향 막대 그래프 (pct: 0~100) */
  traits: [
    { label: '항목 1', pct: 80 },
    { label: '항목 2', pct: 50 },
    { label: '항목 3', pct: 25 },
    { label: '항목 4', pct: 10 },
    { label: '항목 5', pct: 5 }
  ],

  /* 02 scenes/ — 상황별 가이드 카드 */
  scenes: [
    {
      file: 'scenes/01_scene.md', tab: '01_scene',
      title: '상황 제목 1', ja: '日本語サブタイトル',
      items: ['체크리스트 항목', '체크리스트 항목', '체크리스트 항목'],
      tip: '선배 팁 문구가 들어갑니다.'
    },
    {
      file: 'scenes/02_scene.md', tab: '02_scene',
      title: '상황 제목 2', ja: '日本語サブタイトル',
      items: ['체크리스트 항목', '체크리스트 항목', '체크리스트 항목'],
      tip: '선배 팁 문구가 들어갑니다.'
    },
    {
      file: 'scenes/03_scene.md', tab: '03_scene',
      title: '상황 제목 3', ja: '日本語サブタイトル',
      items: ['체크리스트 항목', '체크리스트 항목', '체크리스트 항목'],
      tip: '선배 팁 문구가 들어갑니다.'
    }
  ],

  /* 사용 시 주의사항 — level: warning | hint | error | note */
  warnings: [
    { level: 'warning', id: 'W01', title: '주의사항 제목', msg: '설명 문장이 들어갑니다.' },
    { level: 'hint',    id: 'H02', title: '주의사항 제목', msg: '설명 문장이 들어갑니다.' },
    { level: 'error',   id: 'E03', title: '주의사항 제목', msg: '설명 문장이 들어갑니다.' },
    { level: 'note',    id: 'N04', title: '주의사항 제목', msg: '설명 문장이 들어갑니다.' }
  ],

  /* 03 smalltalk.yml — 6칸 그리드 */
  talk: [
    { key: 'topic_1', title: '소재 제목', body: '소재에 대한 짧은 설명이 들어갑니다.' },
    { key: 'topic_2', title: '소재 제목', body: '소재에 대한 짧은 설명이 들어갑니다.' },
    { key: 'topic_3', title: '소재 제목', body: '소재에 대한 짧은 설명이 들어갑니다.' },
    { key: 'topic_4', title: '소재 제목', body: '소재에 대한 짧은 설명이 들어갑니다.' },
    { key: 'topic_5', title: '소재 제목', body: '소재에 대한 짧은 설명이 들어갑니다.' },
    { key: 'topic_6', title: '소재 제목', body: '소재에 대한 짧은 설명이 들어갑니다.' }
  ],

  /* 04 dialect.dict — 홈 미리보기 & 사전 페이지 공용
     tag: 사투리 | 말버릇 | 외래어 | 추정   (preview: true 면 홈에 노출) */
  dict: [
    { term: '표현 1', tag: '사투리', ko: '표준어 뜻', ja: '日本語の意味', tip: '팁 문구', preview: true },
    { term: '표현 2', tag: '말버릇', ko: '표준어 뜻', ja: '日本語の意味', tip: '팁 문구', preview: true },
    { term: '표현 3', tag: '외래어', ko: '표준어 뜻', ja: '日本語の意味', tip: '팁 문구', preview: true },
    { term: '표현 4', tag: '사투리', ko: '표준어 뜻', ja: '日本語の意味', tip: '팁 문구', preview: true },
    { term: '표현 5', tag: '말버릇', ko: '표준어 뜻', ja: '日本語の意味', tip: '팁 문구' },
    { term: '표현 6', tag: '추정',   ko: '표준어 뜻', ja: '日本語の意味', tip: '팁 문구' }
  ],

  /* 05 thread.log — 익명 게시판 (anchor 예: '>>2 ') */
  posts: [
    { anchor: '', body: '한마디 자리표시 문장' },
    { anchor: '', body: '한마디 자리표시 문장' },
    { anchor: '>>2 ', body: '답글 자리표시 문장' },
    { anchor: '', body: '한마디 자리표시 문장' },
    { anchor: '', body: '一言のプレースホルダー' },
    { anchor: '', body: '한마디 자리표시 문장' },
    { anchor: '', body: 'Placeholder comment.' },
    { anchor: '', body: '한마디 자리표시 문장' },
    { anchor: '', body: '한마디 자리표시 문장' },
    { anchor: '', body: '한마디 자리표시 문장' }
  ]
};
