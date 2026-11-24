/* ==========================================================================
   API 전체 점검 — 서버를 켠 상태에서:
     node scripts/smoke-test.mjs http://localhost:8787 [관리자 비밀번호]
     node scripts/smoke-test.mjs https://….workers.dev --readonly   (배포 직후 — 아무것도 쓰지 않음)
   비밀번호를 주면 제보 → 관리자 게시 → 챗봇 검색, 한마디 → 숨기기 → 삭제까지 확인하고
   테스트로 만든 제보 · 한마디는 지웁니다. (Node 서버 · 로컬 Cloudflare Worker · GitHub Actions 공용)
   ========================================================================== */
const BASE = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');
const READONLY = process.argv.includes('--readonly');
const PASSWORD = READONLY ? '' : (process.argv.slice(3).find((a) => !a.startsWith('--')) || '');
const EXPECT_RUNTIME = process.env.SMOKE_EXPECT_RUNTIME;

let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed += 1;
};
async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, type: res.headers.get('content-type') || '' };
}

const health = await call('/api/health');
ok(health.status === 200 && health.data?.ok && health.data.chunks > 0
  && (!EXPECT_RUNTIME || health.data.runtime === EXPECT_RUNTIME),
  'health', `chunks ${health.data?.chunks}, ${health.data?.runtime}`);

const home = await call('/');
ok(home.status === 200 && home.type.includes('text/html'), '화면 /');
const deep = await call('/dialect');
ok(deep.status === 200 && deep.type.includes('text/html'), '화면 /dialect (새로고침)');
const quizPage = await call('/quiz');
ok(quizPage.status === 200 && quizPage.type.includes('text/html'), '화면 /quiz (새로고침)');
ok((await call('/api/nope')).status === 404, '없는 API → 404');

const profs = await call('/api/profs');
ok(Array.isArray(profs.data) && profs.data.length >= 2, '교수님 목록', profs.data.map?.((p) => p.id).join(', '));
const view = await call('/api/profs/fukka');
ok(view.data?.talk?.length >= 6 && view.data?.dict?.length >= 7, '후까 교수님 데이터', `talk ${view.data?.talk?.length}, dict ${view.data?.dict?.length}`);

const opts = await call('/api/contrib/jeong/options');
ok(opts.data?.scenes?.length >= 3, '제보 폼 선택지');
const thread = await call('/api/thread/fukka');
ok(thread.status === 200 && Array.isArray(thread.data?.posts), '한마디 목록');
if (READONLY) {
  console.log(failed ? `\n✗ ${failed}개 실패` : '\n✓ 모두 통과 (읽기 전용 점검)');
  process.exit(failed ? 1 : 0);
}

const chat = await call('/api/chat', { method: 'POST', body: { profId: 'jeong', lang: 'ko', message: '면담 갈 때 뭘 준비해야 돼?' } });
ok(['retrieval', 'generate'].includes(chat.data?.mode) && chat.data.sources?.[0]?.title?.includes('면담'), '챗봇 검색', chat.data?.sources?.[0]?.title);
const empty = await call('/api/chat', { method: 'POST', body: { profId: 'jeong', lang: 'ko', message: '기숙사 신청 언제야' } });
ok(empty.data?.mode === 'empty', '자료 없는 질문 → 제보 유도');

const quiz = await call('/api/quiz', { method: 'POST', body: { profId: 'jeong', lang: 'ko' } });
ok(quiz.status === 200 && quiz.data?.questions?.length === 5 && quiz.data.questions.every((q) =>
  q.choices?.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4),
  '퀴즈', `${quiz.data?.mode} ${quiz.data?.questions?.length}문제`);

const marker = `스모크테스트${Date.now().toString(36)}`;
const contrib = await call('/api/contrib', { method: 'POST', body: { kind: 'talk', profId: 'jeong', lang: 'ko', grade: '2', title: marker, body: `${marker} 이야기를 좋아하신다는 테스트 제보` } });
ok(contrib.status === 201 && contrib.data.id, '제보 저장', `#${contrib.data?.id}`);

const post = await call('/api/thread', { method: 'POST', body: { profId: 'fukka', body: `>>1 ${marker} 한마디`, author: 'SmOkE1' } });
ok(post.data?.post?.anchor === '>>1 ', '한마디 저장 (답글 앵커)');
const list = await call('/api/thread/fukka');
ok(list.data?.posts?.some((p) => p.id === post.data?.post?.id), '한마디 목록에 보임');

if (PASSWORD) {
  ok((await call('/api/admin/overview')).status === 401, '관리자: 토큰 없으면 401');
  ok((await call('/api/admin/login', { method: 'POST', body: { password: 'wrong' } })).status === 401, '관리자: 틀린 비밀번호');
  const { data: login } = await call('/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
  const token = login?.token;
  ok(!!token, '관리자 로그인');
  ok((await call('/api/admin/overview', { token })).status === 200, '관리자 개요');

  const pub = await call(`/api/admin/contrib/${contrib.data.id}`, { method: 'PATCH', token, body: { status: 'published' } });
  ok(pub.data?.ok && pub.data.indexed, '제보 게시 + 챗봇 자료 생성');
  const found = await call('/api/chat', { method: 'POST', body: { profId: 'jeong', lang: 'ko', message: `${marker} 좋아하셔?` } });
  ok(found.data?.sources?.[0]?.title?.includes('선배 제보'), '게시한 제보를 챗봇이 찾음', found.data?.sources?.[0]?.title);
  const shown = await call('/api/profs/jeong');
  ok(shown.data?.talk?.some((t) => t.title?.ko === marker), '게시한 제보가 스몰토크에 보임');

  const hide = await call(`/api/admin/thread/${post.data.post.id}`, { method: 'PATCH', token, body: { status: 'hidden' } });
  ok(hide.data?.ok, '한마디 숨기기');
  ok(!(await call('/api/thread/fukka')).data?.posts?.some((p) => p.id === post.data.post.id), '숨긴 한마디는 목록에서 빠짐');

  // 정리
  ok((await call(`/api/admin/contrib/${contrib.data.id}`, { method: 'DELETE', token })).data?.ok, '테스트 제보 삭제');
  ok((await call(`/api/admin/thread/${post.data.post.id}`, { method: 'DELETE', token })).data?.ok, '테스트 한마디 삭제');
  const gone = await call('/api/chat', { method: 'POST', body: { profId: 'jeong', lang: 'ko', message: `${marker} 좋아하셔?` } });
  ok(!gone.data?.sources?.some((s) => s.title?.includes('선배 제보')), '삭제한 제보는 챗봇에서도 빠짐');
  const logs = await call(`/api/admin/chat?q=${encodeURIComponent(marker)}`, { token });
  for (const r of logs.data?.rows || []) await call(`/api/admin/chat/${r.id}`, { method: 'DELETE', token });
  await call('/api/admin/logout', { method: 'POST', token });
} else {
  console.log('… 관리자 비밀번호가 없어 게시 · 숨기기 점검과 테스트 데이터 정리는 건너뜀');
}

console.log(failed ? `\n✗ ${failed}개 실패` : '\n✓ 모두 통과');
process.exitCode = failed ? 1 : 0;
