import type { Dict } from './types'

// Messages built in the main process: statuses, errors, notices, diagnostics.
export const MAIN: Dict = {
  // export
  'Сессия не найдена': ['Сесію не знайдено', 'Session not found'],
  'Начало: {date}': ['Початок: {date}', 'Started: {date}'],
  'Вопросы и ответы': ['Питання і відповіді', 'Questions and answers'],
  '{ms} мс': ['{ms} мс', '{ms} ms'],
  Транскрипт: ['Транскрипт', 'Transcript'],
  Собеседник: ['Співрозмовник', 'Interviewer'],
  Я: ['Я', 'Me'],
  Подробно: ['Детально', 'Deep dive'],
  Экран: ['Екран', 'Screen'],

  // diagnostics
  'Хранилище ключей': ['Сховище ключів', 'Key storage'],
  'Ключи шифруются системой ({store}) под вашей учётной записью': [
    'Ключі шифрує система ({store}) під вашим обліковим записом',
    'Keys are encrypted by the system ({store}) under your user account'
  ],
  'Связка ключей macOS': ['Зв’язка ключів macOS', 'macOS Keychain'],
  'Шифрование недоступно — ключи не сохраняются': ['Шифрування недоступне — ключі не зберігаються', 'Encryption unavailable — keys are not saved'],
  'Распознавание речи': ['Розпізнавання мовлення', 'Speech recognition'],
  'Не установлено — откройте «Речь и звук» → «Установить»': [
    'Не встановлено — відкрийте «Мовлення і звук» → «Встановити»',
    'Not installed — open «Speech & audio» → «Install»'
  ],
  'whisper {model} запущен локально': ['whisper {model} запущено локально', 'whisper {model} running locally'],
  ', последняя задержка {ms} мс': [', остання затримка {ms} мс', ', last latency {ms} ms'],
  'не запускается': ['не запускається', 'does not start'],
  'Модель не выбрана': ['Модель не вибрано', 'No model selected'],
  'соединение {ms} мс': ['з’єднання {ms} мс', 'connected in {ms} ms'],
  локально: ['локально', 'local'],
  'Горячие клавиши': ['Гарячі клавіші', 'Shortcuts'],
  'Конфликты: {list}': ['Конфлікти: {list}', 'Conflicts: {list}'],
  'Все сочетания зарегистрированы, конфликтов нет': ['Усі сполучення зареєстровано, конфліктів немає', 'All shortcuts registered, no conflicts'],
  'Защита окна подсказок от захвата': ['Захист вікна підказок від захоплення', 'Hide the hints window from capture'],
  'Системный флаг {flag} доступен. Результат зависит от способа захвата — проверьте у получателя: начните демонстрацию экрана и попросите собеседника сказать, видно ли окно подсказок.':
    [
      'Системний прапорець {flag} доступний. Результат залежить від способу захоплення — перевірте в отримувача: почніть демонстрацію екрана і попросіть співрозмовника сказати, чи видно вікно підказок.',
      'The system flag {flag} is available. The result depends on how the screen is captured — check on the receiving side: start sharing your screen and ask the other person whether the hints window is visible.'
    ],
  'Нужна Windows 10 2004 или новее, либо macOS': ['Потрібна Windows 10 2004 або новіша, чи macOS', 'Requires Windows 10 2004 or later, or macOS'],
  'Офлайн-режим': ['Офлайн-режим', 'Offline mode'],
  'Внешний запрос НЕ заблокирован': ['Зовнішній запит НЕ заблоковано', 'An external request was NOT blocked'],
  'Внешние адреса заблокированы на уровне приложения': ['Зовнішні адреси заблоковано на рівні застосунку', 'External addresses are blocked by the app'],
  'Выключен: разрешены запросы к выбранным провайдерам': [
    'Вимкнено: дозволено запити до вибраних провайдерів',
    'Off: requests to the selected providers are allowed'
  ],
  'Локальный OCR': ['Локальний OCR', 'Local OCR'],
  'Установлен (eng, rus, ukr)': ['Встановлено (eng, rus, ukr)', 'Installed (eng, rus, ukr)'],
  'Не установлен — нужен только для моделей без vision': [
    'Не встановлено — потрібен лише для моделей без vision',
    'Not installed — only needed for models without vision'
  ],
  'Локальная база': ['Локальна база', 'Local database'],
  'Целостность в порядке': ['Цілісність у порядку', 'Integrity OK'],
  'Проблема: {detail}': ['Проблема: {detail}', 'Problem: {detail}'],
  'Быстрый ответ': ['Швидка відповідь', 'Quick answer'],
  'Подробный ответ': ['Детальна відповідь', 'Detailed answer'],

  // component statuses, tray, dialogs
  Основной: ['Основний', 'Main'],
  облако: ['хмара', 'cloud'],
  'не проверено': ['не перевірено', 'not tested'],
  'последний запрос с ошибкой': ['останній запит з помилкою', 'last request failed'],
  'модель не выбрана': ['модель не вибрано', 'no model selected'],
  'проверка не пройдена': ['перевірку не пройдено', 'check failed'],
  'только локальный OCR': ['лише локальний OCR', 'local OCR only'],
  'выкл.': ['вимк.', 'off'],
  'офлайн-режим: внешние вызовы заблокированы': ['офлайн-режим: зовнішні виклики заблоковано', 'offline mode: external calls blocked'],
  онлайн: ['онлайн', 'online'],
  развёрнут: ['розгорнуто', 'expanded'],
  компактный: ['компактний', 'compact'],
  скрыт: ['приховано', 'hidden'],
  'не поддерживается этой версией системы': ['не підтримується цією версією системи', 'not supported by this OS version'],
  'флаг установлен — работает не со всеми программами захвата, проверьте у получателя': [
    'прапорець встановлено — працює не з усіма програмами захоплення, перевірте в отримувача',
    'flag set — not every capture tool honours it, check on the receiving side'
  ],
  'включится при показе подсказок': ['увімкнеться, коли з’являться підказки', 'turns on when the hints are shown'],
  'Свёрнуто в трей. Нажмите значок, чтобы открыть.': ['Згорнуто в трей. Натисніть значок, щоб відкрити.', 'Minimized to the tray. Click the icon to open.'],
  '{accel} ({action}) занято другой программой': ['{accel} ({action}) зайняте іншою програмою', '{accel} ({action}) is taken by another app'],
  '{accel} ({action}) — некорректное сочетание': ['{accel} ({action}) — некоректне сполучення', '{accel} ({action}) — invalid shortcut'],
  'Снимки экрана выключены — разрешите их в «Настройки → Приватность»': [
    'Знімки екрана вимкнено — дозвольте їх у «Налаштування → Приватність»',
    'Screenshots are off — allow them in «Settings → Privacy»'
  ],
  'Не удалось получить изображение экрана': ['Не вдалося отримати зображення екрана', 'Could not capture the screen'],
  'Модель без vision — использован локальный OCR (качество зависит от чёткости текста)': [
    'Модель без vision — використано локальний OCR (якість залежить від чіткості тексту)',
    'Model has no vision — local OCR was used (quality depends on how sharp the text is)'
  ],
  '(OCR не нашёл текста)': ['(OCR не знайшов тексту)', '(OCR found no text)'],
  'Снимок не отправлен: {reason}': ['Знімок не надіслано: {reason}', 'Screenshot not sent: {reason}'],
  'Аудио не покидает компьютер — распознаётся локально (whisper.cpp)': [
    'Аудіо не залишає комп’ютер — розпізнається локально (whisper.cpp)',
    'Audio never leaves the computer — it is transcribed locally (whisper.cpp)'
  ],
  'Провайдеру ответов уходит: текст текущего вопроса, последние минуты транскрипта, подходящие фрагменты CV/JD и заметки профиля': [
    'Провайдеру відповідей надсилається: текст поточного питання, останні хвилини транскрипту, доречні фрагменти CV/JD і нотатки профілю',
    'The answer provider receives: the current question, the last minutes of the transcript, relevant CV/JD excerpts and profile notes'
  ],
  'Снимки экрана — только после вашего выделения и подтверждения': [
    'Знімки екрана — лише після вашого виділення і підтвердження',
    'Screenshots — only after you select an area and confirm'
  ],
  'История сохраняется только на этом компьютере (SQLite)': [
    'Історія зберігається лише на цьому комп’ютері (SQLite)',
    'History is stored on this computer only (SQLite)'
  ],
  'История не сохраняется': ['Історія не зберігається', 'History is not saved'],
  'Copilot — слушает': ['Copilot — слухає', 'Copilot — listening'],
  'Copilot — пауза': ['Copilot — пауза', 'Copilot — paused'],
  'Открыть Copilot': ['Відкрити Copilot', 'Open Copilot'],
  'Показать/скрыть подсказки': ['Показати/сховати підказки', 'Show/hide hints'],
  'Завершить сессию': ['Завершити сесію', 'End session'],
  Выход: ['Вихід', 'Quit'],
  'Нельзя удалить последний профиль': ['Не можна видалити останній профіль', 'You cannot delete the last profile'],
  'Выберите документ': ['Виберіть документ', 'Choose a document'],
  Документы: ['Документи', 'Documents'],
  'В документе не найден текст (возможно, это скан — нужен OCR)': [
    'У документі не знайдено тексту (можливо, це скан — потрібен OCR)',
    'No text found in the document (it may be a scan — OCR is needed)'
  ],
  'загрузка {name}: {pct}%': ['завантаження {name}: {pct}%', 'downloading {name}: {pct}%'],
  'не установлено': ['не встановлено', 'not installed'],
  установлен: ['встановлено', 'installed'],
  'Прошлая сессия завершилась аварийно — её транскрипт сохранён в «Истории».': [
    'Минула сесія завершилася аварійно — її транскрипт збережено в «Історії».',
    'The previous session ended unexpectedly — its transcript is saved in «History».'
  ],
  'Copilot — подсказки': ['Copilot — підказки', 'Copilot — hints'],

  // network guard, importers, providers
  'Некорректный адрес': ['Некоректна адреса', 'Invalid address'],
  'Схема {scheme} запрещена': ['Схему {scheme} заборонено', 'Scheme {scheme} is not allowed'],
  'Логин и пароль в адресе запрещены — используйте поле ключа': [
    'Логін і пароль в адресі заборонено — використовуйте поле ключа',
    'A login and password in the URL are not allowed — use the key field'
  ],
  'Незащищённый HTTP вне localhost: ключ и данные идут открытым текстом': [
    'Незахищений HTTP поза localhost: ключ і дані передаються відкритим текстом',
    'Plain HTTP outside localhost: the key and data travel unencrypted'
  ],
  'Заблокировано офлайн-режимом': ['Заблоковано офлайн-режимом', 'Blocked by offline mode'],
  'Адрес запрещён политикой приложения': ['Адресу заборонено політикою застосунку', 'Address blocked by the app policy'],
  'Файл больше 15 МБ': ['Файл більший за 15 МБ', 'The file is larger than 15 MB'],
  'Формат {ext} не поддерживается — используйте PDF, DOCX, TXT или MD': [
    'Формат {ext} не підтримується — використовуйте PDF, DOCX, TXT або MD',
    'Format {ext} is not supported — use PDF, DOCX, TXT or MD'
  ],
  'без расширения': ['без розширення', 'without extension'],
  'Провайдер не найден': ['Провайдера не знайдено', 'Provider not found'],
  'Модель без поддержки изображений — для экрана будет OCR': [
    'Модель без підтримки зображень — для екрана буде OCR',
    'The model does not support images — OCR will be used for the screen'
  ],
  'Модель не распознала тестовое изображение («{reply}»)': [
    'Модель не розпізнала тестове зображення («{reply}»)',
    'The model did not recognize the test image («{reply}»)'
  ],
  'нет ответа за {ms} мс': ['немає відповіді за {ms} мс', 'no response in {ms} ms'],
  'ответ замер на {ms} мс': ['відповідь завмерла на {ms} мс', 'the response stalled for {ms} ms'],
  'оборвано после начала ответа: {detail}': ['обірвано після початку відповіді: {detail}', 'cut off after the response started: {detail}'],
  'Системное шифрование недоступно — ключ не сохранён': [
    'Системне шифрування недоступне — ключ не збережено',
    'System encryption unavailable — the key was not saved'
  ],
  'Проверьте API-ключ': ['Перевірте API-ключ', 'Check the API key'],
  'Закончился баланс или лимит у провайдера': ['Закінчився баланс або ліміт у провайдера', 'Out of balance or quota at the provider'],
  'Слишком много запросов — провайдер просит подождать': ['Забагато запитів — провайдер просить зачекати', 'Too many requests — the provider asks to wait'],
  'Сбой на стороне провайдера': ['Збій на боці провайдера', 'Provider-side failure'],
  'Провайдер не ответил вовремя': ['Провайдер не відповів вчасно', 'The provider did not respond in time'],
  'Сеть недоступна': ['Мережа недоступна', 'Network unavailable'],
  'Достигнут лимит бюджета': ['Досягнуто ліміту бюджету', 'Budget limit reached'],
  'Провайдер отклонил запрос': ['Провайдер відхилив запит', 'The provider rejected the request'],
  'Модель или адрес не найдены': ['Модель або адресу не знайдено', 'Model or address not found'],
  Отменено: ['Скасовано', 'Cancelled'],
  'Функция не поддерживается моделью': ['Функція не підтримується моделлю', 'Not supported by the model'],
  'Распознавание речи недоступно': ['Розпізнавання мовлення недоступне', 'Speech recognition unavailable'],
  'Устройство недоступно': ['Пристрій недоступний', 'Device unavailable'],
  'Неизвестная ошибка': ['Невідома помилка', 'Unknown error'],
  'Текст и изображения. Данные уходят в OpenAI.': ['Текст і зображення. Дані надсилаються в OpenAI.', 'Text and images. Data goes to OpenAI.'],
  'Текст и изображения. Аудио не отправляется — только распознанный текст.': [
    'Текст і зображення. Аудіо не надсилається — лише розпізнаний текст.',
    'Text and images. No audio is sent — only the transcribed text.'
  ],
  'Текст и изображения. Данные уходят в Google.': ['Текст і зображення. Дані надсилаються в Google.', 'Text and images. Data goes to Google.'],
  'Шлюз — отдельный получатель данных: он пересылает запрос выбранной модели.': [
    'Шлюз — окремий отримувач даних: він пересилає запит вибраній моделі.',
    'A gateway is a separate data recipient: it forwards the request to the chosen model.'
  ],
  'Ollama (локально)': ['Ollama (локально)', 'Ollama (local)'],
  'Полностью на этом компьютере. Работает офлайн.': ['Повністю на цьому комп’ютері. Працює офлайн.', 'Fully on this computer. Works offline.'],
  'LM Studio (локально)': ['LM Studio (локально)', 'LM Studio (local)'],
  'Локальный OpenAI-совместимый сервер.': ['Локальний OpenAI-сумісний сервер.', 'Local OpenAI-compatible server.'],
  'Свой endpoint (OpenAI-compatible)': ['Свій endpoint (OpenAI-compatible)', 'Custom endpoint (OpenAI-compatible)'],
  'vLLM, LiteLLM и любой совместимый сервер. Проверьте, кому уходят данные.': [
    'vLLM, LiteLLM і будь-який сумісний сервер. Перевірте, кому йдуть дані.',
    'vLLM, LiteLLM or any compatible server. Check who receives your data.'
  ],

  // speech recognition
  'Не установлен движок распознавания': ['Рушій розпізнавання не встановлено', 'The recognition engine is not installed'],
  'Нет модели {name}': ['Немає моделі {name}', 'Model {name} is missing'],
  'Распознавание остановилось (код {code})': ['Розпізнавання зупинилося (код {code})', 'Recognition stopped (code {code})'],
  перезапуск: ['перезапуск', 'restarting'],
  'Движок whisper-server не найден. Установите его командой «brew install whisper-cpp» (сборка с Metal) или соберите whisper.cpp с -DGGML_METAL=ON (scripts/build-whisper-mac.sh), затем нажмите кнопку ещё раз.':
    [
      'Рушій whisper-server не знайдено. Встановіть його командою «brew install whisper-cpp» (збірка з Metal) або зберіть whisper.cpp з -DGGML_METAL=ON (scripts/build-whisper-mac.sh), потім натисніть кнопку ще раз.',
      'whisper-server was not found. Install it with «brew install whisper-cpp» (built with Metal) or build whisper.cpp with -DGGML_METAL=ON (scripts/build-whisper-mac.sh), then press the button again.'
    ],
  'Неизвестная модель {name}': ['Невідома модель {name}', 'Unknown model {name}'],
  'Контрольная сумма модели не совпала ({sha}…) — файл удалён': [
    'Контрольна сума моделі не збіглася ({sha}…) — файл видалено',
    'Model checksum mismatch ({sha}…) — the file was deleted'
  ],
  'Контрольная сумма архива не совпала ({sha}…) — файл удалён': [
    'Контрольна сума архіву не збіглася ({sha}…) — файл видалено',
    'Archive checksum mismatch ({sha}…) — the file was deleted'
  ],
  'В архиве нет whisper-server.exe': ['В архіві немає whisper-server.exe', 'whisper-server.exe is missing from the archive'],
  'Загрузка не удалась: HTTP {status}': ['Завантаження не вдалося: HTTP {status}', 'Download failed: HTTP {status}'],
  '{cmd} завершился с кодом {code}': ['{cmd} завершився з кодом {code}', '{cmd} exited with code {code}'],
  'не хватает Microsoft Visual C++ Redistributable (x64) — установите его с сайта Microsoft и перезапустите': [
    'бракує Microsoft Visual C++ Redistributable (x64) — встановіть його з сайту Microsoft і перезапустіть',
    'Microsoft Visual C++ Redistributable (x64) is missing — install it from Microsoft and restart'
  ],
  'процессор, похоже, без нужных инструкций (AVX) — на старом CPU whisper.cpp может не запускаться': [
    'процесор, схоже, без потрібних інструкцій (AVX) — на старому CPU whisper.cpp може не запускатися',
    'the CPU seems to lack the required instructions (AVX) — whisper.cpp may not run on an old CPU'
  ],
  'ошибка CUDA/видеокарты — обновите драйвер NVIDIA или выберите CPU-движок в «Настройки → Распознавание»': [
    'помилка CUDA/відеокарти — оновіть драйвер NVIDIA або виберіть CPU-рушій у «Налаштування → Розпізнавання»',
    'CUDA/GPU error — update the NVIDIA driver or choose the CPU engine in «Settings → Recognition»'
  ],
  'файл модели повреждён или несовместим — удалите и скачайте модель заново': [
    'файл моделі пошкоджений або несумісний — видаліть і завантажте модель знову',
    'the model file is corrupt or incompatible — delete it and download the model again'
  ],
  'порт занят другим процессом — закройте лишние копии и попробуйте снова': [
    'порт зайнятий іншим процесом — закрийте зайві копії і спробуйте знову',
    'the port is used by another process — close extra copies and try again'
  ],
  'аварийное завершение (access violation) — возможно, повреждён движок или модель; переустановите распознавание': [
    'аварійне завершення (access violation) — можливо, пошкоджено рушій або модель; перевстановіть розпізнавання',
    'crashed (access violation) — the engine or model may be damaged; reinstall recognition'
  ],
  'запуск заблокирован (антивирус или права доступа) — добавьте папку приложения в исключения': [
    'запуск заблоковано (антивірус або права доступу) — додайте папку застосунку у винятки',
    'launch blocked (antivirus or permissions) — add the app folder to the exclusions'
  ],
  'whisper-server завершился при запуске': ['whisper-server завершився під час запуску', 'whisper-server exited on startup'],
  'whisper-server не ответил за 60 с': ['whisper-server не відповів за 60 с', 'whisper-server did not respond within 60 s'],
  'код {code}': ['код {code}', 'code {code}'],
  'вывод: {lines}': ['вивід: {lines}', 'output: {lines}'],
  'модель Silero не найдена: {path}': ['модель Silero не знайдено: {path}', 'Silero model not found: {path}'],
  'Base — быстрая, для CPU': ['Base — швидка, для CPU', 'Base — fast, for CPU'],
  'Small — точнее, медленнее на CPU': ['Small — точніша, повільніша на CPU', 'Small — more accurate, slower on CPU'],
  'Large v3 Turbo — лучшая точность, нужна NVIDIA': ['Large v3 Turbo — найкраща точність, потрібна NVIDIA', 'Large v3 Turbo — best accuracy, needs NVIDIA'],
  'OCR-данные {lang}: HTTP {status}': ['OCR-дані {lang}: HTTP {status}', 'OCR data {lang}: HTTP {status}'],
  'OCR-данные {lang}: контрольная сумма не совпала — файл не сохранён': [
    'OCR-дані {lang}: контрольна сума не збіглася — файл не збережено',
    'OCR data {lang}: checksum mismatch — the file was not saved'
  ],
  'OCR не установлен — скачайте языковые данные в «Диагностике»': [
    'OCR не встановлено — завантажте мовні дані в «Діагностиці»',
    'OCR is not installed — download the language data in «Diagnostics»'
  ],

  // budget and session
  'Достигнут лимит ${usd} на сессию': ['Досягнуто ліміту ${usd} на сесію', 'Reached the ${usd} per-session limit'],
  'Достигнут лимит ${usd} в день': ['Досягнуто ліміту ${usd} на день', 'Reached the ${usd} daily limit'],
  'Отправка в облако не разрешена — включите её в «Приватность» или выберите локальную модель': [
    'Надсилання в хмару не дозволено — увімкніть його в «Приватність» або виберіть локальну модель',
    'Sending to the cloud is not allowed — enable it in «Privacy» or choose a local model'
  ],
  'Продолжена прошлая сессия — контекст восстановлен.': ['Продовжено минулу сесію — контекст відновлено.', 'Previous session resumed — context restored.'],
  '[Экран] {text}': ['[Екран] {text}', '[Screen] {text}'],
  'Своё задание': ['Своє завдання', 'Your task'],
  'Решить задачу': ['Вирішити задачу', 'Solve the task'],
  'Пока нечего отвечать — вопрос не распознан': ['Поки нема на що відповідати — питання не розпізнано', 'Nothing to answer yet — no question recognized'],
  'Модель для изображений не выбрана': ['Модель для зображень не вибрано', 'No model selected for images'],
  'Не выбрана модель для ответов — откройте «Провайдеры»': [
    'Не вибрано модель для відповідей — відкрийте «Провайдери»',
    'No answer model selected — open «Providers»'
  ],
  'Офлайн-режим: эта модель работает в облаке': ['Офлайн-режим: ця модель працює в хмарі', 'Offline mode: this model runs in the cloud'],
  'Лимит запросов приложения — подождите или увеличьте лимит': [
    'Ліміт запитів застосунку — зачекайте або збільште ліміт',
    'App request limit — wait or raise the limit'
  ],
  '{from}: {error}. Переключено на {to} — вы разрешили его как запасной.': [
    '{from}: {error}. Перемкнено на {to} — ви дозволили його як запасний.',
    '{from}: {error}. Switched to {to} — you allowed it as a fallback.'
  ]
}
