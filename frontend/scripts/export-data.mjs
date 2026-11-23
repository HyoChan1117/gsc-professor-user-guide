/* ==========================================================================
   프론트 데이터(src/data/profs) → backend/data/profs.json 내보내기
   - Vite로 불러오므로 JSX · 이미지 import가 들어 있어도 그대로 읽힙니다.
   - JSX로 쓴 문장(예: traitsLead)은 일반 텍스트로 바꿉니다.
   실행: npm run export-data   (frontend 폴더에서)
   ========================================================================== */
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../backend/data/profs.json');

// React 엘리먼트 → 텍스트
function toText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (typeof node === 'object' && node.props) return toText(node.props.children);
  return '';
}

// 값 전체를 JSON으로 저장 가능한 형태로 (엘리먼트는 텍스트, 이미지는 제외)
function clean(value, key) {
  if (key === 'avatar') return value ? true : null; // 경로 대신 "이미지 있음" 여부만
  if (value && typeof value === 'object' && '$$typeof' in value) return toText(value);
  if (Array.isArray(value)) return value.map((v) => clean(v));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, k)]));
  }
  return value;
}

const server = await createServer({
  root: resolve(here, '..'),
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

try {
  const { PROFS } = await server.ssrLoadModule('/src/data/profs/index.js');
  const data = PROFS.map((p) => clean(p));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✓ ${data.length}명 내보냄 → ${OUT}`);
} finally {
  await server.close();
}
