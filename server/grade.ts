export const gradeSchema = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    verdict: { type: 'string' },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterion: { type: 'string' },
          status: { type: 'string', enum: ['met', 'partial', 'missed'] },
          comment: { type: 'string' },
        },
        required: ['criterion', 'status', 'comment'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } },
    followUp: { type: 'string' },
  },
  required: ['score', 'verdict', 'criteria', 'strengths', 'issues', 'followUp'],
}

export const gradeSystem = `Ты — строгий, но доброжелательный staff-инженер, который проверяет решения задач по проектированию систем.
Оцениваешь по рубрике. Пиши по-русски, кратко и конкретно, технические термины можно на английском.
Не засчитывай критерий, если он не отражён явно в схеме или в тексте решения. Частично — "partial".
score: 0–100, где 70+ — решение прошло бы собеседование на senior.
verdict: 1–2 предложения итога.
issues: конкретные дыры — что сломается, при какой нагрузке или сбое.
followUp: один острый уточняющий вопрос интервьюера, бьющий в самое слабое место решения.`

export interface GradeRequest {
  task: { title: string; prompt: string; requirements: string[]; rubric: string[] }
  design: {
    nodes: { id: string; type: string; label: string }[]
    edges: { source: string; target: string; label?: string }[]
    notes: Record<string, string>
  }
  answerToFollowUp?: { question: string; answer: string }
}

export function buildGradePrompt({ task, design, answerToFollowUp }: GradeRequest): string {
  const nodes = design.nodes.map((n) => `- [${n.id}] ${n.type}: ${n.label}`).join('\n') || '(пусто)'
  const edges =
    design.edges.map((e) => `- ${e.source} → ${e.target}${e.label ? ` (${e.label})` : ''}`).join('\n') || '(нет)'
  const notes =
    Object.entries(design.notes)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `### ${k}\n${v}`)
      .join('\n\n') || '(нет)'
  return `# Задача: ${task.title}

${task.prompt}

## Требования
${task.requirements.map((r) => `- ${r}`).join('\n')}

## Рубрика
${task.rubric.map((r, i) => `${i + 1}. ${r}`).join('\n')}

# Решение кандидата

## Блоки схемы
${nodes}

## Связи
${edges}

## Текст решения
${notes}
${
  answerToFollowUp
    ? `\n## Ответ кандидата на уточняющий вопрос\nВопрос: ${answerToFollowUp.question}\nОтвет: ${answerToFollowUp.answer}\nУчти ответ при оценке.`
    : ''
}

Оцени решение по каждому пункту рубрики.`
}
