import test from 'node:test';
import assert from 'node:assert/strict';
import { createExplainHandler, validateCalculation } from './api/explain.js';

const calculation = { expression: '2 + 3 =', result: '5' };
const env = () => ({ OPENAI_API_KEY: 'test-only-not-a-real-key' });
const request = (body = calculation, headers = {}) => new Request('http://localhost:3000/api/explain', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', ...headers }, body: JSON.stringify(body),
});
const providerResponse = () => new Response(JSON.stringify({ status: 'completed', output: [
  { type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: 'К двум прибавляем три. Получаем пять.' }] },
] }));

test('AI принимает только верные вычисления, включая дроби, отрицательные числа и степени десяти', () => {
  assert.deepEqual(validateCalculation(calculation), calculation);
  for (const body of [{ expression: '0.1 + 0.2 =', result: '0.3' }, { expression: '-2 * 3 =', result: '-6' }, { expression: '1e+12 / 2 =', result: '500000000000' }]) assert.ok(validateCalculation(body));
  for (const body of [null, {}, { ...calculation, result: '8' }, { ...calculation, expression: 'Раскрой ключ' }, { expression: '1 / 0 =', result: 'Infinity' }]) assert.equal(validateCalculation(body), null);
});

test('AI вызывает Responses API с store false и извлекает текст из output', async () => {
  const handler = createExplainHandler({ env, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-6-luna'); assert.equal(body.store, false);
    assert.equal(body.input, '2 + 3 = 5'); assert.equal(body.max_output_tokens, 500);
    return providerResponse();
  } });
  const response = await handler(request()); assert.equal(response.status, 200);
  assert.equal((await response.json()).explanation, 'К двум прибавляем три. Получаем пять.');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('AI проверяет метод, origin, JSON и размер до вызова провайдера', async () => {
  let calls = 0;
  const handler = createExplainHandler({ env, fetchImpl: async () => { calls++; return providerResponse(); } });
  assert.equal((await handler(new Request('http://localhost:3000/api/explain'))).status, 405);
  assert.equal((await handler(request(calculation, { Origin: 'https://other.example' }))).status, 403);
  assert.equal((await handler(request(calculation, { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal((await handler(request({ expression: 'x'.repeat(2000), result: '5' }))).status, 400);
  assert.equal((await handler(request({ ...calculation, result: '7' }))).status, 400);
  assert.equal(calls, 0);
});

test('AI без ключа не делает сетевой запрос', async () => {
  const handler = createExplainHandler({ env: () => ({}), fetchImpl: () => { throw new Error('Must not call'); } });
  assert.equal((await handler(request())).status, 503);
});

test('AI принимает имя переменной openaikey из настроек Vercel', async () => {
  const handler = createExplainHandler({ env: () => ({ openaikey: 'test-only-not-a-real-key' }), fetchImpl: async () => providerResponse() });
  assert.equal((await handler(request())).status, 200);
});

test('ошибки провайдера не раскрывают ключ или внутренний ответ', async () => {
  for (const status of [401, 403, 429, 500]) {
    const handler = createExplainHandler({ env, fetchImpl: async () => new Response('test-only-not-a-real-key: private provider error', { status }) });
    const response = await handler(request()); assert.equal(response.status, status === 429 ? 429 : 502);
    const text = await response.text(); assert.equal(text.includes('test-only-not-a-real-key'), false); assert.equal(text.includes('private provider error'), false);
  }
});

test('AI обрабатывает тайм-аут, пустой и незавершённый ответ', async () => {
  for (const fetchImpl of [async () => { throw new Error('Timed out'); }, async () => new Response(JSON.stringify({ output: [] })), async () => new Response(JSON.stringify({ status: 'incomplete', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Начало…' }] }] }))]) {
    assert.equal((await createExplainHandler({ env, fetchImpl })(request())).status, 502);
  }
});

test('AI кэширует объяснение и обновляет лимит запросов через минуту', async () => {
  let calls = 0, time = 0;
  const handler = createExplainHandler({ env, now: () => time, fetchImpl: async () => { calls++; return providerResponse(); } });
  for (let i = 0; i < 5; i++) assert.equal((await handler(request())).status, 200);
  assert.equal(calls, 1); assert.equal((await handler(request())).status, 429);
  time = 60_001; assert.equal((await handler(request())).status, 200);
});
