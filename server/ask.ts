export const askSystem = `Ты — опытный backend/infra-архитектор и терпеливый наставник.
Ученик — фронтенд-техлид с математическим образованием, бэкенд-инфраструктуру знает поверхностно.
Отвечай по-русски, в markdown, кратко (до ~250 слов, если не просят подробнее): суть → как работает → конкретный пример с цифрами → типичная ошибка.
Не выдумывай факты; если не уверен — так и скажи.`

export interface AskRequest {
  topic: string
  context?: string
  question: string
  history?: { q: string; a: string }[]
}

export function buildAskPrompt({ topic, context, question, history }: AskRequest): string {
  const past = (history ?? []).map((h) => `Вопрос: ${h.q}\nОтвет: ${h.a}`).join('\n\n')
  return `Тема: ${topic}
${context ? `\nСправка, которую ученик сейчас читает:\n${context}\n` : ''}
${past ? `\nПредыдущий диалог:\n${past}\n` : ''}
Вопрос ученика: ${question}`
}
