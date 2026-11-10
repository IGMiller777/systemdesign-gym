# 03. API-сервер и интеграция с Claude

## Как сервер вызывает модель

Ключа API нет. Сервер запускает локальный **Claude Code CLI** как дочерний процесс (`server/claude.ts`):

```bash
claude -p --output-format json --model <MODEL> --system-prompt "<system>" \
  --tools "" --strict-mcp-config --no-session-persistence [--json-schema '<schema>']
```

- Промпт передаётся через stdin, рабочая папка `os.tmpdir()` (чтобы CLI не подхватил контекст проекта).
- `--tools ""` и `--strict-mcp-config` отключают инструменты и MCP: модель только отвечает текстом.
- `--no-session-persistence`: сессии не сохраняются.
- Модель: переменная `GRADER_MODEL`, по умолчанию `sonnet`. Судья CTF жёстко использует `haiku`.

`runClaude(prompt, { system, schema?, model? })`:

- без схемы возвращает `result` (markdown-текст);
- со схемой возвращает `structured_output`, а если его нет, вырезает JSON между первой `{` и последней `}` из текста;
- ненулевой код выхода или `is_error` превращается в исключение.

`streamClaude(...)` запускает CLI с `--output-format stream-json --verbose --include-partial-messages` и отдаёт `text_delta` из событий `content_block_delta` по мере генерации. Если клиент отключился, процесс убивается.

Каждый вызов это отдельный процесс CLI: задержка в несколько секунд и расход лимитов подписки Claude Code.

## Общий формат ответов

Почти все POST-маршруты обёрнуты в `route()` (`server/index.ts`):

- успех: JSON-ответ обработчика; если обработчик вернул строку, ответ `{ "text": "..." }`;
- ошибка: HTTP 500 и `{ "error": "сообщение" }`.

Клиент (`src/lib/api.ts`, `postApi`) превращает пустой ответ прокси (API не запущен) в понятную ошибку.

## Эндпоинты

| Метод и путь | Вход | Выход | Модель / схема |
|---|---|---|---|
| `POST /api/grade` | `GradeRequest` | оценка дизайна | `gradeSchema` |
| `POST /api/explain` | `ExplainRequest` | проверка «объясни сам» | `explainSchema` |
| `POST /api/ask` | `AskRequest` | `{ text }` | текст |
| `POST /api/ask/stream` | `AskRequest` | `text/plain` поток | текст, стриминг |
| `POST /api/postmortem` | `PostmortemRequest` | `{ text }` (markdown) | текст |
| `POST /api/scenario` | `{ topic, difficulty }` | `Scenario` | `scenarioSchema` + плейтест |
| `POST /api/interview/turn` | `InterviewRequest` | `{ text }` реплика | текст, system по режиму |
| `POST /api/interview/grade` | `InterviewRequest` | разбор интервью | `interviewGradeSchema` |
| `GET /api/ctf/levels` | — | `string[]` описания защит | — |
| `POST /api/ctf/chat` | `{ level, message, history }` | `{ text, blocked? }` | текст + судья `haiku` |
| `POST /api/ctf/guess` | `{ level, guess }` | `{ ok: boolean }` | — |
| `GET /api/progress/:name` | — | 200 JSON или 204 | — |
| `PUT` / `POST /api/progress/:name` | JSON-тело стора | `{ ok: true }` или 400 | — |

### `/api/grade`: оценка дизайна (задачи L4–L6)

Вход:

```ts
interface GradeRequest {
  task: { title: string; prompt: string; requirements: string[]; rubric: string[] }
  design: {
    nodes: { id: string; type: string; label: string }[]
    edges: { source: string; target: string; label?: string }[]
    notes: Record<string, string>      // текстовые поля пошаговой формы
  }
  answerToFollowUp?: { question: string; answer: string }
}
```

Выход (`gradeSchema`): `score` 0–100 (70+ уровень senior), `verdict`, `criteria[]` со статусом `met | partial | missed` по каждому пункту рубрики, `strengths[]`, `issues[]`, `followUp` (острый уточняющий вопрос). Клиент показывает `followUp`, игрок отвечает, и запрос повторяется с `answerToFollowUp`.

### `/api/explain`: «объясни сам»

Вход: `topic`, `question`, `answer` (ответ игрока), `reference` (текст справочника, который игрок не видит). Выход: `score` 0–100 (70+ понимает суть), `verdict`, `correct[]`, `missing[]`, `wrong[]`, `model` (эталонный ответ). Порог засчитывания в прогрессе: 60.

### `/api/ask` и `/api/ask/stream`: наставник

Вход: `topic`, `context?` (справка, которую читает ученик), `question`, `history?` (`{q, a}[]`). Наставник отвечает до ~250 слов по структуре «суть → как работает → пример с цифрами → типичная ошибка».

Протокол стрима: обычный `text/plain`. Ошибка до первого куска возвращается как JSON 500. Ошибка посреди генерации дописывается после символа `\0`; клиент (`streamApi`) показывает текст до NUL, а остаток выбрасывает как исключение. Кнопка Stop в `AskBox` отменяет fetch через `AbortSignal`, сервер ловит `onAbort` и убивает процесс CLI.

### `/api/postmortem`

Вход: сценарий (название, брифинг, SLO, бюджет), исход `survived | failed`, прореженный таймлайн тиков (rps, p99, ошибки, стоимость, здоровье, горячие узлы), действия игрока, алерты, финальная архитектура строкой. Выход: blameless-постмортем в markdown из пяти секций, до ~400 слов.

### `/api/scenario`: генерация сценария с плейтестом

1. Промпт содержит таблицу ёмкостей всех блоков из `blockSpecs` и пример сценария (`scenarios[2]`, «Чёрная пятница»).
2. Модель возвращает `Scenario` по `scenarioSchema` (типы блоков и событий ограничены enum'ами).
3. `checkScenario` прогоняет сценарий движком **без действий игрока** и отклоняет его, если:
   - стартовая архитектура стоит больше 80% бюджета;
   - SLO нарушается раньше 3-й минуты;
   - сервис доживает до конца (слишком легко).
4. При отказе причина дописывается в промпт, всего до 3 попыток. После третьей неудачи возвращается последняя версия (без гарантии качества).

Замечание: схема событий разрешает только `traffic | kill | killOne | slow | cacheFlush | ddos`. Новые события движка (`zoneDown`, `stall`, `loop` и др.) генератору недоступны.

### `/api/interview/turn` и `/api/interview/grade`

`InterviewRequest`: задача (`prompt`, скрытые `facts`, `focus`), история реплик, текущая схема кандидата, прошедшее и общее время, режим (`strict | standard | coach`, по умолчанию `standard`), флаг `hint` (куплена подсказка).

- Реплика: system-промпт = базовые правила интервьюера + правила режима. Сервер сам вычисляет фазу по доле прошедшего времени: требования (до 12%), оценки (до 25%), high-level дизайн (до 55%), deep dive (до 88%), завершение.
- Разбор: `score`, `hire` (6 градаций от `strong no hire` до `strong hire`), `level` (`junior…staff`), `summary`, ровно 6 осей по шкале 1–4, `strengths`, `improvements`, `missed`. Промпт учитывает режим: в режиме тренера идеи, подсказанные интервьюером, не засчитываются.

Голос реализован на клиенте: Web Speech API (`SpeechRecognition` для ввода, `speechSynthesis` с русским голосом для озвучки).

### CTF «Взломай агента»

Пароли (`КАШТАН`, `ЛАВИНА`, … ) лежат только в `server/ctf.ts`, клиент их не получает. Защиты нарастают по уровням:

| Уровень | Защита |
|---|---|
| 1 | Нет защиты |
| 2 | Запрет в системном промпте |
| 3 | + фильтр ответа (пароль в тексте → блок) |
| 4 | + ИИ-судья на `haiku` (ловит утечку по буквам, шифром, намёком) |
| 5 | + фильтр ввода по регулярке (`парол`, `секрет`, `password`, `ключ`…) |
| 6 | Косвенная инъекция: сообщение подаётся агенту как письмо клиента для пересказа, все защиты включены |

`/api/ctf/guess` сравнивает догадку без учёта регистра и с заменой `Ё`→`Е`.

### Прогресс

См. [02-architecture.md](02-architecture.md#хранение-прогресса). `POST` дублирует `PUT`, потому что `navigator.sendBeacon` умеет только POST.

## Безопасность сервера

- Сервер рассчитан на localhost, без аутентификации и CORS-настроек. Наружу его открывать нельзя: любой сможет тратить лимиты Claude и перезаписывать прогресс.
- Имя файла прогресса санитизируется, path traversal невозможен.
- Ввод пользователя попадает в промпты как есть. Для учебного продукта это приемлемо; инструменты у модели отключены, поэтому инъекция в промпт не даёт доступа к системе.
