import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { PROFS } from '../data/profs/index.js';

/* ==========================================================================
   교수님 데이터
   - 처음엔 data/profs/*.jsx(기본 데이터)로 바로 그리고,
   - 서버(GET /api/profs/:id — DB + 관리자가 게시한 선배 제보)를 받아 오면 그 내용으로 바꿈
   - 서버에 연결할 수 없으면 기본 데이터 그대로
   ========================================================================== */
const KEY = 'gsc-prof';
const ProfContext = createContext(null);

// 서버 데이터로 바꾸는 항목 (나머지 — 사진 · 한마디 게시판 · 강조 글씨가 있는 문장 등은 기본 데이터 유지)
const FROM_DB = ['name', 'short', 'badges', 'synopsis', 'code', 'status', 'survey', 'traits', 'scenes', 'warnings', 'talk', 'dictDesc', 'dict', 'dictPreview', 'contribCount'];

// 처음 선택값: ?prof=fukka → 지난번 선택(localStorage) → 목록 첫 번째
function initialId() {
  const fromUrl = new URLSearchParams(window.location.search).get('prof');
  if (PROFS.some((p) => p.id === fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(KEY);
    if (PROFS.some((p) => p.id === saved)) return saved;
  } catch { /* 저장소 사용 불가 */ }
  return PROFS[0].id;
}

function merge(base, remote) {
  if (!remote) return base;
  const out = { ...base };
  for (const k of FROM_DB) if (remote[k] !== undefined && remote[k] !== null) out[k] = remote[k];
  // 성향 요약 문장: 기본 데이터는 <em> 강조가 들어간 JSX — DB 글과 내용이 같으면 기본 것을 씀
  if (remote.traitsLead && !base.traitsLead) out.traitsLead = remote.traitsLead;
  if (remote.traitsSub && !base.traitsSub) out.traitsSub = remote.traitsSub;
  out.fromDb = true;
  return out;
}

export function ProfProvider({ children }) {
  const [profId, setProfId] = useState(initialId);
  const [remote, setRemote] = useState({}); // profId → 서버 데이터

  useEffect(() => {
    try { localStorage.setItem(KEY, profId); } catch { /* 무시 */ }
  }, [profId]);

  const refresh = useCallback(async (id = profId) => {
    try {
      const res = await fetch(`/api/profs/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setRemote((r) => ({ ...r, [id]: data }));
    } catch { /* 서버 없음 → 기본 데이터 */ }
  }, [profId]);

  // 교수님을 바꿀 때마다 최신 데이터 (게시된 제보가 바로 보이도록 매번 새로)
  useEffect(() => { refresh(profId); }, [profId, refresh]);

  const base = PROFS.find((p) => p.id === profId) || PROFS[0];
  const prof = merge(base, remote[base.id]);
  return (
    <ProfContext.Provider value={{ prof, profId, setProfId, profs: PROFS, refresh }}>
      {children}
    </ProfContext.Provider>
  );
}

export function useProf() {
  return useContext(ProfContext);
}
