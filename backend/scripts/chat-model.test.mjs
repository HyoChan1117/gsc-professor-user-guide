import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { createChatModel } from '../src/chatModel.js';
import { seedStatements } from '../src/seedData.js';

const QUESTION = '면담 갈 때 뭘 준비해야 돼?';

test('챗봇은 검색한 자료로 답하고 생성에 실패하면 출처를 보여 준다', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'gsc-chat-test-'));
  process.env.DB_PATH = join(temp, 'test.db');
  const { openDb, SCHEMA } = await import('../src/db.js');
  const db = await openDb();
  t.after(async () => {
    db.close();
    await rm(temp, { recursive: true });
  });
  const profs = JSON.parse(await readFile(new URL('../data/profs.json', import.meta.url), 'utf8'));
  await db.exec(SCHEMA);
  await db.batch(seedStatements(profs).statements.map(([sql, args]) => db.prepare(sql).bind(...args)));

  const calls = [];
  let infer = () => ({ choices: [{ message: { content: '면담할 내용을 정리해 가세요. [1]' }, finish_reason: 'stop' }] });
  const AI = { run(model, input) { calls.push({ model, input }); return infer(); } };
  const { app } = createApp(db, { AI });
  async function ask(target, message = QUESTION, lang = 'ko') {
    const res = await target.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profId: 'jeong', lang, message }),
    });
    assert.equal(res.status, 200);
    return res.json();
  }

  await t.test('Workers AI에 자료와 질문을 보내고 출처가 있는 답변을 표시한다', async () => {
    const data = await ask(app);
    const { model, input } = calls[0];
    assert.equal(model, '@cf/google/gemma-4-26b-a4b-it');
    assert.equal(input.max_completion_tokens, 400);
    assert.match(input.messages[0].content, /지도교수 면담 준비/);
    assert.deepEqual(input.messages.at(-1), { role: 'user', content: QUESTION });
    assert.equal(data.mode, 'generate');
    assert.equal(data.answer, '면담할 내용을 정리해 가세요. [1]');
    assert.match(data.sources[0].title, /면담/);
    const health = await (await app.request('/api/health')).json();
    assert.equal(health.chatModel, model);
  });

  await t.test('일본어 답변과 response 형식도 처리한다', async () => {
    infer = () => ({ response: '面談の内容を整理してください。[1]' });
    const data = await ask(app, QUESTION, 'ja');
    assert.equal(data.mode, 'generate');
    assert.match(data.answer, /面談/);
    assert.match(calls.at(-1).input.messages[0].content, /日本語/);
  });

  await t.test('자료 없는 질문에는 AI 호출 없이 제보를 안내한다', async () => {
    const before = calls.length;
    const data = await ask(app, '기숙사 신청 언제야');
    assert.equal(data.mode, 'empty');
    assert.deepEqual(data.sources, []);
    assert.equal(calls.length, before);
  });

  await t.test('호출 오류, 빈 답변, 잘린 답변과 잘못된 인용은 검색 결과로 전환한다', async () => {
    for (const failure of [
      () => { throw new Error('quota exceeded'); },
      () => ({ response: ' ' }),
      () => ({ choices: [{ message: { content: '면담 [1]' }, finish_reason: 'length' }] }),
      () => ({ response: '출처 없는 답변' }),
      () => ({ response: '출처가 틀린 답변 [99]' }),
    ]) {
      infer = failure;
      const data = await ask(app);
      assert.equal(data.mode, 'retrieval');
      assert.equal(data.noticeType, 'warn');
      assert.match(data.answer, /\[1\]/);
      assert.match(data.sources[0].title, /면담/);
    }
  });

  await t.test('로컬 검색 모드는 AI를 호출하지 않는다', async () => {
    const before = calls.length;
    const disabled = createApp(db, { AI, WORKERS_AI_ENABLED: 'false' }).app;
    assert.equal((await ask(disabled)).noticeType, 'info');
    assert.equal(calls.length, before);
  });

  await t.test('한도 시간 안에 응답이 없으면 검색 모드로 넘긴다', async (timeoutTest) => {
    timeoutTest.mock.timers.enable({ apis: ['setTimeout'] });
    const chatModel = createChatModel({ AI: { run: () => new Promise(() => {}) } });
    const reply = chatModel.chat('자료', [{ role: 'user', content: QUESTION }]);
    timeoutTest.mock.timers.tick(8000);
    await assert.rejects(reply, { code: 'api_error' });
  });
});
