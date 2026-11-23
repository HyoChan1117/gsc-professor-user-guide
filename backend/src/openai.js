/* OpenAI REST 호출 — 검색용 임베딩만 사용 (답변 생성은 claude.js) */

const BASE = 'https://api.openai.com/v1';
export const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';

export class OpenAIError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call(path, body) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new OpenAIError(0, 'no_api_key', 'OPENAI_API_KEY가 .env에 없습니다.');
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new OpenAIError(res.status, json.error?.code || 'http_error', json.error?.message || `HTTP ${res.status}`);
  }
  return json;
}

/** 텍스트 여러 개 → Float32Array 벡터들 (OpenAI 임베딩은 길이 1로 정규화돼 있음) */
export async function embed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 100) {
    const json = await call('/embeddings', { model: EMBED_MODEL, input: texts.slice(i, i + 100) });
    for (const d of json.data.sort((a, b) => a.index - b.index)) out.push(Float32Array.from(d.embedding));
  }
  return out;
}
