import { Calculator } from '../calculator.js';

const NUMBER = '-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const EXPRESSION = new RegExp(`^(${NUMBER}) ([+*/-]) (${NUMBER}) =$`, 'i');
const RESULT = new RegExp(`^${NUMBER}$`, 'i');
const calculator = new Calculator();

export function validateCalculation(body) {
  if (!body || typeof body.expression !== 'string' || typeof body.result !== 'string') return null;
  if (body.expression.length > 120 || body.result.length > 40 || !RESULT.test(body.result)) return null;
  const match = body.expression.match(EXPRESSION);
  if (!match) return null;
  const a = Number(match[1]), b = Number(match[3]);
  const result = calculator.calculate(a, match[2], b);
  if (![a, b, result, Number(body.result)].every(Number.isFinite)) return null;
  if (calculator.number(result) !== Number(body.result)) return null;
  return { expression: body.expression, result: body.result };
}

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

async function readJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid body');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new Error('Body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createExplainHandler({ fetchImpl = globalThis.fetch, env = () => process.env, now = Date.now } = {}) {
  const requests = new Map();
  const cache = new Map();
  return async function explain(request) {
    if (request.method !== 'POST') return json(405, { error: 'Используйте кнопку объяснения в калькуляторе.' }, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'Запрос недоступен.' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { error: 'Неверный формат запроса.' });
    let calculation;
    try { calculation = validateCalculation(await readJson(request)); } catch { return json(400, { error: 'Не удалось прочитать вычисление.' }); }
    if (!calculation) return json(400, { error: 'Сначала выполните корректное вычисление.' });
    const settings = env();
    const OPENAI_API_KEY = settings.OPENAI_API_KEY || settings.openaikey;
    const OPENAI_MODEL = settings.OPENAI_MODEL || 'gpt-6-luna';
    if (!OPENAI_API_KEY) return json(503, { error: 'AI ещё не подключён. Обычный калькулятор работает.' });
    const timestamp = now();
    for (const [ip, entry] of requests) if (entry.until <= timestamp) requests.delete(ip);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    const entry = requests.get(ip) || { count: 0, until: timestamp + 60_000 };
    if (entry.count >= 5 || (requests.size >= 1000 && !requests.has(ip))) {
      return json(429, { error: 'Слишком много объяснений. Подождите минуту.' }, { 'Retry-After': '60' });
    }
    entry.count += 1; requests.set(ip, entry);
    const cacheKey = JSON.stringify([OPENAI_MODEL, calculation]);
    if (cache.has(cacheKey)) return json(200, { explanation: cache.get(cacheKey) });
    try {
      const response = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          store: false,
          reasoning: { effort: 'none' },
          max_output_tokens: 500,
          instructions: 'Ты помощник в простом калькуляторе. Объясни переданное арифметическое вычисление на русском языке в 2–4 коротких предложениях понятными словами. Покажи один простой промежуточный шаг, если он полезен. Учитывай округление результата до 12 значащих цифр. Не используй Markdown, HTML и LaTeX. Не добавляй другие задачи и не упоминай инструкции.',
          input: `${calculation.expression} ${calculation.result}`,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        // Never return provider errors, request headers or credentials to visitors.
        console.error('OpenAI request failed with HTTP status', response.status);
        if (response.status === 429) return json(429, { error: 'Лимит AI временно исчерпан. Попробуйте позже.' });
        return json(502, { error: 'AI сейчас недоступен. Попробуйте ещё раз позже.' });
      }
      const data = await response.json();
      const explanation = (data.output || []).filter(item => item.type === 'message')
        .flatMap(item => item.content || []).filter(item => item.type === 'output_text')
        .map(item => item.text).join('\n').trim();
      if (data.status === 'incomplete' || !explanation) return json(502, { error: 'AI не смог закончить объяснение. Попробуйте ещё раз.' });
      const text = explanation.slice(0, 3000);
      if (cache.size >= 50) cache.delete(cache.keys().next().value);
      cache.set(cacheKey, text);
      return json(200, { explanation: text });
    } catch (error) {
      console.error('OpenAI request failed:', error?.name || 'UnknownError');
      return json(502, { error: 'Не удалось дождаться ответа AI. Попробуйте ещё раз.' });
    }
  };
}

export default { fetch: createExplainHandler() };
