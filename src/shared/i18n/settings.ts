import type { Dict } from './types'

// Settings: providers, speech & audio, overlay, shortcuts, privacy, spending, diagnostics.
export const SETTINGS: Dict = {
  // tabs
  Провайдеры: ['Провайдери', 'Providers'],
  'Речь и звук': ['Мова й звук', 'Speech & audio'],
  Подсказки: ['Підказки', 'Overlay'],
  'Горячие клавиши': ['Гарячі клавіші', 'Shortcuts'],
  Приватность: ['Приватність', 'Privacy'],
  Расходы: ['Витрати', 'Spending'],
  Диагностика: ['Діагностика', 'Diagnostics'],

  // overlay tab
  'Окно подсказок': ['Вікно підказок', 'Overlay window'],
  'Показать / скрыть': ['Показати / сховати', 'Show / hide'],
  'Непрозрачность фона: {n}%': ['Непрозорість фону: {n}%', 'Background opacity: {n}%'],
  'Фон окна подсказок просвечивает, текст остаётся чётким. 100% — непрозрачный.': [
    'Фон вікна підказок просвічує, текст лишається чітким. 100% — непрозорий.',
    'The overlay background shows through while the text stays crisp. 100% is opaque.'
  ],
  'Размер шрифта: {n}%': ['Розмір шрифту: {n}%', 'Font size: {n}%'],
  'Ширина окна: {n} px': ['Ширина вікна: {n} px', 'Window width: {n} px'],
  'Высота окна: {n} px': ['Висота вікна: {n} px', 'Window height: {n} px'],
  'В компактном режиме окно растёт под ответ до этой высоты, в развёрнутом — занимает её целиком. Можно и просто потянуть за край окна.': [
    'У компактному режимі вікно росте під відповідь до цієї висоти, у розгорнутому — займає її повністю. Можна й просто потягнути за край вікна.',
    'In compact mode the window grows with the answer up to this height; expanded, it takes the full height. You can also drag the window edge.'
  ],
  Тема: ['Тема', 'Theme'],
  Тёмная: ['Темна', 'Dark'],
  Светлая: ['Світла', 'Light'],
  'Язык интерфейса': ['Мова інтерфейсу', 'Interface language'],
  'Поверх всех окон': ['Поверх усіх вікон', 'Always on top'],
  'Выключено — ответ по кнопке/горячей клавише: дешевле и предсказуемее. Сомнительные реплики всегда показываются как «Возможный вопрос» без генерации.': [
    'Вимкнено — відповідь за кнопкою чи гарячою клавішею: дешевше й передбачуваніше. Сумнівні репліки завжди показуються як «Можливе питання» без генерації.',
    'Off — answers come on a button or shortcut: cheaper and more predictable. Uncertain lines always show as “Possible question” without generating.'
  ],
  'Окно перетаскивается за верхнюю полосу и меняет размер за края. Положение и монитор запоминаются. Окно никогда не забирает фокус клавиатуры.': [
    'Вікно перетягується за верхню смугу і змінює розмір за краї. Положення й монітор запам’ятовуються. Вікно ніколи не забирає фокус клавіатури.',
    'Drag the window by its top bar and resize it by the edges. Position and monitor are remembered. The window never takes keyboard focus.'
  ],
  'Защита от демонстрации экрана': ['Захист від демонстрації екрана', 'Screen sharing protection'],
  'Скрывать окно подсказок из захвата экрана': ['Приховувати вікно підказок із захоплення екрана', 'Hide the overlay from screen capture'],
  'Статус: {s}': ['Статус: {s}', 'Status: {s}'],
  'Это системный флаг macOS (NSWindowSharingNone).': [
    'Це системний прапорець macOS (NSWindowSharingNone).',
    'This is a macOS system flag (NSWindowSharingNone).'
  ],
  'Это системный флаг Windows (SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE).': [
    'Це системний прапорець Windows (SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE).',
    'This is a Windows system flag (SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE).'
  ],
  'Он не гарантирует невидимость:': ['Він не гарантує невидимість:', 'It does not guarantee invisibility:'],
  'разные программы захватывают экран по-разному, и мы не обходим средства контроля. Режим тренировки работает полноценно без него.': [
    'різні програми захоплюють екран по-різному, і ми не обходимо засоби контролю. Режим тренування повноцінно працює без нього.',
    'apps capture the screen in different ways, and we do not bypass monitoring tools. Practice mode works fully without it.'
  ],
  'Как проверить у себя (2 минуты):': ['Як перевірити в себе (2 хвилини):', 'How to check it yourself (2 minutes):'],
  'Откройте подсказки (оверлей) поверх окна.': ['Відкрийте підказки (оверлей) поверх вікна.', 'Open the overlay on top of a window.'],
  'Начните демонстрацию экрана в Zoom/Meet/Teams или OBS.': [
    'Почніть демонстрацію екрана в Zoom/Meet/Teams або OBS.',
    'Start sharing your screen in Zoom/Meet/Teams or OBS.'
  ],
  'Посмотрите на результат со второго устройства/второго аккаунта или в окне предпросмотра OBS.': [
    'Подивіться на результат з другого пристрою чи другого акаунта або у вікні попереднього перегляду OBS.',
    'Look at the result from a second device or account, or in the OBS preview.'
  ],
  'Оверлей не виден — защита работает для этого способа захвата. Виден — не полагайтесь на неё.': [
    'Оверлей не видно — захист працює для цього способу захоплення. Видно — не покладайтеся на нього.',
    'Overlay not visible — protection works for this capture method. Visible — do not rely on it.'
  ],
  'Проверено автоматически: захват экрана Chromium (Electron desktopCapturer) — окно исключается. Не проверено: Zoom, Teams, Meet, OBS Game/Window Capture, RDP — проверьте сами по шагам выше.':
    [
      'Перевірено автоматично: захоплення екрана Chromium (Electron desktopCapturer) — вікно виключається. Не перевірено: Zoom, Teams, Meet, OBS Game/Window Capture, RDP — перевірте самі за кроками вище.',
      'Checked automatically: Chromium screen capture (Electron desktopCapturer) excludes the window. Not checked: Zoom, Teams, Meet, OBS Game/Window Capture, RDP — check them yourself with the steps above.'
    ],
  'Скрывать из захвата и главное окно, и выбор области': [
    'Приховувати із захоплення і головне вікно, і вибір області',
    'Also hide the main window and the region picker from capture'
  ],
  'Тот же системный флаг. Если на звонке попросят показать экран, окна Copilot не попадут в поток — но вы их видите. Не гарантия: зависит от программы захвата.':
    [
      'Той самий системний прапорець. Якщо на дзвінку попросять показати екран, вікна Copilot не потраплять у трансляцію — але ви їх бачите. Не гарантія: залежить від програми захоплення.',
      'The same system flag. If you are asked to share your screen on a call, Copilot windows stay out of the stream while you still see them. Not a guarantee: it depends on the capture app.'
    ],
  'Окно и трей': ['Вікно й трей', 'Window & tray'],
  'Сворачивать в трей при закрытии и сворачивании': ['Згортати в трей під час закриття і згортання', 'Minimize to tray on close and minimize'],
  'Окно прячется в значок рядом с часами, приложение и сессия продолжают работать. Полный выход — через меню значка в трее.': [
    'Вікно ховається в значок біля годинника, застосунок і сесія продовжують працювати. Повний вихід — через меню значка в треї.',
    'The window hides into the tray icon; the app and session keep running. Quit fully from the tray icon menu.'
  ],
  'Скрывать из Dock и ⌘Tab': ['Приховувати з Dock і ⌘Tab', 'Hide from the Dock and ⌘Tab'],
  'Copilot не виден среди запущенных программ — только значок в строке меню справа вверху. Через него открывается окно и делается выход.': [
    'Copilot не видно серед запущених програм — лише значок у рядку меню справа вгорі. Через нього відкривається вікно і робиться вихід.',
    'Copilot is not shown among running apps — only an icon in the menu bar at the top right. Use it to open the window or quit.'
  ],
  'Аварийная остановка полностью закрывает приложение': ['Аварійна зупинка повністю закриває застосунок', 'Emergency stop quits the app completely'],
  'По умолчанию аварийная остановка только глушит захват и прячет подсказки, а приложение остаётся в трее. С этой опцией — приложение полностью завершается (процесса не остаётся).':
    [
      'За замовчуванням аварійна зупинка лише вимикає захоплення і ховає підказки, а застосунок лишається в треї. З цією опцією застосунок повністю завершується (процесу не лишається).',
      'By default an emergency stop only cuts capture and hides the overlay, and the app stays in the tray. With this option the app quits completely (no process is left).'
    ],

  // shortcuts tab
  'Глобальные горячие клавиши': ['Глобальні гарячі клавіші', 'Global shortcuts'],
  'Работают из любой программы (IDE, Zoom, OBS) и не перехватывают остальной ввод. Нажмите «Изменить», затем сочетание с {mods}.': [
    'Працюють з будь-якої програми (IDE, Zoom, OBS) і не перехоплюють решту введення. Натисніть «Змінити», а потім сполучення з {mods}.',
    'They work from any app (IDE, Zoom, OBS) and do not intercept other input. Press “Change”, then a combination with {mods}.'
  ],
  'Нажмите сочетание…': ['Натисніть сполучення…', 'Press a combination…'],
  Изменить: ['Змінити', 'Change'],
  'Показать / скрыть подсказки': ['Показати / сховати підказки', 'Show / hide overlay'],
  'Пауза / продолжить (или начать сессию)': ['Пауза / продовжити (або почати сесію)', 'Pause / resume (or start a session)'],
  'Снимок области экрана': ['Знімок області екрана', 'Capture screen region'],
  'Прокрутить подсказки вверх': ['Прокрутити підказки вгору', 'Scroll overlay up'],
  'Прокрутить подсказки вниз': ['Прокрутити підказки вниз', 'Scroll overlay down'],
  'Развернуть / подробный ответ': ['Розгорнути / детальна відповідь', 'Expand / detailed answer'],
  'Аварийная остановка всего': ['Аварійна зупинка всього', 'Stop everything'],

  // privacy tab
  Разрешения: ['Дозволи', 'Permissions'],
  'Захват микрофона': ['Захоплення мікрофона', 'Microphone capture'],
  'Захват системного звука (голос собеседника)': ['Захоплення системного звуку (голос співрозмовника)', 'System audio capture (the other person’s voice)'],
  'Снимки экрана по моей команде': ['Знімки екрана за моєю командою', 'Screenshots on my command'],
  'Никогда не делаются автоматически и не отправляются без подтверждения.': [
    'Ніколи не робляться автоматично і не надсилаються без підтвердження.',
    'Never taken automatically and never sent without confirmation.'
  ],
  'Отправка текста облачным провайдерам': ['Надсилання тексту хмарним провайдерам', 'Send text to cloud providers'],
  'Нужно для OpenAI / Anthropic / Gemini / AnyModel. Для Ollama не требуется.': [
    'Потрібно для OpenAI / Anthropic / Gemini / AnyModel. Для Ollama не потрібно.',
    'Needed for OpenAI / Anthropic / Gemini / AnyModel. Not needed for Ollama.'
  ],
  'Сохранять историю сессий на этом компьютере': ['Зберігати історію сесій на цьому комп’ютері', 'Keep session history on this computer'],
  'Телеметрии нет: приложение ничего не отправляет своим разработчикам.': [
    'Телеметрії немає: застосунок нічого не надсилає своїм розробникам.',
    'No telemetry: the app sends nothing to its developers.'
  ],
  'Офлайн-режим': ['Офлайн-режим', 'Offline mode'],
  'Работать без интернета': ['Працювати без інтернету', 'Work without internet'],
  'Блокирует все внешние адреса на уровне приложения. Работают только локальные модели (Ollama, LM Studio) и локальное распознавание.': [
    'Блокує всі зовнішні адреси на рівні застосунку. Працюють лише локальні моделі (Ollama, LM Studio) і локальне розпізнавання.',
    'Blocks all external addresses inside the app. Only local models (Ollama, LM Studio) and local recognition work.'
  ],
  Данные: ['Дані', 'Data'],
  'История, транскрипты и индексы документов лежат в SQLite в': [
    'Історія, транскрипти й індекси документів зберігаються в SQLite у',
    'History, transcripts and document indexes are stored in SQLite in'
  ],
  'Ключи — в отдельном файле, зашифрованном системным хранилищем ({store}). Сырое аудио не сохраняется.': [
    'Ключі — в окремому файлі, зашифрованому системним сховищем ({store}). Сире аудіо не зберігається.',
    'Keys are in a separate file encrypted by the system store ({store}). Raw audio is never saved.'
  ],
  'Связка ключей macOS': ['Связка ключів macOS', 'macOS Keychain'],
  'Важно: то, что приложение не шлёт данные своим серверам, не значит, что данные не уходят провайдеру модели. Облачный провайдер получает текст вопроса и выбранный контекст по своей политике данных.':
    [
      'Важливо: те, що застосунок не надсилає дані своїм серверам, не означає, що дані не йдуть провайдеру моделі. Хмарний провайдер отримує текст питання й вибраний контекст згідно зі своєю політикою даних.',
      'Note: the app not sending data to its own servers does not mean nothing reaches the model provider. A cloud provider receives the question text and the chosen context under its own data policy.'
    ],
  'История и журнал диагностики удалены.': ['Історію та журнал діагностики видалено.', 'History and diagnostics log deleted.'],
  'Удалить всю историю': ['Видалити всю історію', 'Delete all history'],
  'Ответственность за допустимость записи и AI-подсказок в конкретном интервью/встрече — на пользователе. Сообщайте участникам о записи.': [
    'Відповідальність за допустимість запису та AI-підказок у конкретному інтерв’ю чи зустрічі — на користувачеві. Повідомляйте учасників про запис.',
    'You are responsible for whether recording and AI assistance are allowed in a given interview or meeting. Tell participants about recording.'
  ],

  // spending tab
  Лимиты: ['Ліміти', 'Limits'],
  'Максимум $ за сессию (пусто — без лимита)': ['Максимум $ за сесію (порожньо — без ліміту)', 'Max $ per session (empty — no limit)'],
  'Максимум $ в день': ['Максимум $ на день', 'Max $ per day'],
  'Запросов в минуту': ['Запитів на хвилину', 'Requests per minute'],
  'Одновременных запросов': ['Одночасних запитів', 'Concurrent requests'],
  'При достижении лимита платные запросы останавливаются до вашего подтверждения. Провайдер сам не переключается. Локальные модели лимитом $ не ограничиваются.':
    [
      'Коли ліміт досягнуто, платні запити зупиняються до вашого підтвердження. Провайдер сам не перемикається. Локальні моделі лімітом $ не обмежуються.',
      'When a limit is reached, paid requests stop until you confirm. The provider never switches on its own. Local models are not subject to $ limits.'
    ],
  'Цены моделей': ['Ціни моделей', 'Model prices'],
  'Цены меняются — впишите актуальные с сайта провайдера ($ за 1 млн токенов). Без цены расход показывается как «Цена неизвестна», а не $0.': [
    'Ціни змінюються — впишіть актуальні з сайту провайдера ($ за 1 млн токенів). Без ціни витрата показується як «Ціна невідома», а не $0.',
    'Prices change — enter current ones from the provider’s site ($ per 1M tokens). Without a price, spending shows as “Price unknown”, not $0.'
  ],
  вход: ['вхід', 'input'],
  выход: ['вихід', 'output'],
  'Сначала выберите модели на вкладке «Провайдеры».': ['Спершу виберіть моделі на вкладці «Провайдери».', 'Choose models on the “Providers” tab first.'],
  'Текущая сессия': ['Поточна сесія', 'Current session'],
  'Запросов: {n} · расход: {usd}': ['Запитів: {n} · витрати: {usd}', 'Requests: {n} · spent: {usd}'],
  'без цены: {n}': ['без ціни: {n}', 'unpriced: {n}'],

  // diagnostics tab
  'Проверка системы': ['Перевірка системи', 'System check'],
  'Проверяю…': ['Перевіряю…', 'Checking…'],
  'Запустить проверку': ['Запустити перевірку', 'Run check'],
  'Установить OCR (≈10 МБ)': ['Встановити OCR (≈10 МБ)', 'Install OCR (≈10 MB)'],
  'Проверит ключи, распознавание, соединение с моделями, горячие клавиши, защиту окна, офлайн-режим и базу.': [
    'Перевірить ключі, розпізнавання, з’єднання з моделями, гарячі клавіші, захист вікна, офлайн-режим і базу.',
    'Checks keys, recognition, model connections, shortcuts, window protection, offline mode and the database.'
  ],
  'Журнал (без ключей и текстов разговоров)': ['Журнал (без ключів і текстів розмов)', 'Log (no keys or conversation text)'],
  Пусто: ['Порожньо', 'Empty'],

  // speech & audio tab
  'Смешанный — автоопределение (медленнее)': ['Змішана — автовизначення (повільніше)', 'Mixed — auto-detect (slower)'],
  'На macOS движок ставится отдельно:': ['На macOS рушій встановлюється окремо:', 'On macOS the engine is installed separately:'],
  '(собран с Metal) или': ['(зібраний з Metal) або', '(built with Metal) or'],
  'Модель приложение скачает само.': ['Модель застосунок завантажить сам.', 'The app downloads the model itself.'],
  'Быстрый (процессор)': ['Швидка (процесор)', 'Fast (CPU)'],
  'Точнее (процессор)': ['Точніша (процесор)', 'More accurate (CPU)'],
  'Максимум (видеокарта NVIDIA)': ['Максимум (відеокарта NVIDIA)', 'Maximum (NVIDIA GPU)'],
  Быстрый: ['Швидка', 'Fast'],
  Точнее: ['Точніша', 'More accurate'],
  Максимум: ['Максимум', 'Maximum'],
  '≈1 с на фразу на CPU. Подходит всем.': ['≈1 с на фразу на CPU. Підходить усім.', '≈1 s per phrase on CPU. Works for everyone.'],
  '≈2 с на фразу — медленнее, но лучше на акцентах.': [
    '≈2 с на фразу — повільніше, але краще з акцентами.',
    '≈2 s per phrase — slower, but better with accents.'
  ],
  '≈0.1 с на фразу и лучшая точность. Первый запуск прогревается до 30 с.': [
    '≈0.1 с на фразу і найкраща точність. Перший запуск прогрівається до 30 с.',
    '≈0.1 s per phrase and the best accuracy. The first run warms up for up to 30 s.'
  ],
  'Metal на Apple Silicon — доли секунды на фразу.': [
    'Metal на Apple Silicon — частки секунди на фразу.',
    'Metal on Apple Silicon — a fraction of a second per phrase.'
  ],
  'Лучше на акцентах, всё ещё быстро на M-серии.': ['Краще з акцентами, усе ще швидко на M-серії.', 'Better with accents, still fast on M-series.'],
  'Large v3 Turbo — лучшая точность. После запуска движка — несколько секунд на прогрев.': [
    'Large v3 Turbo — найкраща точність. Після запуску рушія — кілька секунд на прогрів.',
    'Large v3 Turbo — best accuracy. A few seconds of warm-up after the engine starts.'
  ],
  '≈150 МБ': ['≈150 МБ', '≈150 MB'],
  '≈160 МБ': ['≈160 МБ', '≈160 MB'],
  '≈490 МБ': ['≈490 МБ', '≈490 MB'],
  '≈500 МБ': ['≈500 МБ', '≈500 MB'],
  '≈580 МБ': ['≈580 МБ', '≈580 MB'],
  '≈1.3 ГБ': ['≈1.3 ГБ', '≈1.3 GB'],
  'Загрузка {size}': ['Завантаження {size}', 'Download {size}'],
  'NVIDIA не найдена': ['NVIDIA не знайдено', 'NVIDIA not found'],
  Установлено: ['Встановлено', 'Installed'],
  Доустановить: ['Довстановити', 'Finish install'],
  'Установить и выбрать': ['Встановити й вибрати', 'Install and select'],
  'Загрузка: {name} — {got} / {total} МБ': ['Завантаження: {name} — {got} / {total} МБ', 'Downloading: {name} — {got} / {total} MB'],
  'Модели проверяются по SHA-256 после загрузки.': ['Моделі перевіряються за SHA-256 після завантаження.', 'Models are verified by SHA-256 after download.'],
  'macOS не дал доступ:': ['macOS не надала доступ:', 'macOS has not granted access:'],
  '«Микрофон»': ['«Мікрофон»', '“Microphone”'],
  '«Запись экрана и системного аудио» (нужна для звука собеседника)': [
    '«Запис екрана й системного аудіо» (потрібен для звуку співрозмовника)',
    '“Screen & System Audio Recording” (needed for the other person’s audio)'
  ],
  'После включения перезапустите Copilot.': ['Після ввімкнення перезапустіть Copilot.', 'Restart Copilot after turning it on.'],
  'Открыть настройки: {name}': ['Відкрити налаштування: {name}', 'Open settings: {name}'],
  'Запись экрана': ['Запис екрана', 'Screen Recording'],
  'Сигнал есть — всё слышно.': ['Сигнал є — усе чути.', 'Signal detected — all good.'],
  'Очень тихо — проверьте громкость.': ['Дуже тихо — перевірте гучність.', 'Very quiet — check the volume.'],
  'Тишина. Проверьте выбранный микрофон и его громкость в {where}.': [
    'Тиша. Перевірте вибраний мікрофон і його гучність у {where}.',
    'Silence. Check the selected microphone and its volume in {where}.'
  ],
  'Системных настройках → Звук': ['Системних параметрах → Звук', 'System Settings → Sound'],
  'Тишина. Включите звук в звонке/видео во время проверки.': [
    'Тиша. Увімкніть звук у дзвінку чи відео під час перевірки.',
    'Silence. Play sound in a call or video during the check.'
  ],
  'Ошибка: {msg}': ['Помилка: {msg}', 'Error: {msg}'],
  'Слушаю 4 с…': ['Слухаю 4 с…', 'Listening for 4 s…'],
  'Слышит ли меня?': ['Чи чує мене?', 'Can it hear me?'],
  'Слышит ли собеседника?': ['Чи чує співрозмовника?', 'Can it hear the other person?'],
  'Мой микрофон': ['Мій мікрофон', 'My microphone'],
  'Ваша речь — источник «user»': ['Ваше мовлення — джерело «user»', 'Your speech — the “user” source'],
  'Системный по умолчанию': ['Системний за замовчуванням', 'System default'],
  'Звук собеседника (системный звук)': ['Звук співрозмовника (системний звук)', 'Other person’s audio (system audio)'],
  'Весь системный звук через ScreenCaptureKit — нужен доступ «Запись экрана». Захват отдельного приложения пока не поддерживается.': [
    'Увесь системний звук через ScreenCaptureKit — потрібен доступ «Запис екрана». Захоплення окремого застосунку поки не підтримується.',
    'All system audio via ScreenCaptureKit — needs Screen Recording access. Capturing a single app is not supported yet.'
  ],
  'WASAPI loopback: весь звук, который играет Windows. Захват отдельного приложения пока не поддерживается.': [
    'WASAPI loopback: увесь звук, який відтворює Windows. Захоплення окремого застосунку поки не підтримується.',
    'WASAPI loopback: all audio Windows plays. Capturing a single app is not supported yet.'
  ],
  'Совет: наушники убирают эхо собеседника в микрофоне.': [
    'Порада: навушники прибирають луну співрозмовника в мікрофоні.',
    'Tip: headphones keep the other person’s voice out of your mic.'
  ],
  Устройства: ['Пристрої', 'Devices'],
  'Сырое аудио на диск не пишется. Пауза и «Завершить» останавливают захват полностью.': [
    'Сире аудіо на диск не записується. Пауза і «Завершити» повністю зупиняють захоплення.',
    'Raw audio is never written to disk. Pause and “Stop” halt capture completely.'
  ],
  'Распознавание речи (локально, whisper.cpp)': ['Розпізнавання мовлення (локально, whisper.cpp)', 'Speech recognition (local, whisper.cpp)'],
  'Язык речи': ['Мова мовлення', 'Speech language'],
  'Потоков процессора': ['Потоків процесора', 'CPU threads'],
  'Словарь терминов — помогает правильно писать названия (через запятую)': [
    'Словник термінів — допомагає правильно писати назви (через кому)',
    'Term glossary — helps spell names correctly (comma-separated)'
  ],
  'Последняя задержка распознавания: {ms} мс': ['Остання затримка розпізнавання: {ms} мс', 'Last recognition latency: {ms} ms'],

  // providers tab
  'нужен ключ': ['потрібен ключ', 'key required'],
  'без ключа': ['без ключа', 'no key'],
  Название: ['Назва', 'Name'],
  'Адрес API': ['Адреса API', 'API address'],
  'API-ключ': ['API-ключ', 'API key'],
  '(сохранён — введите новый, чтобы заменить)': ['(збережено — введіть новий, щоб замінити)', '(saved — enter a new one to replace it)'],
  '(не обязателен)': ['(необов’язковий)', '(optional)'],
  'где взять': ['де взяти', 'where to get it'],
  'Ждать первый токен, мс': ['Чекати перший токен, мс', 'First token timeout, ms'],
  'Разрешить как запасной': ['Дозволити як резервний', 'Allow as fallback'],
  'Если основной провайдер недоступен (429/5xx/таймаут), запрос можно отправить сюда. Без этой галочки данные сюда не попадут.': [
    'Якщо основний провайдер недоступний (429/5xx/таймаут), запит можна надіслати сюди. Без цієї позначки дані сюди не потраплять.',
    'If the main provider is unavailable (429/5xx/timeout), the request can go here. Without this box, no data is sent here.'
  ],
  'Ключ шифруется системным хранилищем ({store}) и не попадает в настройки, логи и экспорт.': [
    'Ключ шифрується системним сховищем ({store}) і не потрапляє в налаштування, журнали й експорт.',
    'The key is encrypted by the system store ({store}) and never reaches settings, logs or exports.'
  ],
  'Связка ключей': ['Связка ключів', 'Keychain'],
  Сохранить: ['Зберегти', 'Save'],
  'ID модели': ['ID моделі', 'Model ID'],
  '— выберите модель —': ['— виберіть модель —', '— choose a model —'],
  'загрузка…': ['завантаження…', 'loading…'],
  'Обновить список из API': ['Оновити список з API', 'Refresh the list from the API'],
  список: ['список', 'list'],
  вручную: ['вручну', 'manual'],
  'Соединение:': ['З’єднання:', 'Connection:'],
  'ок, {n} моделей, {ms} мс': ['ок, моделей: {n}, {ms} мс', 'ok, {n} models, {ms} ms'],
  'Текст:': ['Текст:', 'Text:'],
  'ок, первый токен {ms} мс («{sample}»)': ['ок, перший токен {ms} мс («{sample}»)', 'ok, first token {ms} ms (“{sample}”)'],
  'Изображение:': ['Зображення:', 'Image:'],
  'ок, модель видит картинки': ['ок, модель бачить зображення', 'ok, the model can see images'],
  'нет — {err}. Для снимков будет локальный OCR.': ['ні — {err}. Для знімків буде локальний OCR.', 'no — {err}. Screenshots will use local OCR.'],
  'Проверить соединение': ['Перевірити з’єднання', 'Test connection'],
  '— не использовать —': ['— не використовувати —', '— don’t use —'],
  'Подключённые провайдеры': ['Підключені провайдери', 'Connected providers'],
  Добавить: ['Додати', 'Add'],
  локально: ['локально', 'local'],
  облако: ['хмара', 'cloud'],
  'ключ зашифрован': ['ключ зашифровано', 'key encrypted'],
  запасной: ['резервний', 'fallback'],
  Удалить: ['Видалити', 'Delete'],
  'Пока нет. Для работы без интернета выберите Ollama.': ['Поки немає. Для роботи без інтернету виберіть Ollama.', 'None yet. Pick Ollama to work offline.'],
  'Какая модель за что отвечает': ['Яка модель за що відповідає', 'Which model does what'],
  'Список моделей берётся из API провайдера. Новую модель можно вписать вручную.': [
    'Список моделей береться з API провайдера. Нову модель можна вписати вручну.',
    'The model list comes from the provider’s API. You can type a new model in manually.'
  ],
  'Быстрый ответ (Say it, тезисы)': ['Швидка відповідь (Say it, тези)', 'Quick answer (Say it, talking points)'],
  'Подробный ответ': ['Детальна відповідь', 'Detailed answer'],
  'Снимки экрана (vision)': ['Знімки екрана (vision)', 'Screenshots (vision)'],
  Классификация: ['Класифікація', 'Classification'],
  'Итог встречи': ['Підсумок зустрічі', 'Meeting summary'],
  'Как отвечать (ваши инструкции для ИИ)': ['Як відповідати (ваші інструкції для ШІ)', 'How to answer (your instructions for the AI)'],
  'Например: отвечай коротко, от первого лица, как опытный QA; приводи примеры из fintech; без канцелярита.': [
    'Наприклад: відповідай коротко, від першої особи, як досвідчений QA; наводь приклади з fintech; без канцеляриту.',
    'For example: answer briefly, in first person, as an experienced QA; give fintech examples; no jargon.'
  ],
  'Добавляется к каждому ответу. Правила безопасности (не выдумывать факты, не раскрывать ключи) важнее.': [
    'Додається до кожної відповіді. Правила безпеки (не вигадувати факти, не розкривати ключі) важливіші.',
    'Added to every answer. Safety rules (no made-up facts, no revealing keys) take priority.'
  ],
  'Сохранится, когда уйдёте из поля.': ['Збережеться, коли вийдете з поля.', 'Saves when you leave the field.']
}
