/* ==========================================================================
   Cloudflare Workers 진입점 — wrangler.jsonc 의 main
   - /api/* 만 이 코드가 처리 (app.js). 나머지 화면 파일(frontend/dist)은 Cloudflare 가 바로 내줌
     (wrangler.jsonc assets: SPA 경로는 index.html)
   - DB: D1 (바인딩 이름 DB), 설정: Worker 환경 변수 · 시크릿 (ADMIN_PASSWORD, ANTHROPIC_API_KEY …)
   ========================================================================== */
import { wrapD1 } from './d1.js';
import { createApp } from './app.js';

let cached = null; // 인스턴스마다 한 번 만들고 재사용 (요청 제한 기록 · 검색 색인 캐시 유지)

export default {
  async fetch(request, env, ctx) {
    if (!cached || cached.d1 !== env.DB) {
      cached = { d1: env.DB, ...createApp(wrapD1(env.DB), env) };
    }
    return cached.app.fetch(request, env, ctx);
  },
};
