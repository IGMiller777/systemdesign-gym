# 01. Обзор продукта

## Назначение

SysDesign Gym — локальный тренажёр по проектированию систем для фронтенд-разработчика, который хочет подтянуть бэкенд и инфраструктуру. Целевой читатель зашит прямо в промпт наставника (`server/ask.ts`): «фронтенд-техлид с математическим образованием, бэкенд-инфраструктуру знает поверхностно». Весь интерфейс и контент на русском.

Продукт совмещает три вещи:

1. **Учебник**: уроки, справочник компонентов в виде коллекционных карточек, путь обучения по модулям.
2. **Задачник**: задачи шести уровней от оценки «на салфетке» до дизайна сервиса с ИИ-проверкой.
3. **Игру**: симулятор дежурств в реальном времени, tower defense по безопасности, CTF против ИИ-агента, mock-интервью голосом, XP, кредиты, магазин и достижения.

## Стек

| Слой | Технологии |
|---|---|
| UI | React 19, React Router 8, Tailwind CSS 4 (+ typography), motion, lucide-react |
| Холсты и графики | `@xyflow/react` (React Flow) для схем, Recharts для метрик |
| Markdown | react-markdown, remark-gfm, rehype-highlight + свои плагины (термины, sequence-диаграммы, таймлайны) |
| Состояние | zustand + `persist` с собственным storage (файл через API + localStorage) |
| API | Hono + `@hono/node-server`, запускается через `node --watch --import tsx` |
| ИИ | Локальный Claude Code CLI (`claude -p`), модель по умолчанию `sonnet`, судья CTF на `haiku` |
| Сборка | Vite 8, TypeScript ~6.0, pnpm 11, Node 24 |
| Качество | Vitest (65 тестов), oxlint, свой скрипт проверки контента `scripts/check-content.ts` |
| Деплой | GitHub Actions → GitHub Pages (только статика) |

## Разделы приложения (маршруты)

Маршруты объявлены в `src/App.tsx`. Верхнее меню: Путь, Тренировка, Задачи, Дуэли, Дежурство, Интервью, Безопасность, Справочник; справа квесты дня, кредиты и звание.

| URL | Компонент | Что делает |
|---|---|---|
| `/` | `pages/Home.tsx` | Список задач по уровням и темам |
| `/task/:id` | `TaskPage` в `App.tsx` | Открывает задачу; вид зависит от `task.kind` (estimate/choice/bottleneck/design) |
| `/path`, `/path/:id` | `pages/Path.tsx` | Карта модулей обучения (граф на React Flow) и страница модуля |
| `/learn/:id` | `pages/Learn.tsx` | Урок-концепт с квизом |
| `/wiki`, `/wiki/:id` | `pages/Wiki.tsx` | Справочник: карточка, детали, реализации, сравнение, квиз, «объясни сам», вопрос наставнику |
| `/daily` | `Daily` в `pages/Practice.tsx` | Тренировка дня (до 10 элементов, интервальное повторение) |
| `/duels` | `Duels` в `pages/Practice.tsx` | Дуэли «что выбрать» |
| `/oncall`, `/oncall/:id` | `pages/Oncall.tsx` → `sim/SimGame.tsx` | Список и игра-дежурство |
| `/sandbox`, `/sandbox/company` | `pages/Oncall.tsx` | Песочница без таймера; песочница приватной компании |
| `/interview` | `pages/Interview.tsx` | Mock-интервью с ИИ (текст или голос), итоговый разбор |
| `/security`, `/security/defense/:id`, `/security/ctf[/:n]` | `pages/Security.tsx` | Хаб безопасности, Blue Team, CTF |
| `/profile`, `/shop` | `pages/Profile.tsx` | Профиль, квесты, достижения, журнал кредитов; магазин |

## Объём контента (посчитано по коду)

Цифры получены скриптом, который импортирует реальные массивы данных.

| Сущность | Количество | Где лежит |
|---|---|---|
| Задачи | **56**: 16 оценок (L1), 22 выбора (L2), 6 «найди узкое место» (L3), 12 дизайнов (L4: 2, L5: 7, L6: 3) | `src/tasks/*.ts` |
| Уроки-концепты | **41** | `src/learn/concepts-*.ts` |
| Модули пути обучения | **12** | `src/learn/curriculum.ts`, `module-*.ts` |
| Статьи справочника | **37** в 12 категориях | `src/wiki/entries.ts`, `*-wiki.ts`, `entry-vector.ts` |
| Карточки (игровой слой статьи) | **37** | `src/wiki/cards-*.ts`, `*-wiki.ts`, `card-vector.ts` |
| Дуэли | **52**: 35 backend, 17 frontend | `src/duels/*.ts` |
| Сценарии дежурства | **30**: 8 базовых, 4 хардкор, 6 «Наследство», 4 ops, 2 frontend, 3 LLM, 3 легендарных | `src/sim/*scenarios*.ts`, `hardcore.ts`, `inherited.ts` |
| Blue Team | 6 уровней, 22 защиты, 16 атак | `src/defense/` |
| CTF «Взломай агента» | 6 уровней | `server/ctf.ts` |
| Mock-интервью | 10 задач: 5 backend, 3 frontend, 2 LLM; 3 режима интервьюера | `src/interview/problems.ts` |
| Достижения | 32 | `src/game/defs.ts` |
| Товары магазина | 16 | `src/game/defs.ts` |

### Сценарии дежурства по группам

- **Базовые:** `first-shift`, `morning-reads`, `black-friday`, `cache-flush`, `slow-payments`, `primary-down`, `ddos`, `chain`.
- **Хардкор** (тот же инцидент, очевидный блок запрещён): `morning-reads-hc`, `black-friday-hc`, `primary-down-hc`, `ddos-hc`.
- **Наследство** (менять можно только настройки): `inh-dead-cache`, `inh-slow-query`, `inh-too-many-connections`, `inh-redis-oom`, `inh-slow-payments`, `inh-lag-and-static`.
- **Эксплуатация:** `ops-zone-outage`, `ops-sleepy-limiter`, `ops-rebalance-storm`, `ops-living-dead`.
- **Фронтенд:** `fe-ssr-meltdown`, `fe-reconnect-storm`.
- **LLM:** `llm-provider-down`, `llm-agent-loop`, `llm-reindex-herd`.
- **Легендарные** (покупаются в магазине за 200 🪙): `legend-cloudflare-regex`, `legend-aws-s3`, `legend-gitlab-db`.
- **ИИ-сценарии**: генерируются по запросу (`/api/scenario`) и сохраняются в прогресс игрока.

### Модули пути обучения

| id | Требует | Босс |
|---|---|---|
| `web-basics` | — | сценарий `first-shift` |
| `data` | web-basics | сценарий `inh-slow-query` |
| `caching` | web-basics | сценарий `morning-reads` |
| `scaling` | data | сценарий `primary-down` |
| `async` | caching, scaling | сценарий `black-friday` |
| `special` | data | задача `ds-file-upload` |
| `ops` | async, scaling | сценарий `ops-zone-outage` |
| `resilience` | async | сценарий `ddos` |
| `platform` | resilience, special | сценарий `chain` |
| `security` | web-basics, data | Blue Team `def-6` |
| `frontend` | web-basics, caching | сценарий `fe-ssr-meltdown` |
| `llm` | async, special | сценарий `llm-provider-down` |

Модуль открывается, когда каждый требуемый модуль пройден хотя бы на 70%.
