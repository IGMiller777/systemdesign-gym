import { concepts } from '../learn/concepts'
import { curriculum } from '../learn/curriculum'
import { cards } from '../wiki/cards'
import { moduleProgress } from '../learn/progress'
import { rankOf } from '../lib/blocks'
import { hardcoreScenarios } from '../sim/hardcore'
import { inheritedScenarios } from '../sim/inherited'
import { frontendScenarios, llmScenarios } from '../sim/fe-llm-scenarios'
import { interviewProblems } from '../interview/problems'
import { scenarios } from '../sim/scenarios'
import { simKey, streak, totalXp, type useProgress } from '../store'
import { shuffled } from '../wiki/Quiz'

type S = ReturnType<typeof useProgress.getState>

const count = (s: S, prefix: string, min = 1) => Object.entries(s.results).filter(([k, r]) => k.startsWith(prefix) && r.best >= min).length
const won = (s: S, ids: string[]) => ids.filter((id) => (s.results[simKey(id)]?.best ?? 0) > 0).length
const feat = (s: S, id: string) => (s.results[`feat:${id}`]?.best ?? 0) > 0

export interface Achievement {
  id: string
  emoji: string
  title: string
  text: string
  reward: number
  /** Hidden until unlocked. */
  secret?: boolean
  test: (s: S) => boolean
}

export const achievements: Achievement[] = [
  { id: 'first-blood', emoji: '🩸', title: 'Первая кровь', text: 'Реши первую задачу', reward: 5, test: (s) => Object.entries(s.results).some(([k, r]) => !k.includes(':') && r.best > 0) },
  { id: 'student', emoji: '📘', title: 'Студент', text: 'Пройди 5 уроков', reward: 15, test: (s) => count(s, 'concept:', 66) >= 5 },
  { id: 'professor', emoji: '🎓', title: 'Профессор', text: 'Пройди все уроки', reward: 65, test: (s) => count(s, 'concept:', 66) >= concepts.length },
  { id: 'collector', emoji: '🃏', title: 'Коллекционер', text: 'Освой 5 карточек', reward: 15, test: (s) => count(s, 'card:', 66) >= 5 },
  { id: 'deck-half', emoji: '🗂️', title: 'Полколоды', text: 'Освой 15 карточек', reward: 35, test: (s) => count(s, 'card:', 66) >= 15 },
  { id: 'full-deck', emoji: '👑', title: 'Полная колода', text: 'Освой все карточки колоды', reward: 100, test: (s) => count(s, 'card:', 66) >= Object.keys(cards).length },
  { id: 'explainer', emoji: '🗣️', title: 'Объяснятор', text: '5 раз объясни сам на 60+', reward: 20, test: (s) => count(s, 'explain:', 60) >= 5 },
  { id: 'sensei', emoji: '🥋', title: 'Сенсей', text: 'Объясни что-то на 90+', reward: 25, test: (s) => count(s, 'explain:', 90) >= 1 },
  { id: 'streak-3', emoji: '🔥', title: 'Разогрев', text: '3 дня подряд', reward: 10, test: (s) => streak(s.days) >= 3 },
  { id: 'streak-7', emoji: '🔥', title: 'Неделя огня', text: '7 дней подряд', reward: 35, test: (s) => streak(s.days) >= 7 },
  { id: 'streak-30', emoji: '☄️', title: 'Месяц без пропусков', text: '30 дней подряд', reward: 165, test: (s) => streak(s.days) >= 30 },
  { id: 'duelist', emoji: '⚔️', title: 'Дуэлянт', text: 'Серия из 5 побед в дуэлях', reward: 15, test: (s) => (s.results['duels:streak']?.best ?? 0) >= 5 },
  { id: 'gladiator', emoji: '🏛️', title: 'Гладиатор', text: 'Серия из 12 побед в дуэлях', reward: 50, test: (s) => (s.results['duels:streak']?.best ?? 0) >= 12 },
  { id: 'firefighter', emoji: '🧯', title: 'Пожарный', text: 'Переживи первое дежурство', reward: 15, test: (s) => won(s, scenarios.map((x) => x.id)) >= 1 },
  { id: 'veteran', emoji: '🎖️', title: 'Ветеран', text: 'Переживи все 8 дежурств', reward: 100, test: (s) => won(s, scenarios.map((x) => x.id)) >= 8 },
  { id: 'hardcore', emoji: '💀', title: 'Хардкорщик', text: 'Пройди хардкор', reward: 40, test: (s) => won(s, hardcoreScenarios.map((x) => x.id)) >= 1 },
  { id: 'inheritor', emoji: '🏚️', title: 'Наследник', text: 'Почини все 6 «Наследств»', reward: 85, test: (s) => won(s, inheritedScenarios.map((x) => x.id)) >= 6 },
  { id: 'flawless', emoji: '💎', title: 'Без единой царапины', text: 'Дежурство со 100% здоровья', reward: 35, test: (s) => feat(s, 'flawless') },
  { id: 'penny', emoji: '🪙', title: 'Скупердяй', text: 'Победа, потратив ≤ 70% бюджета', reward: 25, test: (s) => feat(s, 'penny') },
  { id: 'purist', emoji: '🧘', title: 'Без допинга', text: 'Победа без перков', reward: 20, test: (s) => feat(s, 'no-perks') },
  { id: 'module-1', emoji: '🌐', title: 'Первый модуль', text: 'Пройди модуль пути полностью', reward: 35, test: (s) => curriculum.some((m) => moduleProgress(m, s.results, s.srs).complete) },
  { id: 'halfway', emoji: '🧭', title: 'Полпути', text: 'Пройди 4 модуля', reward: 100, test: (s) => curriculum.filter((m) => moduleProgress(m, s.results, s.srs).complete).length >= 4 },
  { id: 'blue-team', emoji: '🛡️', title: 'Blue Team', text: 'Отбей все волны на 3 звезды', reward: 40, test: (s) => Object.entries(s.results).some(([k, r]) => k.startsWith('def:') && r.best >= 99) },
  { id: 'red-team', emoji: '🧙', title: 'Red Team', text: 'Взломай агента 6-го уровня', reward: 65, test: (s) => (s.results['ctf:6']?.best ?? 0) > 0 },
  { id: 'hired', emoji: '🤝', title: 'Оффер', text: 'Mock-интервью на 70+', reward: 40, test: (s) => count(s, 'interview:', 70) >= 1 },
  { id: 'interview-tracks', emoji: '🎤', title: 'Три трека', text: 'Интервью по бэкенду, фронтенду и LLM на 60+', reward: 85, test: (s) => ['backend', 'frontend', 'llm'].every((tr) => interviewProblems.some((p) => p.track === tr && (s.results[`interview:${p.id}`]?.best ?? 0) >= 60)) },
  { id: 'frontend-arch', emoji: '🖥️', title: 'Архитектор фронта', text: 'Переживи оба фронтенд-дежурства', reward: 40, test: (s) => won(s, frontendScenarios.map((x) => x.id)) >= frontendScenarios.length },
  { id: 'llm-ops', emoji: '🤖', title: 'LLMOps', text: 'Переживи все LLM-дежурства', reward: 50, test: (s) => won(s, llmScenarios.map((x) => x.id)) >= llmScenarios.length },
  { id: 'senior', emoji: '🧑‍💻', title: 'Сеньор', text: 'Достигни звания Senior', reward: 35, test: (s) => rankOf(totalXp(s.results)).current.xp >= 700 },
  { id: 'staff', emoji: '🧠', title: 'Стафф', text: 'Достигни звания Staff', reward: 85, test: (s) => rankOf(totalXp(s.results)).current.xp >= 1300 },
  { id: 'shopper', emoji: '🛍️', title: 'Шопоголик', text: 'Купи что-нибудь в магазине', reward: 5, secret: true, test: (s) => Object.keys(s.inventory).length > 0 || s.owned.length > 0 },
  { id: 'night-owl', emoji: '🦉', title: 'Сова', text: 'Позанимайся после полуночи', reward: 10, secret: true, test: () => new Date().getHours() < 5 },
]

export interface Quest {
  id: string
  emoji: string
  text: string
  /** Event type counted by the game watcher. */
  event: string
  target: number
  reward: number
  link: string
}

const questPool: Quest[] = [
  { id: 'q-lesson', emoji: '📘', text: 'Пройди 1 урок', event: 'lesson', target: 1, reward: 10, link: '/path' },
  { id: 'q-quiz', emoji: '🃏', text: 'Освой карточку (квиз 2/3+)', event: 'quiz', target: 1, reward: 10, link: '/wiki' },
  { id: 'q-duel', emoji: '⚔️', text: 'Выиграй 3 дуэли', event: 'duel', target: 3, reward: 10, link: '/duels' },
  { id: 'q-task', emoji: '🧩', text: 'Реши 2 задачи', event: 'task', target: 2, reward: 10, link: '/' },
  { id: 'q-explain', emoji: '🗣️', text: 'Объясни компонент на 60+', event: 'explain', target: 1, reward: 15, link: '/wiki' },
  { id: 'q-daily', emoji: '🔥', text: 'Пройди тренировку дня', event: 'daily', target: 1, reward: 15, link: '/daily' },
  { id: 'q-scenario', emoji: '🚨', text: 'Переживи дежурство', event: 'scenario', target: 1, reward: 20, link: '/oncall' },
  { id: 'q-inherited', emoji: '🏚️', text: 'Почини «Наследство»', event: 'inherited', target: 1, reward: 20, link: '/oncall' },
  { id: 'q-defense', emoji: '🛡️', text: 'Отбей волны в Blue Team', event: 'defense', target: 1, reward: 15, link: '/security' },
  { id: 'q-ctf', emoji: '🧙', text: 'Взломай агента (любой уровень)', event: 'ctf', target: 1, reward: 15, link: '/security/ctf' },
  { id: 'q-interview', emoji: '🎤', text: 'Пройди mock-интервью', event: 'interview', target: 1, reward: 20, link: '/interview' },
]

/** Credits per XP: 1 coin for every XP_PER_CREDIT XP earned. */
export const XP_PER_CREDIT = 4

export const CHEST_REWARD = 30

/** Three quests for the day, picked deterministically by date. */
export function questsFor(day: string): Quest[] {
  return shuffled(day, questPool.length)
    .slice(0, 3)
    .map((i) => questPool[i])
}

export interface ShopItem {
  id: string
  emoji: string
  name: string
  text: string
  cost: number
  /** perk = consumable; cosmetic and unlock = bought once. */
  kind: 'perk' | 'cosmetic' | 'unlock'
}

export const shop: ShopItem[] = [
  { id: 'perk-buddy', emoji: '🤖', name: 'ИИ-напарник', text: 'В дежурстве: ИИ смотрит на текущие метрики и подсказывает, куда копать', cost: 30, kind: 'perk' },
  { id: 'perk-coffee', emoji: '☕', name: 'Кофе-брейк', text: 'В дежурстве: 3 минуты бюджет ошибок не сгорает', cost: 45, kind: 'perk' },
  { id: 'perk-deploy', emoji: '⚡', name: 'Быстрый деплой', text: 'В дежурстве: следующее изменение железа без прогрева', cost: 35, kind: 'perk' },
  { id: 'perk-retry', emoji: '🔁', name: 'Второй шанс', text: 'В квизе: переответить после ошибки', cost: 10, kind: 'perk' },
  { id: 'perk-5050', emoji: '✂️', name: 'Убрать лишнее', text: 'В квизе убирает два неверных ответа, в дуэли из трёх вариантов один', cost: 15, kind: 'perk' },
  { id: 'perk-iv-hint', emoji: '💡', name: 'Подсказка интервьюера', text: 'В mock-интервью: интервьюер один раз даёт направление вопросом. Разбор это учтёт', cost: 25, kind: 'perk' },
  { id: 'perk-xray', emoji: '🧭', name: 'Рентген', text: 'В дежурстве: 3 минуты подсвечено главное узкое место', cost: 30, kind: 'perk' },
  { id: 'perk-undo', emoji: '⏪', name: 'Откат', text: 'В дежурстве: отменить последнее изменение схемы, без прогрева', cost: 25, kind: 'perk' },
  { id: 'perk-freeze', emoji: '🧊', name: 'Заморозка серии', text: 'Если пропустишь день, серия не сгорит. Срабатывает сама, в запасе не больше 2', cost: 40, kind: 'perk' },
  { id: 'legend-cloudflare-regex', emoji: '🌩️', name: 'Cloudflare, 2019', text: 'Легендарное дежурство: одна регулярка в WAF сжигает CPU по всему миру', cost: 200, kind: 'unlock' },
  { id: 'legend-aws-s3', emoji: '🪣', name: 'AWS S3, 2017', text: 'Легендарное дежурство: опечатка в команде роняет S3 в целом регионе', cost: 200, kind: 'unlock' },
  { id: 'legend-gitlab-db', emoji: '🦊', name: 'GitLab, 2017', text: 'Легендарное дежурство: rm -rf на primary, пока реплика пересоздаётся', cost: 200, kind: 'unlock' },
  { id: 'theme-blueprint', emoji: '📐', name: 'Тема «Чертёж»', text: 'Холсты в стиле синьки инженера', cost: 400, kind: 'cosmetic' },
  { id: 'theme-neon', emoji: '🌆', name: 'Тема «Неон»', text: 'Киберпанк-сетка с розовым свечением', cost: 500, kind: 'cosmetic' },
  { id: 'theme-matrix', emoji: '🟩', name: 'Тема «Матрица»', text: 'Зелёный терминал на чёрном', cost: 600, kind: 'cosmetic' },
  { id: 'foil', emoji: '✨', name: 'Голографические карточки', text: 'Освоенные карточки переливаются', cost: 800, kind: 'cosmetic' },
]
