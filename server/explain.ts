export const explainSchema = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    verdict: { type: 'string' },
    correct: { type: 'array', items: { type: 'string' } },
    missing: { type: 'array', items: { type: 'string' } },
    wrong: { type: 'array', items: { type: 'string' } },
    model: { type: 'string' },
  },
  required: ['score', 'verdict', 'correct', 'missing', 'wrong', 'model'],
}

export const explainSystem = `Ты — наставник по архитектуре. Ученик объясняет тему своими словами (active recall).
Пиши по-русски, коротко, дружелюбно, без воды.
score 0–100: 70+ — ученик понимает суть и может объяснить коллеге. Не снижай за стиль и краткость, снижай за ошибки и упущенную главную мысль.
verdict — 1 предложение.
correct — что ученик сказал верно (1–3 пункта). missing — самое важное, что упущено (0–3). wrong — фактические ошибки или заблуждения (0–3, только реальные).
model — эталонный ответ на 2–4 предложения, конкретно и с цифрами где уместно.
Опирайся на справку, но не требуй дословного совпадения.`

export interface ExplainRequest {
  topic: string
  question: string
  answer: string
  reference: string
}

export function buildExplainPrompt(b: ExplainRequest): string {
  return `Тема: ${b.topic}
Вопрос: ${b.question}

Справка (для проверки, ученик её не видит):
${b.reference}

Ответ ученика:
${b.answer}`
}
