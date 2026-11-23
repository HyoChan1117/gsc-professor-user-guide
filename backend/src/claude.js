/* ==========================================================================
   답변 생성 — Claude (Anthropic Messages API, 공식 SDK)
   자료 검색은 search.js(키워드 검색, API 키 없음). 키가 없으면 답변 대신 찾은 자료를 보여 줌.
   ========================================================================== */
import Anthropic from '@anthropic-ai/sdk';

// 설정은 configureClaude() 로 (Node: process.env, Cloudflare: Worker 환경 변수 · 시크릿)
export let CHAT_MODEL = 'claude-opus-5-5';
// 짧은 Q&A라 low로 충분 (low | medium | high | xhigh | max)
let EFFORT = 'low';
let API_KEY = '';

/** env: { ANTHROPIC_API_KEY?, CLAUDE_MODEL?, CLAUDE_EFFORT? } — 키가 바뀌면 클라이언트를 새로 만듦 */
export function configureClaude(env = {}) {
  CHAT_MODEL = env.CLAUDE_MODEL || 'claude-opus-5-5';
  EFFORT = env.CLAUDE_EFFORT || 'low';
  const key = env.ANTHROPIC_API_KEY || '';
  if (key !== API_KEY) { API_KEY = key; client = null; }
}

/** 답변 모델을 쓸 수 없을 때 — rag.js가 받아서 "검색 모드"로 전환 */
export class ChatUnavailableError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // no_api_key | auth | permission | model_not_found | rate_limited | refusal | connection | api_error
  }
}

/** Claude 키가 설정돼 있는지 (없으면 AI 기능은 건너뜀) */
export const claudeEnabled = () => !!API_KEY;

let client = null;
function getClient() {
  // 키가 없으면 API 를 부르지 않고 바로 검색 모드 · 기본 퀴즈로
  if (!API_KEY) throw new ChatUnavailableError('no_api_key', 'ANTHROPIC_API_KEY 가 설정되지 않음');
  if (!client) {
    try {
      client = new Anthropic({ apiKey: API_KEY });
    } catch (err) {
      throw new ChatUnavailableError('no_api_key', `Claude 클라이언트를 만들 수 없음: ${err.message}`);
    }
  }
  return client;
}

/** 공통 호출 + 오류 → ChatUnavailableError 변환. 텍스트 블록을 이어 붙여 반환 */
async function call({ system, messages, format }) {
  let res;
  try {
    res = await getClient().beta.messages.create({
      model: CHAT_MODEL,
      max_tokens: 16000,
      system,
      messages,
      output_config: { effort: EFFORT, ...(format ? { format } : {}) },
      // 안전 분류기가 거절하면 서버에서 알맞은 다른 모델로 자동 재시도
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (err) {
    if (err instanceof ChatUnavailableError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new ChatUnavailableError('auth', 'Claude API 키가 없거나 올바르지 않음');
    if (err instanceof Anthropic.PermissionDeniedError) throw new ChatUnavailableError('permission', err.message);
    if (err instanceof Anthropic.NotFoundError) throw new ChatUnavailableError('model_not_found', err.message);
    if (err instanceof Anthropic.RateLimitError) throw new ChatUnavailableError('rate_limited', err.message);
    if (err instanceof Anthropic.APIConnectionError) throw new ChatUnavailableError('connection', err.message);
    if (err instanceof Anthropic.APIError) throw new ChatUnavailableError('api_error', `${err.status}: ${err.message}`);
    throw err;
  }

  if (res.stop_reason === 'refusal') {
    throw new ChatUnavailableError('refusal', `답변 거절 (${res.stop_details?.category ?? 'unknown'})`);
  }
  if (res.stop_reason === 'max_tokens') {
    throw new ChatUnavailableError('api_error', '응답이 max_tokens에서 잘림');
  }
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new ChatUnavailableError('api_error', `빈 응답 (stop_reason: ${res.stop_reason})`);
  return text;
}

/**
 * system: 시스템 프롬프트 문자열
 * messages: [{ role: 'user' | 'assistant', content: string }, ...] (마지막은 user)
 */
export function chat(system, messages) {
  return call({ system, messages });
}

/**
 * 구조화 출력 — JSON 스키마에 맞는 객체를 받음 (output_config.format)
 * schema: JSON Schema (object, additionalProperties: false, required 포함)
 */
export async function generateJson(system, userText, schema) {
  const text = await call({
    system,
    messages: [{ role: 'user', content: userText }],
    format: { type: 'json_schema', schema },
  });
  try {
    return JSON.parse(text);
  } catch {
    throw new ChatUnavailableError('api_error', 'JSON 파싱 실패');
  }
}
