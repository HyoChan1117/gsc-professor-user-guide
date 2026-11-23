/* ==========================================================================
   섹션별 제보 폼 — 홈 섹션 순서 · 항목 모양 그대로 (한국어 · 日本語)
   kind / 항목 key / 선택지 값은 backend/src/contrib.js 의 KINDS 와 같아야 합니다.
   항목 type: text(한 줄) · textarea(여러 줄) · choice(하나 선택) · multi(여러 개 선택) · lines(한 줄에 한 항목)
   options 가 문자열('traits' · 'scenes')이면 교수님 데이터에서 선택지를 만듦 → resolveOptions
   ========================================================================== */

export const GRADES = [
  { key: '1', label: { ko: '1학년', ja: '1年生' } },
  { key: '2', label: { ko: '2학년', ja: '2年生' } },
  { key: '3', label: { ko: '3학년', ja: '3年生' } },
  { key: 'alumni', label: { ko: '졸업생 · 기타', ja: '卒業生・その他' } },
];

// 교수님 성향 항목이 아직 없을 때(설문 수집 전) 쓰는 기본 성향 — backend DEFAULT_TRAITS 와 같음
export const DEFAULT_TRAITS = [
  { ko: '열정파 · 가르치는 걸 좋아하심', ja: '情熱派・教えるのが好き' },
  { ko: '논리적 · 본질 중시 (‘왜?’를 깊게 파고드심)', ja: '論理的・本質重視（「なぜ？」を深く掘り下げる）' },
  { ko: '마감 · 예의에 철저하심', ja: '締め切り・礼儀に厳しい' },
  { ko: '츤데레 (처음엔 엄격하지만 상담하면 다정하심)', ja: 'ツンデレ（最初は厳しいけど相談すると優しい）' },
  { ko: '수다쟁이 (취미 이야기가 나오면 멈추지 않음)', ja: 'おしゃべり（趣味の話になると止まらない）' },
  { ko: '의외로 단 것 · 귀여운 걸 좋아하심', ja: '意外と甘いもの・かわいいものが好き' },
  { ko: '유머 감각 · 독특한 비유', ja: 'ユーモア・独特なたとえ話' },
];
export const NEW_SCENE = '__new';

export const KINDS = [
  {
    key: 'traits', icon: '🧭', file: '01 traits.json', page: '/traits',
    title: { ko: '성향 분석', ja: '性格分析' },
    desc: { ko: '성향 막대에 한 표 — 설문 결과에 더해져요', ja: '性格のグラフに一票 — アンケート結果に加算されます' },
    cmd: 'survey --vote',
    fields: [
      { key: 'traits', type: 'multi', options: 'traits', required: true,
        label: { ko: '교수님은 어떤 분이신가요?', ja: '教授はどんな人ですか？' },
        desc: { ko: '해당하는 것 모두 선택 — 성향 분석 막대의 비율에 반영돼요', ja: '当てはまるものをすべて選択 — 性格分析のグラフの割合に反映されます' } },
      { key: 'one_word', type: 'text', max: 100,
        label: { ko: '교수님의 인상을 ‘한마디’로 표현한다면?', ja: '教授の印象を「一言」で表すと？' },
        placeholder: { ko: '예: 열정맨, 츤데레', ja: '例：情熱マン、ツンデレ' } },
    ],
  },
  {
    key: 'scene', icon: '🗂️', file: '02 scenes/', page: '/scenes',
    title: { ko: '상황별 가이드', ja: '場面別ガイド' },
    desc: { ko: '상황 카드에 체크리스트 · 팁 추가', ja: '場面カードにチェックリスト・コツを追加' },
    cmd: 'scene add',
    fields: [
      { key: 'scene', type: 'choice', options: 'scenes', required: true,
        label: { ko: '어떤 상황 카드에 추가할까요?', ja: 'どの場面カードに追加しますか？' } },
      { key: 'title', type: 'text', max: 60, showIf: (f) => f.scene === NEW_SCENE, required: true,
        label: { ko: '새 상황 이름', ja: '新しい場面の名前' },
        placeholder: { ko: '예: 메일 보낼 때, 면접 보기 전', ja: '例：メールを送るとき、面接の前' } },
      { key: 'items', type: 'lines', max: 5, itemMax: 150, required: true,
        label: { ko: '체크리스트', ja: 'チェックリスト' },
        desc: { ko: '한 줄에 하나씩, 최대 5개 — 카드의 체크 항목이 돼요', ja: '1行に1つ、最大5つ — カードのチェック項目になります' },
        placeholder: { ko: '물어볼 내용을 미리 메모\n“왜?”에 한 문장으로 답할 준비', ja: '聞きたいことを事前にメモ\n「なぜ？」に一文で答える準備' } },
      { key: 'tip', type: 'text', max: 200,
        label: { ko: '선배 한 줄 팁', ja: '先輩のひとことコツ' },
        placeholder: { ko: '예: 질문의 의도를 먼저 생각하면 산다', ja: '例：質問の意図を先に考えれば大丈夫' } },
    ],
  },
  {
    key: 'warning', icon: '⚠️', file: 'warnings.log', page: '/warnings',
    title: { ko: '사용 시 주의사항', ja: 'ご使用上の注意' },
    desc: { ko: '조심할 것 · 알아 두면 좋은 것', ja: '気をつけること・知っておくと良いこと' },
    cmd: 'warn add',
    fields: [
      { key: 'level', type: 'choice', required: true,
        label: { ko: '어떤 종류인가요?', ja: 'どの種類ですか？' },
        options: [
          { key: 'warning', mono: 'warning', label: { ko: '주의', ja: '注意' } },
          { key: 'hint', mono: 'hint', label: { ko: '알아 두면 좋은 팁', ja: '知っておくと良いコツ' } },
          { key: 'error', mono: 'error', label: { ko: '절대 금지', ja: '絶対禁止' } },
          { key: 'note', mono: 'note', label: { ko: '참고', ja: '参考' } },
        ] },
      { key: 'title', type: 'text', max: 60, required: true,
        label: { ko: '제목 (짧게)', ja: 'タイトル（短く）' },
        placeholder: { ko: '예: 복습은 필수', ja: '例：復習は必須' } },
      { key: 'msg', type: 'textarea', max: 400, required: true,
        label: { ko: '설명', ja: '説明' },
        placeholder: { ko: '예: 지난 내용 질문에 답하지 못하면 실망이 크신 편.', ja: '例：前回の内容の質問に答えられないと、がっかりされがち。' } },
    ],
  },
  {
    key: 'talk', icon: '💬', file: '03 smalltalk.yml', page: '/talk',
    title: { ko: '스몰토크 소재', ja: '雑談ネタ' },
    desc: { ko: '교수님과 이야기가 잘 통했던 주제', ja: '教授と話が弾んだ話題' },
    cmd: 'talk add',
    fields: [
      { key: 'title', type: 'text', max: 60, required: true,
        label: { ko: '주제', ja: '話題' },
        placeholder: { ko: '예: 삼성 라이온즈, 마라탕', ja: '例：サムスン・ライオンズ、マーラータン' } },
      { key: 'body', type: 'textarea', max: 500, required: true,
        label: { ko: '어떤 이야기였나요?', ja: 'どんな話でしたか？' },
        placeholder: { ko: '예: 이긴 주에는 기분이 좋으시다는 제보. 수업 중 숨 돌리기로 야구 이야기도.', ja: '例：勝った週は機嫌がいいという情報。授業中のひと息に野球の話も。' } },
    ],
  },
  {
    key: 'dict', icon: '📖', file: '04 dialect.dict', page: '/dialect',
    title: { ko: '말버릇 · 사투리 사전', ja: '口癖・方言辞典' },
    desc: { ko: '교수님이 자주 쓰시는 표현', ja: '教授がよく使う表現' },
    cmd: 'dict add',
    fields: [
      { key: 'term', type: 'text', max: 60, required: true,
        label: { ko: '표현 (들은 그대로)', ja: '表現（聞いたまま）' },
        desc: { ko: '한국어로 들은 그대로 적어 주세요.', ja: '韓国語で聞いたまま書いてください（カタカナでもOK）。' },
        placeholder: { ko: '예: 시마이하자', ja: '例：시마이하자 / シマイハジャ' } },
      { key: 'tag', type: 'choice', required: true,
        label: { ko: '종류', ja: '種類' },
        options: [
          { key: '사투리', label: { ko: '사투리', ja: '方言' } },
          { key: '말버릇', label: { ko: '말버릇', ja: '口癖' } },
          { key: '외래어', label: { ko: '외래어', ja: '外来語' } },
          { key: '추정', label: { ko: '잘 모르겠어요 (추정)', ja: 'よく分からない（推定）' } },
        ] },
      { key: 'meaning', type: 'text', max: 200,
        label: { ko: '뜻', ja: '意味' },
        desc: { ko: '몰라도 괜찮아요! 비워 두면 “의미 조사 중”으로 올라가요.', ja: '分からなくても大丈夫！空欄なら「意味を調査中」で載ります。' },
        placeholder: { ko: '예: 끝내자, 마무리하자', ja: '例：終わりにしよう' } },
      { key: 'tip', type: 'text', max: 300,
        label: { ko: '팁 (언제 쓰시는지 · 어떻게 대응하면 좋은지)', ja: 'コツ（いつ使うか・どう対応すればいいか）' },
        placeholder: { ko: '예: 수업을 정리할 때의 신호. 남은 질문은 이때 빨리!', ja: '例：授業を締めくくる合図。残った質問はこのタイミングで！' } },
    ],
  },
  {
    key: 'other', icon: '✨', file: 'CONTRIBUTING.md', page: null,
    title: { ko: '기타 · 사이트 의견', ja: 'その他・サイトへの意見' },
    desc: { ko: '사이트 요청 · 후배에게 조언 (관리자만 봐요)', ja: 'サイトへの要望・後輩へのアドバイス（管理者のみ）' },
    cmd: 'feedback',
    oneOf: ['feedback', 'advice'],
    fields: [
      { key: 'feedback', type: 'textarea', max: 1000,
        label: { ko: '사이트에 추가됐으면 하는 정보 · 기능', ja: 'サイトに欲しい情報・機能' } },
      { key: 'advice', type: 'textarea', max: 1000,
        label: { ko: '후배나 학과 친구들에게 전하는 조언', ja: '後輩やみんなへのアドバイス' } },
    ],
  },
];

export const kindOf = (key) => KINDS.find((k) => k.key === key);

/** 교수님 데이터로 선택지 만들기 — 성향 항목 · 상황 카드 (서버에 실제로 있는 것만) */
export function resolveOptions(field, prof) {
  if (field.options === 'traits') {
    const list = prof?.traits?.length ? prof.traits.map((t) => t.label) : DEFAULT_TRAITS;
    return list.map((l) => ({ key: l.ko, label: l }));
  }
  if (field.options === 'scenes') {
    const scenes = (prof?.scenes || []).filter((s) => !s.contrib); // 제보로 만든 카드는 DB에 없음
    return [
      ...scenes.map((s) => ({ key: s.tab, label: s.title, mono: s.tab })),
      { key: NEW_SCENE, label: { ko: '+ 새 상황 만들기', ja: '+ 新しい場面を作る' } },
    ];
  }
  return field.options || [];
}

/** 관리자 화면 등에서 저장된 값 → 라벨 */
export function optionLabel(kind, field, value, prof) {
  const f = kindOf(kind)?.fields.find((x) => x.key === field);
  if (!f) return { ko: String(value), ja: String(value) };
  const found = resolveOptions(f, prof).find((o) => o.key === value);
  return found?.label ?? { ko: String(value), ja: String(value) };
}
