/* ==========================================================================
   후까 교수님 데이터 — 설문 수집 중
   jeong.jsx와 같은 모양으로 채우면 바로 화면에 반영됩니다.
   - 번역할 문자열은 { ko: '…', ja: '…' } 로 씁니다.
   - 비어 있는 항목([] 또는 null)은 화면에 "수집 중"으로 표시됩니다.
   ========================================================================== */

export default {
  id: 'fukka',
  name: { ko: '후까 교수님', ja: 'フカ教授' },
  short: { ko: '후까', ja: 'フカ' },

  /* 히어로 */
  avatar: null, // 이미지가 생기면: import avatar from '../../assets/fukka.jpg';
  avatarAlt: { ko: '후까 교수님 일러스트', ja: 'フカ教授のイラスト' },
  avatarSize: '—',
  badges: { status: { ko: '● 설문 수집 중', ja: '● アンケート収集中' }, music: null },
  synopsis: [
    { ko: '--면담', ja: '--面談' },
    { ko: '--과제-피드백', ja: '--課題-フィードバック' },
    { ko: '--질문', ja: '--質問' },
    { ko: '--스몰토크', ja: '--雑談' },
  ],
  code: [
    [{ k: 'role', v: { ko: ['전공교수'], ja: ['専攻教授'] } }],
    [{ k: 'status', v: { ko: '설문 수집 중', ja: 'アンケート収集中' }, note: 'TODO' }],
  ],

  status: null,

  survey: null,
  traits: [],
  traitsLead: null,
  traitsSub: null,

  scenes: [],
  warnings: [],
  talk: [],

  dictDesc: null,
  dict: [],
  dictPreview: [],

  posts: [],
};
