import type { DefenseLevel } from './types'

/**
 * Reference ("ideal") setups per level id. Used by tests to prove each level is
 * winnable within budget (incl. wave bonuses); also handy for hints/debrief UI.
 */
export const referenceSetups: Record<string, string[]> = {
  'def-1': ['rate-limit', 'mfa', 'waf', 'param-queries', 'output-csp', 'secure-cookies'],
  'def-2': ['rate-limit', 'mfa', 'waf', 'param-queries', 'output-csp', 'secure-cookies', 'authz-object', 'tls'],
  'def-3': ['secret-scanning', 'secrets-vault', 'sca-lockfile', 'pinned-provenance'],
  'def-4': ['ssrf-egress', 'encryption-leastpriv', 'mfa', 'phishing-training', 'offline-backups'],
  'def-5': ['untrusted-isolation', 'human-in-loop', 'mcp-allowlist', 'action-filter', 'ssrf-egress'],
  'def-6': [
    'rate-limit', 'mfa', 'param-queries', 'authz-object', 'secret-scanning', 'secrets-vault', 'pinned-provenance',
    'sca-lockfile', 'untrusted-isolation', 'human-in-loop', 'action-filter', 'mcp-allowlist', 'offline-backups',
    'anti-ddos',
  ],
}

export const defenseLevels: DefenseLevel[] = [
  {
    id: 'def-1',
    level: 1,
    title: 'Лендинг стартапа',
    briefing:
      '**Контекст.** Стартап «ПельмениОнлайн» запустил лендинг с личным кабинетом: форма входа, поиск по меню и комментарии к блюдам. Бэкенд писал фулстек за выходные, «потом доделаем безопасность».\n\n' +
      '**Ставки.** Если пользователей начнут угонять, а комментарии превратятся в трамплин для скриптов, доверие к бренду растает быстрее, чем пельмень в кипятке.\n\n' +
      '**Ваша задача.** Бюджета хватает не на всё. Подумайте, какие слои реально нужны, а какие красивые, но бесполезные именно здесь.',
    system: {
      nodes: [
        { id: 'user', zone: 'edge', label: 'Браузер клиента', block: 'client' },
        { id: 'cdn', zone: 'edge', label: 'CDN / входной прокси', block: 'cdn' },
        { id: 'web', zone: 'app', label: 'Веб-приложение', block: 'service' },
        { id: 'auth', zone: 'app', label: 'Логин и сессии', block: 'service' },
        { id: 'db', zone: 'data', label: 'База заказов и комментариев', block: 'postgres' },
      ],
      edges: [
        { source: 'user', target: 'cdn' },
        { source: 'cdn', target: 'web' },
        { source: 'web', target: 'auth' },
        { source: 'web', target: 'db' },
      ],
    },
    trust: 100,
    budget: 8,
    available: ['waf', 'rate-limit', 'tls', 'param-queries', 'output-csp', 'mfa', 'secure-cookies', 'anti-ddos', 'phishing-training', 'mcp-allowlist'],
    waves: [
      {
        n: 1,
        attacks: [{ attack: 'cred-stuffing', count: 4 }, { attack: 'sqli', count: 3 }],
        bonusBudget: 0,
        intel: 'Разведка: на форму входа льётся странный ночной трафик с тысяч IP, а в логах поиска замелькали одинарные кавычки. Кто-то проверяет, что у вас под капотом.',
      },
      {
        n: 2,
        attacks: [{ attack: 'cred-stuffing', count: 3 }, { attack: 'sqli', count: 2 }, { attack: 'stored-xss', count: 3 }],
        bonusBudget: 2,
        intel: 'Разведка: на форумах хвастаются, что «в комментариях у пельменной можно запускать скрипты». Похоже, XSS-энтузиасты уже в очереди.',
      },
      {
        n: 3,
        attacks: [{ attack: 'cred-stuffing', count: 5 }, { attack: 'sqli', count: 4 }, { attack: 'stored-xss', count: 4 }],
        bonusBudget: 2,
        intel: 'Разведка: вас добавили в список «лёгких целей». Ожидается всё сразу и по нарастающей. Слои должны перекрывать друг друга.',
      },
    ],
    debrief:
      '**Эталон:** rate limit + MFA (вход), параметризованные запросы + WAF (SQL), экранирование вывода + CSP + безопасные cookie (XSS).\n\n' +
      '**Почему слоями.** Параметризация закрывает SQLi почти полностью, но «почти» это не «полностью», поэтому WAF страхует ошибки разработчика. Rate limit замедляет перебор, а MFA делает пойманный пароль бесполезным: каждый слой закрывает дыру соседа.\n\n' +
      '**Приманки:** anti-DDoS, обучение фишингу и MCP-allowlist хороши, но против этих атак ничего не делают. Хорошая безопасность это не «купить побольше», а «закрыть то, что реально угрожает».',
  },
  {
    id: 'def-2',
    level: 2,
    title: 'Интернет-магазин',
    briefing:
      '**Контекст.** «ГаджетМаркет»: миллионы просмотров, личные кабинеты, оплата картой, история заказов. Есть API для мобильного приложения, и каталог цен, который конкуренты очень любят выкачивать.\n\n' +
      '**Ставки.** Здесь уже есть персональные данные покупателей. Утечка заказов это не просто баг, а письмо от регулятора и заголовки в новостях.\n\n' +
      '**Ваша задача.** Старые угрозы никуда не делись, а к ним добавились ошибки авторизации, угон сессий и армии ботов.',
    system: {
      nodes: [
        { id: 'user', zone: 'edge', label: 'Покупатель', block: 'client' },
        { id: 'cdn', zone: 'edge', label: 'CDN и WAF-периметр', block: 'cdn' },
        { id: 'lb', zone: 'edge', label: 'Балансировщик', block: 'lb' },
        { id: 'api', zone: 'app', label: 'API магазина', block: 'gateway' },
        { id: 'orders', zone: 'app', label: 'Сервис заказов', block: 'service' },
        { id: 'sessions', zone: 'app', label: 'Хранилище сессий', block: 'redis' },
        { id: 'db', zone: 'data', label: 'Заказы и клиенты', block: 'postgres' },
      ],
      edges: [
        { source: 'user', target: 'cdn' },
        { source: 'cdn', target: 'lb' },
        { source: 'lb', target: 'api' },
        { source: 'api', target: 'orders' },
        { source: 'api', target: 'sessions' },
        { source: 'orders', target: 'db' },
      ],
    },
    trust: 100,
    budget: 10,
    available: ['waf', 'rate-limit', 'tls', 'param-queries', 'output-csp', 'authz-object', 'mfa', 'secure-cookies', 'anti-ddos', 'siem-ir', 'secrets-vault', 'offline-backups'],
    waves: [
      {
        n: 1,
        attacks: [{ attack: 'cred-stuffing', count: 3 }, { attack: 'sqli', count: 2 }, { attack: 'scraping-bots', count: 3 }],
        bonusBudget: 0,
        intel: 'Разведка: каталог цен кто-то выкачивает по 200 запросов в секунду, а на странице входа снова ночной шторм. Классика для магазина.',
      },
      {
        n: 2,
        attacks: [{ attack: 'idor', count: 4 }, { attack: 'session-hijack', count: 3 }, { attack: 'stored-xss', count: 2 }, { attack: 'cred-stuffing', count: 2 }],
        bonusBudget: 3,
        intel: 'Разведка: в отзывах появились странные ссылки, а пользователь «из кафе» жалуется, что его аккаунт вдруг заказал 5 ноутбуков. Кто-то подбирает номера заказов в URL.',
      },
      {
        n: 3,
        attacks: [
          { attack: 'idor', count: 4 }, { attack: 'session-hijack', count: 3 }, { attack: 'scraping-bots', count: 3 },
          { attack: 'sqli', count: 2 }, { attack: 'stored-xss', count: 2 }, { attack: 'cred-stuffing', count: 3 },
        ],
        bonusBudget: 3,
        intel: 'Разведка: началась чёрная пятница, и пришли все: боты, перебирающие ID, продавцы краденых cookie и скальперы. Проверьте, что нет слабых зон.',
      },
    ],
    debrief:
      '**Эталон:** к набору первого уровня добавляются проверка прав на каждый объект (против IDOR), TLS + безопасные cookie (против угона сессии) и rate limit, который заодно давит ботов и перебор ID.\n\n' +
      '**Почему слоями.** IDOR не лечится ни WAF, ни капчей: это логическая ошибка, и закрывается она только проверкой владельца в коде. Но rate limit делает перебор дорогим. Один и тот же rate limit работает сразу против трёх атак: хорошие слои переиспользуются.\n\n' +
      '**Приманки:** SIEM, vault и бэкапы полезны вообще, но на этой волне не окупятся. Anti-DDoS тоже не про это, хотя ботам немного мешает.',
  },
  {
    id: 'def-3',
    level: 3,
    title: 'Утечка в репозитории',
    briefing:
      '**Контекст.** Команда «ФинТрекер» быстро растёт: 30 разработчиков, монорепа на pnpm, сотни зависимостей, CI с токенами на всё подряд. Периметр у вас, возможно, идеален, но атакующий заходит не через сайт, а через **ваш же код и зависимости**.\n\n' +
      '**Ставки.** Один ключ в git, одна опечатка в `pnpm add` или один взломанный мейнтейнер, и нехорошие вещи оказываются в проде с вашей подписью.\n\n' +
      '**Ваша задача.** WAF и TLS тут не помогут: атака приходит изнутри цепочки поставок.',
    system: {
      nodes: [
        { id: 'dev', zone: 'people', label: 'Разработчики', emoji: '👩‍💻' },
        { id: 'git', zone: 'supply', label: 'Git-репозиторий', emoji: '🗂️' },
        { id: 'npm', zone: 'supply', label: 'npm-реестр', block: 'external' },
        { id: 'ci', zone: 'supply', label: 'CI/CD со всеми токенами', block: 'worker' },
        { id: 'app', zone: 'app', label: 'Продакшн-приложение', block: 'service' },
        { id: 'cloud', zone: 'data', label: 'Облако и база', block: 'postgres' },
      ],
      edges: [
        { source: 'dev', target: 'git' },
        { source: 'npm', target: 'ci' },
        { source: 'git', target: 'ci' },
        { source: 'ci', target: 'app' },
        { source: 'app', target: 'cloud' },
      ],
    },
    trust: 100,
    budget: 8,
    available: ['secret-scanning', 'secrets-vault', 'sca-lockfile', 'pinned-provenance', 'siem-ir', 'ssrf-egress', 'phishing-training', 'waf', 'tls', 'param-queries'],
    waves: [
      {
        n: 1,
        attacks: [{ attack: 'leaked-key-git', count: 3 }, { attack: 'typosquat', count: 3 }],
        bonusBudget: 0,
        intel: 'Разведка: боты сканируют публичные репозитории GitHub на ключи, а в реестре замечены пакеты с подозрительно знакомыми названиями. Утренний `pnpm add` может стать последним.',
      },
      {
        n: 2,
        attacks: [{ attack: 'leaked-key-git', count: 3 }, { attack: 'typosquat', count: 2 }, { attack: 'compromised-update', count: 3 }],
        bonusBudget: 2,
        intel: 'Разведка: в соседней компании у популярной библиотеки «сменился мейнтейнер», и вышел релиз с неожиданным сетевым кодом. Ваши `^`-диапазоны дрожат.',
      },
      {
        n: 3,
        attacks: [{ attack: 'leaked-key-git', count: 4 }, { attack: 'typosquat', count: 4 }, { attack: 'compromised-update', count: 4 }],
        bonusBudget: 2,
        intel: 'Разведка: хакеры автоматизировали всю цепочку. Ожидайте ключи, опечатки и «обновления» одновременно. Спорить с пиннингом уже поздно.',
      },
    ],
    debrief:
      '**Эталон:** secret scanning + vault (ключи), lock-файл с SCA + пиннинг/provenance (пакеты).\n\n' +
      '**Почему слоями.** Secret scanning ловит ключ до или сразу после коммита, но если он всё же ушёл, то vault с короткоживущими кредами делает украденное быстро бесполезным. С пакетами так же: SCA ловит известное, а пиннинг с задержкой обновления и проверкой provenance ловит новое.\n\n' +
      '**Приманки:** WAF и параметризация защищают приложение, а не цепочку поставок. SIEM помогает, но стоит дорого и срабатывает уже постфактум.',
  },
  {
    id: 'def-4',
    level: 4,
    title: 'Облако',
    briefing:
      '**Контекст.** «ОблакоСофт» переехал в облако: контейнеры, роли IAM, бакеты, админская консоль. Есть сервис «импорт по URL» и админы, которые читают почту с телефона.\n\n' +
      '**Ставки.** В облаке радиус поражения огромен: одна украденная роль и всё ваше. Одно успешное шифрование без бэкапов, и вы на переговорах о выкупе.\n\n' +
      '**Ваша задача.** Закройте путь «SSRF → метаданные → ключи» и цепочку «фишинг → админ → шифровальщик».',
    system: {
      nodes: [
        { id: 'user', zone: 'edge', label: 'Пользователи', block: 'client' },
        { id: 'lb', zone: 'edge', label: 'Балансировщик', block: 'lb' },
        { id: 'import', zone: 'app', label: 'Сервис «импорт по URL»', block: 'service' },
        { id: 'console', zone: 'app', label: 'Админ-консоль', block: 'gateway' },
        { id: 'admin', zone: 'people', label: 'Админ с телефоном', emoji: '🧑‍💼' },
        { id: 'meta', zone: 'data', label: 'Метаданные VM / IAM-роль', emoji: '🪪' },
        { id: 'db', zone: 'data', label: 'База и бэкапы', block: 'postgres' },
        { id: 'bucket', zone: 'data', label: 'Бакет с файлами', block: 's3' },
      ],
      edges: [
        { source: 'user', target: 'lb' },
        { source: 'lb', target: 'import' },
        { source: 'admin', target: 'console' },
        { source: 'import', target: 'meta' },
        { source: 'console', target: 'db' },
        { source: 'import', target: 'bucket' },
      ],
    },
    trust: 100,
    budget: 10,
    available: ['ssrf-egress', 'encryption-leastpriv', 'mfa', 'phishing-training', 'offline-backups', 'siem-ir', 'waf', 'secrets-vault', 'anti-ddos', 'tls', 'sca-lockfile'],
    waves: [
      {
        n: 1,
        attacks: [{ attack: 'ssrf-metadata', count: 4 }, { attack: 'phishing-admin', count: 3 }],
        bonusBudget: 0,
        intel: 'Разведка: в вашем «импорте по URL» кто-то пробует адреса вроде http://169.254.169.254/, а админам на личную почту пришло письмо про «срочную смену пароля консоли».',
      },
      {
        n: 2,
        attacks: [{ attack: 'ssrf-metadata', count: 3 }, { attack: 'phishing-admin', count: 3 }, { attack: 'ransomware', count: 3 }],
        bonusBudget: 3,
        intel: 'Разведка: в даркнете продают «доступ к консоли вашей компании». Если фишинг сработает, дальше будет шифровальщик, и он начнёт с удаления бэкапов.',
      },
      {
        n: 3,
        attacks: [{ attack: 'ssrf-metadata', count: 4 }, { attack: 'phishing-admin', count: 4 }, { attack: 'ransomware', count: 4 }],
        bonusBudget: 3,
        intel: 'Разведка: финальная волна, вымогатели пришли с полным набором: SSRF для ключей, фишинг для входа и шифровальщик для финала.',
      },
    ],
    debrief:
      '**Эталон:** egress allowlist (+IMDSv2) и минимальные права роли против SSRF; MFA (лучше passkeys) + обучение против фишинга; офлайн-бэкапы против шифровальщика.\n\n' +
      '**Почему слоями.** Даже если SSRF прошёл, роль с минимумом прав не даст сделать с её ключами ничего страшного. Если фишинг сработал, MFA остановит вход. Если и вход случился, бэкапы, которых админ удалить не может, превращают катастрофу в неприятный день.\n\n' +
      '**Принцип.** Проектируйте так, будто каждый отдельный слой когда-нибудь подведёт.',
  },
  {
    id: 'def-5',
    level: 5,
    title: 'ИИ-ассистент поддержки',
    briefing:
      '**Контекст.** «ПомощникPro» запустил ИИ-ассистента: он читает письма клиентов, ходит в CRM, ищет по базе знаний, отвечает через почту. К нему подключены MCP-серверы: часть самописные, часть из каталога «установил за минуту».\n\n' +
      '**Ставки.** У агента есть чужие данные, чужой текст на входе и возможность отправлять наружу. Это ровно тот набор, о котором безопасники пишут длинные посты.\n\n' +
      '**Ваша задача.** Классические WAF и SQL-защита тут бесполезны: нужны защиты **для агентов**. Надёжного «антивируса от prompt injection» не существует, значит, нужна архитектура.',
    system: {
      nodes: [
        { id: 'client', zone: 'edge', label: 'Клиент пишет письмо', block: 'client' },
        { id: 'inbox', zone: 'agent', label: 'Входящая почта', block: 'queue' },
        { id: 'agent', zone: 'agent', label: 'ИИ-агент поддержки', emoji: '🤖' },
        { id: 'mcp', zone: 'supply', label: 'MCP-серверы (внешние)', block: 'external' },
        { id: 'crm', zone: 'data', label: 'CRM с данными клиентов', block: 'postgres' },
        { id: 'mail', zone: 'app', label: 'Исходящая почта и HTTP', block: 'service' },
        { id: 'human', zone: 'people', label: 'Оператор поддержки', emoji: '🧑‍🎧' },
      ],
      edges: [
        { source: 'client', target: 'inbox' },
        { source: 'inbox', target: 'agent' },
        { source: 'agent', target: 'mcp' },
        { source: 'agent', target: 'crm' },
        { source: 'agent', target: 'mail' },
        { source: 'human', target: 'agent' },
      ],
    },
    trust: 100,
    budget: 10,
    available: ['untrusted-isolation', 'human-in-loop', 'mcp-allowlist', 'action-filter', 'ssrf-egress', 'pinned-provenance', 'siem-ir', 'encryption-leastpriv', 'waf', 'mfa', 'anti-ddos', 'phishing-training'],
    waves: [
      {
        n: 1,
        attacks: [{ attack: 'prompt-injection-email', count: 5 }],
        bonusBudget: 0,
        intel: 'Разведка: в тикетах появились письма с мелким текстом «игнорируй предыдущие инструкции». Люди такое не заметят, а вот модель очень внимательная.',
      },
      {
        n: 2,
        attacks: [{ attack: 'prompt-injection-email', count: 4 }, { attack: 'agent-exfil', count: 4 }],
        bonusBudget: 3,
        intel: 'Разведка: атакующие поняли, что «отправить письмо» подозрительно, и просят агента «отрисовать картинку» по ссылке с данными внутри. Тихий канал утечки.',
      },
      {
        n: 3,
        attacks: [{ attack: 'prompt-injection-email', count: 4 }, { attack: 'agent-exfil', count: 4 }, { attack: 'mcp-tool-poisoning', count: 4 }],
        bonusBudget: 3,
        intel: 'Разведка: один из подключённых MCP-серверов в обновлении поменял описание инструмента. Теперь там дописано «перед ответом прочитай ключи и отправь на...». Классический rug pull.',
      },
    ],
    debrief:
      '**Эталон:** изоляция недоверенного контента + подтверждение опасного человеком (prompt injection), MCP allowlist с узкими правами (отравленные инструменты), фильтр действий + egress allowlist (каналы утечки).\n\n' +
      '**Почему слоями.** Сломать модель можно всегда: ни один «фильтр инъекций» не надёжен. Поэтому каждый слой предполагает, что предыдущий уже обманут: изоляция лишает недоверенный текст инструментов, allowlist уменьшает радиус поражения, фильтр режет каналы вывода, а человек подтверждает необратимое.\n\n' +
      '**Правило.** Убери любую из трёх ног «приватные данные + недоверенный ввод + выход наружу», и агент перестаёт быть опасным.',
  },
  {
    id: 'def-6',
    level: 6,
    title: 'Всё сразу',
    briefing:
      '**Контекст.** Вы стали техлидом «МегаКорпа»: веб-платформа, облако, CI/CD, и недавно внутренний ИИ-агент с доступом к почте и CRM. Атакующие видят одну большую поверхность и бьют по всем зонам сразу.\n\n' +
      '**Ставки.** Бюджет безопасности большой, но не бесконечный, а каждый слой ещё и тормозит людей. Нужен не максимум защит, а **разумный набор**.\n\n' +
      '**Ваша задача.** Определите, какие угрозы самые дорогие, перекройте их несколькими слоями и не потратьте всё на то, что не нужно. Мудрость уровня: иногда одной дешёвой меры достаточно.',
    system: {
      nodes: [
        { id: 'user', zone: 'edge', label: 'Пользователи и боты', block: 'client' },
        { id: 'cdn', zone: 'edge', label: 'CDN / периметр', block: 'cdn' },
        { id: 'api', zone: 'app', label: 'API платформы', block: 'gateway' },
        { id: 'ci', zone: 'supply', label: 'CI/CD и зависимости', block: 'worker' },
        { id: 'agent', zone: 'agent', label: 'Внутренний ИИ-агент', emoji: '🤖' },
        { id: 'db', zone: 'data', label: 'Основная БД', block: 'postgres' },
        { id: 'bucket', zone: 'data', label: 'Бэкапы и файлы', block: 's3' },
        { id: 'staff', zone: 'people', label: 'Сотрудники и админы', emoji: '🧑‍💼' },
      ],
      edges: [
        { source: 'user', target: 'cdn' },
        { source: 'cdn', target: 'api' },
        { source: 'api', target: 'db' },
        { source: 'ci', target: 'api' },
        { source: 'agent', target: 'db' },
        { source: 'staff', target: 'agent' },
        { source: 'db', target: 'bucket' },
      ],
    },
    trust: 100,
    budget: 22,
    available: [
      'waf', 'rate-limit', 'anti-ddos', 'param-queries', 'output-csp', 'authz-object', 'ssrf-egress', 'mfa',
      'secrets-vault', 'encryption-leastpriv', 'offline-backups', 'sca-lockfile', 'pinned-provenance', 'secret-scanning',
      'mcp-allowlist', 'human-in-loop', 'untrusted-isolation', 'action-filter', 'phishing-training', 'siem-ir',
    ],
    waves: [
      {
        n: 1,
        attacks: [
          { attack: 'cred-stuffing', count: 2 }, { attack: 'sqli', count: 2 }, { attack: 'idor', count: 2 },
          { attack: 'ddos-l7', count: 2 }, { attack: 'leaked-key-git', count: 2 },
        ],
        bonusBudget: 0,
        intel: 'Разведка: классическая «разминка» по веб-поверхности: перебор паролей, ID в URL, нагрузка на API и боты, сканирующие ваши репозитории на ключи.',
      },
      {
        n: 2,
        attacks: [
          { attack: 'compromised-update', count: 2 }, { attack: 'prompt-injection-email', count: 3 },
          { attack: 'agent-exfil', count: 2 }, { attack: 'ransomware', count: 2 }, { attack: 'cred-stuffing', count: 2 },
          { attack: 'ddos-l7', count: 1 },
        ],
        bonusBudget: 9,
        intel: 'Разведка: атаки смещаются вглубь. Пришло «обновление» популярной библиотеки, во входящей почте у агента первые инъекции, а админы получили странные письма от «IT-отдела».',
      },
      {
        n: 3,
        attacks: [
          { attack: 'sqli', count: 2 }, { attack: 'idor', count: 2 }, { attack: 'leaked-key-git', count: 2 },
          { attack: 'compromised-update', count: 2 }, { attack: 'prompt-injection-email', count: 3 },
          { attack: 'agent-exfil', count: 3 }, { attack: 'ransomware', count: 2 }, { attack: 'ddos-l7', count: 2 },
        ],
        bonusBudget: 9,
        intel: 'Разведка: финал. Все направления сразу, и ни одно не должно стать слабым звеном. Если вы пожалели денег на цепочку поставок или агента, самое время пожалеть об этом.',
      },
    ],
    debrief:
      '**Эталон (≈37 очков):** вход: rate limit + MFA; код: параметризация + проверка прав на объект; секреты: scanning + vault; пакеты: пиннинг/provenance + SCA; агент: изоляция + human-in-the-loop + фильтр действий + MCP allowlist; данные: офлайн-бэкапы; периметр: anti-DDoS.\n\n' +
      '**Почему слоями.** Обратите внимание на переиспользование: MFA закрывает сразу три вектора (credential stuffing, шифровальщик, фишинг), а MCP allowlist работает против двух агентских атак. Хороший набор не равен длинному списку: SIEM, WAF и шифрование оставлены за бортом, потому что дополнительные слои дороже, чем их выигрыш.\n\n' +
      '**Урок.** Безопасность это управление рисками, и считать трение для людей надо так же серьёзно, как и деньги.',
  },
]
