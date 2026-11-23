/* ==========================================================================
   챗봇이 답하지 못한 질문 → 제보 페이지에 "받은 질문"으로 보여 주기
   - 이 탭(sessionStorage)에만 저장. 서버로 따로 보내지 않음 (질문은 이미 챗봇 기록에 있음)
   - 제보를 보내거나 배너를 닫으면 지움
   ========================================================================== */
const KEY = 'gsc-asked';

export function setAsked(question) {
  try { sessionStorage.setItem(KEY, String(question || '').slice(0, 200)); } catch { /* 저장소 사용 불가 */ }
}

export function getAsked() {
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function clearAsked() {
  try { sessionStorage.removeItem(KEY); } catch { /* 무시 */ }
}
