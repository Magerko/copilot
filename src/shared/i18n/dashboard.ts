import type { Dict } from './types'

// Dashboard pages, onboarding, overlay and the region picker.
export const DASHBOARD: Dict = {
  // onboarding
  'Шаг {n} из {total}': ['Крок {n} з {total}', 'Step {n} of {total}'],
  'Помощник слушает разговор, вовремя замечает вопрос и показывает короткий ответ с опорой на ваше резюме. Распознавание речи — на этом компьютере, модель для ответов вы выбираете сами.':
    [
      'Помічник слухає розмову, вчасно помічає питання й показує коротку відповідь з опорою на ваше резюме. Розпізнавання мови — на цьому комп’ютері, модель для відповідей ви обираєте самі.',
      'The assistant listens to the conversation, catches the question in time and shows a short answer grounded in your CV. Speech recognition runs on this computer; you pick the answer model yourself.'
    ],
  'Язык интерфейса': ['Мова інтерфейсу', 'Interface language'],
  'Язык ответов': ['Мова відповідей', 'Answer language'],
  'Как в вопросе': ['Як у питанні', 'Same as the question'],
  'Язык разговора': ['Мова розмови', 'Conversation language'],
  'Займёт около 3 минут. Любой шаг можно пропустить и настроить позже.': [
    'Займе близько 3 хвилин. Будь-який крок можна пропустити й налаштувати пізніше.',
    'Takes about 3 minutes. You can skip any step and set it up later.'
  ],
  'Звук: вы и собеседник — раздельно': ['Звук: ви і співрозмовник — окремо', 'Audio: you and the other side, separately'],
  'Микрофон — это вы. Системный звук — голос собеседника из Zoom, Meet, Teams или браузера. Подсказки строятся по речи собеседника.': [
    'Мікрофон — це ви. Системний звук — голос співрозмовника із Zoom, Meet, Teams або браузера. Підказки будуються за мовленням співрозмовника.',
    'The microphone is you. System audio is the other person’s voice from Zoom, Meet, Teams or the browser. Hints are based on what they say.'
  ],
  'Распознавание речи': ['Розпізнавання мови', 'Speech recognition'],
  'Работает локально (whisper.cpp): аудио не покидает компьютер. Нужно один раз скачать движок и модель — размер и проверка контрольной суммы показаны ниже.': [
    'Працює локально (whisper.cpp): аудіо не залишає комп’ютер. Потрібно один раз завантажити рушій і модель — розмір і перевірку контрольної суми показано нижче.',
    'Runs locally (whisper.cpp): audio never leaves the computer. Download the engine and a model once — sizes and checksum verification are shown below.'
  ],
  'Без распознавания можно вводить вопросы текстом.': ['Без розпізнавання можна вводити питання текстом.', 'Without recognition you can type questions.'],
  'Модель для ответов': ['Модель для відповідей', 'Answer model'],
  'Свой ключ (BYOK) или локальная модель. Ollama работает без интернета и без ключа.': [
    'Свій ключ (BYOK) або локальна модель. Ollama працює без інтернету й без ключа.',
    'Your own key (BYOK) or a local model. Ollama works offline and without a key.'
  ],
  'Другой провайдер': ['Інший провайдер', 'Another provider'],
  'Проверяю текст и изображение…': ['Перевіряю текст і зображення…', 'Checking text and image…'],
  'Проверить соединение': ['Перевірити з’єднання', 'Test connection'],
  'Снимки экрана будут распознаваться локальным OCR. Отдельную vision-модель можно выбрать в настройках.': [
    'Знімки екрана розпізнаватиме локальний OCR. Окрему vision-модель можна вибрати в налаштуваннях.',
    'Screenshots will be read by local OCR. You can pick a separate vision model in Settings.'
  ],
  'Загрузить резюме (PDF/DOCX/TXT)': ['Завантажити резюме (PDF/DOCX/TXT)', 'Upload CV (PDF/DOCX/TXT)'],
  'Описание вакансии': ['Опис вакансії', 'Job description'],
  '{n} фрагм.': ['{n} фрагм.', '{n} chunks'],
  'Ответы о вашем опыте строятся только на загруженных фактах. Чего нет в резюме, приложение не придумывает.': [
    'Відповіді про ваш досвід будуються лише на завантажених фактах. Чого немає в резюме, застосунок не вигадує.',
    'Answers about your experience use only the facts you uploaded. Anything missing from the CV is never made up.'
  ],
  'Проверка за 30 секунд': ['Перевірка за 30 секунд', '30-second check'],
  'Нажмите «Начать» и задайте вопрос вслух, например: «Что такое идемпотентность в REST?» — или введите его. Появится окно подсказок.': [
    'Натисніть «Почати» і поставте питання вголос, наприклад: «Що таке ідемпотентність у REST?» — або введіть його. З’явиться вікно підказок.',
    'Press “Start” and ask a question out loud, e.g. “What is idempotency in REST?” — or type it. The hints window will appear.'
  ],
  'Идёт проверка… {n} с': ['Триває перевірка… {n} с', 'Checking… {n} s'],
  'Распознано:': ['Розпізнано:', 'Recognized:'],
  'первый токен {s} с': ['перший токен {s} с', 'first token {s} s'],
  'Последнее: согласие и честность': ['Останнє: згода і чесність', 'Last step: consent and honesty'],
  'Записывать звук и использовать AI-подсказки можно только там, где это разрешено правилами и участники согласны. Copilot не обходит прокторинг и средства контроля и не обещает невидимости.':
    [
      'Записувати звук і використовувати AI-підказки можна лише там, де це дозволено правилами і учасники згодні. Copilot не обходить прокторинг і засоби контролю та не обіцяє невидимості.',
      'Record audio and use AI hints only where the rules allow it and participants agree. Copilot does not bypass proctoring or monitoring and does not promise invisibility.'
    ],
  'Сохранять историю сессий на этом компьютере': ['Зберігати історію сесій на цьому комп’ютері', 'Keep session history on this computer'],
  'Можно удалить в любой момент. Без истории нет восстановления после сбоя.': [
    'Можна видалити будь-коли. Без історії немає відновлення після збою.',
    'You can delete it any time. Without history there is no recovery after a crash.'
  ],
  'Разрешить снимки экрана по моей команде': ['Дозволити знімки екрана за моєю командою', 'Allow screenshots on my command'],
  'Разрешить отправку в облачную модель': ['Дозволити надсилання в хмарну модель', 'Allow sending to a cloud model'],
  'Нужно, только если модель для ответов — не на этом компьютере. Уходит вопрос, недавний транскрипт и подходящие фрагменты документов.': [
    'Потрібно, лише якщо модель для відповідей не на цьому комп’ютері. Надсилаються питання, недавній транскрипт і доречні фрагменти документів.',
    'Needed only if the answer model is not on this computer. The question, recent transcript and relevant document chunks are sent.'
  ],
  'Я понимаю и буду сообщать участникам о записи и AI-обработке': [
    'Я розумію і повідомлятиму учасникам про запис і AI-обробку',
    'I understand and will tell participants about recording and AI processing'
  ],
  'Настройка заняла {n} мин.': ['Налаштування зайняло {n} хв.', 'Setup took {n} min.'],

  // home
  'Сессия идёт': ['Сесія триває', 'Session in progress'],
  'Готовы к разговору?': ['Готові до розмови?', 'Ready for the conversation?'],
  'Вопросы можно читать вслух самому или вводить текстом — подсказки на ваш голос тоже.': [
    'Питання можна читати вголос самому або вводити текстом — підказки на ваш голос теж.',
    'Read questions aloud yourself or type them — hints respond to your voice too.'
  ],
  'Подсказки только на речь собеседника (системный звук). Ваш голос — в транскрипт и контекст.': [
    'Підказки лише на мовлення співрозмовника (системний звук). Ваш голос — у транскрипт і контекст.',
    'Hints only for the other person’s speech (system audio). Your voice goes to the transcript and context.'
  ],
  'Без подсказок: транскрипт встречи и вопросы сохраняются локально.': [
    'Без підказок: транскрипт зустрічі й питання зберігаються локально.',
    'No hints: the meeting transcript and questions are saved locally.'
  ],
  'Открыть сессию': ['Відкрити сесію', 'Open session'],
  '{title} · реплик: {n}': ['{title} · реплік: {n}', '{title} · {n} lines'],
  'Распознавание речи не установлено.': ['Розпізнавання мови не встановлено.', 'Speech recognition is not installed.'],
  Установить: ['Встановити', 'Install'],
  '— или задавайте вопросы текстом.': ['— або ставте питання текстом.', '— or type your questions.'],
  'Не выбрана модель для ответов.': ['Не вибрано модель для відповідей.', 'No answer model selected.'],
  'Подключить провайдера': ['Підключити провайдера', 'Connect a provider'],
  'на этом ПК': ['на цьому ПК', 'on this PC'],
  облако: ['хмара', 'cloud'],
  'Провайдер не выбран — никуда.': ['Провайдера не вибрано — нікуди.', 'No provider selected — nowhere.'],
  'Горячие клавиши': ['Гарячі клавіші', 'Shortcuts'],
  'Показать/скрыть подсказки': ['Показати/сховати підказки', 'Show/hide hints'],
  'Пауза / продолжить': ['Пауза / продовжити', 'Pause / resume'],
  'Снимок области экрана': ['Знімок області екрана', 'Screen region capture'],
  'Развернуть / подробно': ['Розгорнути / детально', 'Expand / details'],
  'Вся история →': ['Уся історія →', 'All history →'],
  '{n} вопр.': ['{n} пит.', '{n} q.'],
  прервана: ['перервана', 'interrupted'],
  'Пока нет.': ['Поки немає.', 'None yet.'],
  'Сохранение истории выключено.': ['Збереження історії вимкнено.', 'History saving is off.'],

  // live session
  'локально, бесплатно': ['локально, безкоштовно', 'local, free'],
  'токены оценочно': ['токени приблизно', 'tokens estimated'],
  Я: ['Я', 'Me'],
  Собеседник: ['Співрозмовник', 'Interviewer'],
  Транскрипт: ['Транскрипт', 'Transcript'],
  'локально · последние {n} мин идут в контекст': ['локально · останні {n} хв ідуть у контекст', 'local · the last {n} min go into context'],
  'Слушаю… Говорите или включите звук собеседника.': [
    'Слухаю… Говоріть або увімкніть звук співрозмовника.',
    'Listening… Speak or turn on the other side’s audio.'
  ],
  'Пауза.': ['Пауза.', 'Paused.'],
  'Здесь появится распознанная речь.': ['Тут з’явиться розпізнане мовлення.', 'Recognized speech will appear here.'],
  'Новые платные запросы остановлены до вашего решения.': ['Нові платні запити зупинено до вашого рішення.', 'New paid requests are paused until you decide.'],
  'Продолжить сверх лимита': ['Продовжити понад ліміт', 'Continue over the limit'],
  'ревизия {n}': ['ревізія {n}', 'revision {n}'],
  собеседник: ['співрозмовник', 'interviewer'],
  вы: ['ви', 'you'],
  'Если распознано неверно': ['Якщо розпізнано неправильно', 'If it was misrecognized'],
  Исправить: ['Виправити', 'Edit'],
  'Ответить на исправленный': ['Відповісти на виправлене', 'Answer the edited one'],
  'Вопрос распознан. Автоответ выключен —': ['Питання розпізнано. Автовідповідь вимкнено —', 'Question recognized. Auto answer is off —'],
  или: ['або', 'or'],
  'Как только прозвучит вопрос — здесь появится ответ.': [
    'Щойно прозвучить питання — тут з’явиться відповідь.',
    'As soon as a question is asked, the answer appears here.'
  ],
  'Начните сессию или задайте вопрос текстом слева.': [
    'Почніть сесію або поставте питання текстом ліворуч.',
    'Start a session or type a question on the left.'
  ],
  'Расход сессии: {usd} · запросов {n}': ['Витрати сесії: {usd} · запитів {n}', 'Session cost: {usd} · {n} requests'],
  '{n} без цены (лимит $ для них не контролируется)': ['{n} без ціни (ліміт $ для них не контролюється)', '{n} unpriced ($ limit does not apply to them)'],

  // profile
  'Новый профиль': ['Новий профіль', 'New profile'],
  'Название (например, «Яндекс — Senior Backend»)': ['Назва (наприклад, «Monobank — Senior Backend»)', 'Name (e.g. “Acme — Senior Backend”)'],
  'Тип интервью': ['Тип інтерв’ю', 'Interview type'],
  'Стиль подачи': ['Стиль подачі', 'Delivery style'],
  'Заметки о себе и проектах (попадают в контекст как факты, которые вы подтверждаете)': [
    'Нотатки про себе й проєкти (потрапляють у контекст як факти, які ви підтверджуєте)',
    'Notes about you and your projects (added to context as facts you confirm)'
  ],
  'Например: стек — Python/FastAPI, проект X: ускорил отчёты в 3 раза…': [
    'Наприклад: стек — Python/FastAPI, проєкт X: пришвидшив звіти в 3 рази…',
    'E.g.: stack — Python/FastAPI, project X: made reports 3× faster…'
  ],
  Сохранить: ['Зберегти', 'Save'],
  Сохранено: ['Збережено', 'Saved'],
  'Удалить профиль': ['Видалити профіль', 'Delete profile'],
  'Документы профиля': ['Документи профілю', 'Profile documents'],
  '{kind} (файл)': ['{kind} (файл)', '{kind} (file)'],
  'Вставить текст': ['Вставити текст', 'Paste text'],
  'PDF, DOCX, TXT, MD. Текст извлекается и индексируется на этом компьютере. В ответ попадают только подходящие к вопросу фрагменты.': [
    'PDF, DOCX, TXT, MD. Текст витягується й індексується на цьому комп’ютері. У відповідь потрапляють лише фрагменти, доречні до питання.',
    'PDF, DOCX, TXT, MD. Text is extracted and indexed on this computer. Only chunks relevant to the question go into an answer.'
  ],
  'Вставьте текст вакансии или резюме': ['Вставте текст вакансії або резюме', 'Paste the job description or CV text'],
  '{kind} (вставка)': ['{kind} (вставка)', '{kind} (pasted)'],
  Добавить: ['Додати', 'Add'],
  Удалить: ['Видалити', 'Delete'],
  'Документов нет. Без резюме ответы будут общими — личный опыт не будет придумываться.': [
    'Документів немає. Без резюме відповіді будуть загальними — особистий досвід не вигадуватиметься.',
    'No documents. Without a CV answers stay generic — personal experience is never made up.'
  ],
  'HR / поведенческое': ['HR / поведінкове', 'HR / behavioral'],
  'QA / тестирование': ['QA / тестування', 'QA / testing'],
  'Coding-интервью': ['Coding-інтерв’ю', 'Coding interview'],
  'Рабочая встреча': ['Робоча зустріч', 'Work meeting'],
  'Максимально коротко': ['Максимально коротко', 'As short as possible'],
  Естественно: ['Природно', 'Natural'],
  Академично: ['Академічно', 'Academic'],
  'На английском B2': ['Англійською B2', 'English, B2 level'],
  Резюме: ['Резюме', 'CV'],
  Вакансия: ['Вакансія', 'Job description'],
  Заметки: ['Нотатки', 'Notes'],

  // history
  'Удалить все сессии, транскрипты и журнал без возможности восстановления?': [
    'Видалити всі сесії, транскрипти й журнал без можливості відновлення?',
    'Delete all sessions, transcripts and the log permanently?'
  ],
  'Вся история удалена с этого компьютера.': ['Усю історію видалено з цього комп’ютера.', 'All history was deleted from this computer.'],
  'Да, удалить всё': ['Так, видалити все', 'Yes, delete everything'],
  'Удалить всё': ['Видалити все', 'Delete all'],
  'Поиск по названию и транскрипту': ['Пошук за назвою і транскриптом', 'Search titles and transcripts'],
  'Ничего не найдено': ['Нічого не знайдено', 'Nothing found'],
  'Выберите сессию слева.': ['Виберіть сесію ліворуч.', 'Pick a session on the left.'],
  'Экспортировано в Markdown': ['Експортовано в Markdown', 'Exported to Markdown'],
  'Экспорт .md': ['Експорт .md', 'Export .md'],
  'Экспортировано в JSON': ['Експортовано в JSON', 'Exported to JSON'],

  // shell
  офлайн: ['офлайн', 'offline'],
  уровень: ['рівень', 'level'],

  // capture statuses (shown in the status panel)
  'выключен в настройках': ['вимкнено в налаштуваннях', 'off in settings'],
  выключен: ['вимкнено', 'off'],
  пауза: ['пауза', 'paused'],
  'устройство отключено': ['пристрій від’єднано', 'device disconnected'],
  микрофон: ['мікрофон', 'microphone'],
  'системный звук': ['системний звук', 'system audio'],
  'весь системный звук (loopback)': ['увесь системний звук (loopback)', 'all system audio (loopback)'],
  'микрофон недоступен: {msg}. Выберите другое устройство в настройках': [
    'мікрофон недоступний: {msg}. Виберіть інший пристрій у налаштуваннях',
    'microphone unavailable: {msg}. Pick another device in Settings'
  ],
  'системный звук недоступен: {msg}': ['системний звук недоступний: {msg}', 'system audio unavailable: {msg}'],
  '{why} — переподключаюсь…': ['{why} — перепідключаюся…', '{why} — reconnecting…'],
  'смена микрофона': ['зміна мікрофона', 'microphone changed'],
  'смена устройства вывода': ['зміна пристрою виводу', 'output device changed'],
  'система не отдала аудиодорожку': ['система не віддала аудіодоріжку', 'the system returned no audio track'],
  'нет доступа «Запись экрана и системного аудио». Разрешите Copilot в Системных настройках → Конфиденциальность и безопасность и перезапустите приложение': [
    'немає доступу «Запис екрана і системного аудіо». Дозвольте Copilot у Системних параметрах → Конфіденційність і безпека та перезапустіть застосунок',
    'no “Screen & System Audio Recording” access. Allow Copilot in System Settings → Privacy & Security and restart the app'
  ],

  // overlay
  '{s} с': ['{s} с', '{s} s'],
  локально: ['локально', 'local'],
  'Платные запросы остановлены.': ['Платні запити зупинено.', 'Paid requests are paused.'],
  уточнено: ['уточнено', 'refined'],
  'Жду вопрос.': ['Чекаю на питання.', 'Waiting for a question.'],
  '— ответить сразу, или нажмите на фразу выше.': ['— відповісти одразу, або натисніть на фразу вище.', '— answer now, or click a line above.'],
  'Код появится после «Подробнее» или снимка экрана с режимом «с кодом».': [
    'Код з’явиться після «Детальніше» або знімка екрана з режимом «з кодом».',
    'Code appears after “Deep dive” or a screenshot with “with code”.'
  ],
  'Пока пусто': ['Поки порожньо', 'Empty for now'],

  // region picker
  'Отправится только выделенная область, после нажатия кнопки.': [
    'Буде надіслано лише виділену область, після натискання кнопки.',
    'Only the selected area is sent, after you press a button.'
  ],
  'Модель без vision: текст распознается локально (OCR) и уйдёт текстом.': [
    'Модель без vision: текст розпізнається локально (OCR) і піде текстом.',
    'Model without vision: text is read locally (OCR) and sent as text.'
  ],
  'Нет vision-модели и OCR — установите OCR в «Диагностике».': [
    'Немає vision-моделі та OCR — встановіть OCR у «Діагностиці».',
    'No vision model or OCR — install OCR in “Diagnostics”.'
  ],
  'Обведите личные данные — они будут закрашены.': ['Обведіть особисті дані — їх буде замальовано.', 'Draw around personal data — it will be masked.']
}
