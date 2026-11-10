# 05. Модель контента и как его расширять

Весь контент это **типизированные TypeScript-объекты** в `src/`. Базы данных нет: добавить задачу или урок значит дописать объект в массив, и TypeScript проверит форму. Тексты в коде на русском и подчиняются стайлгайду `docs/writing-style.md`.

## Задачи (`src/tasks/`)

Типы в `src/tasks/types.ts`. Общие поля `BaseTask`: `id`, `title`, `level` (1–6), `topic`, `xp`, `prompt` (markdown условия), `explanation` (markdown разбора после ответа), `hints?`.

| `kind` | Уровни | Специфичные поля | Проверка | Компонент |
|---|---|---|---|---|
| `estimate` | 1 | `answer`, `unit`, `factor` | Мгновенно: ответ в `[answer/factor, answer×factor]` | `InstantViews.tsx` |
| `choice` | 2 | `options[{id,label,why}]`, `correct[]`, `multiple?` | Мгновенно, объяснение у каждого варианта | `InstantViews.tsx` |
| `bottleneck` | 3 | `nodes`, `edges`, `charts`, `correct` (id узла) | Мгновенно: клик по блоку схемы | `BottleneckView.tsx` |
| `design` | 4–6 | `requirements`, `starter?`, `rubric[]`, `reference` | ИИ по рубрике (`/api/grade`) + уточняющий вопрос | `DesignView.tsx` |

Темы (`Topic`): `estimation, postgres, cache, queues, storage, networking, search, analytics, reliability, frontend, llm`.

Файлы: `estimate.ts`, `choice.ts`, `bottleneck.ts`, `design.ts`, `frontend.ts`, `llm.ts`. `index.ts` объединяет их в `allTasks` и сортирует по уровню.

**Добавить задачу:** допишите объект в подходящий файл. `id` должен быть уникальным (он же ключ результата в прогрессе и часть URL `/task/:id`). Черновики дизайна сохраняются в `drafts[taskId]`.

## Уроки (`src/learn/`)

Тип `Concept` (`learn/types.ts`): `id`, `title`, `emoji`, `tagline`, `analogy`, `sections[{title, body}]` (markdown), `keyPoints[]`, `compare?` (таблица), `diagram?`, `related[]` (id статей справочника), `quiz` (ровно 3 вопроса).

Файлы `concepts-1.ts`, `concepts-2.ts`, `concepts-ops.ts`, `concepts-ops2.ts`, `concepts-sec.ts`, `concepts-frontend.ts`, `concepts-llm.ts`, объединение в `concepts.ts`. Урок засчитан при квизе ≥ 66 (2 из 3).

В markdown уроков доступны расширения рендерера (`src/components/Markdown.tsx`):

- блок ` ```seq ` рисует диаграмму обмена сообщениями (парсер `seq.ts`, компонент `SequenceDiagram.tsx`);
- таймлайны (`timeline-parse.ts`, `Timeline.tsx`) и блоки перков (`perks-parse.ts`, `Perks.tsx`);
- сокращения из словаря `glossary.ts` автоматически получают всплывающие подсказки (`rehype-terms.ts`, `Term.tsx`);
- ссылки `/wiki/<id>` и `/learn/<id>` проверяются скриптом.

## Путь обучения (`learn/curriculum.ts`)

`Module`: `id`, `emoji`, `title`, `goal`, `requires[]` (id модулей), `steps[]`, `boss`. Шаг (`Step`) бывает: `concept`, `card`, `task`, `duel`, `explain` (с аспектом), `scenario` (может быть `optional`), `defense`, `ctf`. Каждый модуль идёт по схеме «понять → познакомиться с компонентами → практика → сравнение → объяснить → босс».

Когда шаг считается пройденным (`learn/progress.ts`, `stepDone`):

| Шаг | Условие |
|---|---|
| concept | `concept:<id>` ≥ 66 |
| card | `card:<id>` ≥ 66 |
| task | результат > 0 |
| duel | SRS-ящик `duel:<id>` ≥ 1 |
| explain | `explain:<id>:<aspect>` ≥ 60 |
| scenario | `sim:<id>` > 0 |
| defense | `def:<id>` > 0 |
| ctf | `ctf:<n>` > 0 |

Модуль открыт, когда каждый из `requires` пройден на ≥ 70%. Необязательные сценарии не входят в прогресс. `nextStep()` выдаёт первый незавершённый шаг первого открытого модуля.

## Справочник и карточки (`src/wiki/`)

Два слоя на один компонент, связанные общим `id`:

- **`WikiEntry`** (техническая статья): `category`, `block?` (связь с блоком холста), `tagline`, `what`, `how`, `whenToUse`, `whenNotToUse`, `pairsWith`, `pros`, `cons`, `scaling`, `failureModes`, `numbers`, `alternatives`, `inPractice` (российский стек), `diagram?`. Источники: `entries.ts`, `entry-vector.ts`, `frontend-wiki.ts`, `llm-wiki.ts`.
- **`WikiCard`** (игровая карточка): `emoji`, `rarity` (common/rare/epic/legendary), `stats` (скорость, масштаб, надёжность, цена, сложность по 1–5), `superpower`, `weakness`, `analogy`, `tldr` (ровно 3), `example`, `setup` (инфографика 3–6 узлов), `quiz` (ровно 3). Источники: `cards-a.ts`, `cards-b.ts`, `card-vector.ts` и карточки в `*-wiki.ts`.

Дополнительно: `Implementation` (конкретные продукты под роль: mainstream/niche/ru/managed, `impl-data.ts`, `impl-infra.ts`), `CompareTable` (сравнение концептуально разных вариантов, `compare-data.ts`, `extra-vector.ts`).

Карточка освоена при квизе ≥ 66 → +20 XP (`CARD_XP`).

## «Объясни сам» (`src/practice/`)

7 аспектов (`aspects.ts`): `essence`, `pros`, `cons`, `whenNot`, `breaks`, `scale`, `compare`. Вопрос генерируется шаблоном из статьи, эталон для ИИ собирается из соответствующих полей `WikiEntry`, ответ проверяет `/api/explain`. Ключ результата `explain:<entryId>:<aspect>`.

## Дуэли (`src/duels/`)

`Duel`: `id`, `track` (backend/frontend), `topic`, `situation` (2–4 предложения с цифрами), `options` (2–3, с `cardId` на справочник), `correct`, `why`, `price` (чем платишь за победителя), `flip` (когда победил бы другой). Файлы: `duels.ts`, `duels-frontend.ts`, `duels-llm.ts`, `duels-sec.ts`. Результат хранится в SRS, ключ `duel:<id>`.

## Тренировка дня (`pages/Practice.tsx`)

`buildSession` собирает до 10 элементов: сначала до 7 просроченных SRS-повторений, затем свежий микс (2 вопроса из неосвоенных карточек, 2 оценки, 2 дуэли, 1 «объясни сам»). Выбор детерминирован датой (сид). За прохождение `daily:<день>` даёт +30 XP.

## Сценарии дежурства (`src/sim/`)

Тип `Scenario` описан в [04-simulator.md](04-simulator.md). Обязательные поля: `id`, `title`, `level`, `briefing`, `durationMin`, `baseLoad`, `events`, `slo`, `errorBudgetMin`, `budgetPerMonth`, `startGraph`, `debrief`. Режимы задаются полями:

- `bannedBlocks[{type, reason}]` + `hardOf: <id обычного>` → хардкор, открывается после победы в обычной версии;
- `configOnly: true` → «Наследство», менять можно только knobs.

**Добавить сценарий:** допишите объект в нужный массив, затем добавьте этот массив в подсчёт XP (`totalXp` в `store.ts`), если создаёте новый файл. Прогоните сценарий вручную в песочнице или напишите бот-тест (см. [08-findings.md](08-findings.md)).

## Blue Team (`src/defense/`)

- `catalog.ts`: 22 защиты (`Defense`: зона, цена, трение 0–3, реальные инструменты) и 16 атак (`Attack`: путь по зонам, `counters` с эффективностью 0..1, урон доверию, объяснение, класс реальных инцидентов).
- `levels.ts`: 6 уровней (`DefenseLevel`: брифинг, схема системы, доверие, бюджет, доступные защиты, предустановленные, волны с бонусным бюджетом и разведкой, разбор).
- `engine.ts`: `runWave` проводит каждую атаку по зонам `edge → app → data → agent → supply → people`; каждая установленная защита в текущей зоне блокирует с вероятностью `effectiveness` (ГПСЧ `mulberry32` с сидом, детерминированно). `scoreLevel` даёт звёзды: 1 при доверии > 0, 2 при ≥ 60, 3 при ≥ 80, трении ≤ 8 и бюджете в пределах.
- Ключ результата `def:<levelId>`, `best = звёзды × 33`.

## Mock-интервью (`src/interview/problems.ts`)

`InterviewProblem`: `id`, `track` (backend/frontend/llm), `title`, `prompt` (намеренно расплывчатый), `facts` (раскрываются по запросу), `focus` (что должен покрыть сильный кандидат). Режимы: `strict`, `standard`, `coach`. Ключ результата `interview:<id>`, до 150 XP (балл × 1.5).

## Проверка контента

`scripts/check-content.ts` проходит по файлам уроков и справочника и падает на:

- длинном тире «—» (запрещено стайлгайдом);
- словах-паразитах («не просто», «стоит отметить», «по сути», «Вывод:», …);
- фразе «HTTP/TCP/… это язык»;
- битых ссылках `/wiki/<id>`, `/learn/<id>`;
- непарсящихся ` ```seq `, таймлайнах и перках;
- сокращениях, которых нет в `glossary.ts`;
- структуре урока: перед последней секцией «Что дальше» должна идти секция «На вашем проекте» с блоком ` ```perks `;
- квизах, где правильный ответ выдаёт себя длиной.

```bash
./node_modules/.bin/tsx scripts/check-content.ts
```

С аргументом-подстрокой проверяет только подходящие файлы; `--order` выводит порядок уроков по пути обучения.
