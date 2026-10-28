
## S1 — Electron как хост (overlay, защита захвата, loopback, sqlite, secrets)
**Скрипт:** `spikes/s1-electron/main.js` (+ `dash.html`, `result.json` с сырым выводом). Electron 45.1.0 (latest stable на 2026-10-27), Chrome 156.0.8078.49, Node 24.22.1. Запуск `electron.cmd .` из каталога с кириллицей и OneDrive в пути: проблем не обнаружено (npm i, запуск, loadFile — всё работает). Весь прогон ~32 с (основное время — запуски PowerShell для замера foreground).

**Q1. Always-on-top overlay с `focusable:false`, не крадёт фокус при `showInactive()`?**
**Ответ: ДА**
**Факты:** BrowserWindow `{frame:false, alwaysOnTop:true, focusable:false, skipTaskbar:true}` + `setAlwaysOnTop(true,'screen-saver')`. GetForegroundWindow (через PowerShell Add-Type) до показа = 591886, после `showInactive()` + 1.5 с = 591886 (в первом прогоне 984866 = 984866). `isFocusable()=false`, `isFocused()=false`, `isVisible()=true`, `isAlwaysOnTop()=true`. Оговорка: окно с focusable:false не принимает ввод с клавиатуры (в т.ч. поля ввода внутри оверлея); клики мышью по нему не проверялись.

**Q2. `setContentProtection(true)` скрывает окно от захвата экрана?**
**Ответ: ДА**
**Факты:** desktopCapturer.getSources({types:['screen'], thumbnailSize:2560x1440}), пиксель в центре оверлея (300,250 в thumbnail), оверлей залит rgb(255,0,255). Без защиты: RGB = [255,0,255] (виден). С `setContentProtection(true)`: RGB = [25,26,28] (фон рабочего стола, оверлей отсутствует в захвате, окно не чёрный прямоугольник, а «прозрачное»). Проверен только захват через desktopCapturer (Chromium), не сторонний софт (Zoom/Teams/OBS).

**Q3. Системный звук (loopback) через getDisplayMedia + микрофон?**
**Ответ: ДА**
**Факты:** `session.defaultSession.setDisplayMediaRequestHandler((req,cb)=>cb({video: screenSource, audio:'loopback'}))` + `getDisplayMedia({audio:true, video:true})`: получен аудиотрек label "System audio", readyState "live", 1 видеотрек. Системой проигрывался тон 440 Гц (wav через System.Media.SoundPlayer): max RMS (AnalyserNode, 15 замеров по 100 мс) = 0.410 — звук есть. Видеотрек `stop()` + `removeTrack`: видеотреков 0, аудиотрек остаётся "live", RMS после = 0.120 (>0, тон продолжал играть). Микрофон: `getUserMedia({audio:true})` получен трек ("Default - … fifine SC8 Mic"), `enumerateDevices` audioinput = 7. ВАЖНО: на `data:` URL `navigator.mediaDevices` = undefined (небезопасный контекст) — первый прогон упал с `Cannot read properties of undefined (reading 'enumerateDevices')`; со страницей через `loadFile` (file://) работает. Dashboard-окно использовалось видимым (`showInactive`); для скрытого окна не проверялось.

**Q4. `node:sqlite` в main и `safeStorage`?**
**Ответ: ДА**
**Факты:** `process.versions.node` = 24.22.1; `require('node:sqlite').DatabaseSync(':memory:')` — create/insert/select работают, `sqlite_version()` = 3.53.4 (файловая БД не проверялась). `safeStorage.isEncryptionAvailable()` = true, encryptString/decryptString round-trip = true. В Electron 45 эти методы выдают deprecation-предупреждение: `'safeStorage.isEncryptionAvailable' is deprecated and will be removed. Please use 'safeStorage.isAsyncEncryptionAvailable' instead` (аналогично `encryptStringAsync`/`decryptStringAsync`).

**Q5. `globalShortcut` Control+Alt+Space и память?**
**Ответ: ДА**
**Факты:** `globalShortcut.register('Control+Alt+Space', …)` вернул true, `isRegistered` = true. Память (sum workingSetSize из `app.getAppMetrics()`, main + dashboard + overlay с минимальным HTML, через ~2 с после старта): Browser 173 MB, GPU 94 MB, Utility 46 MB, Tab 75 MB, Tab 64 MB; итого 452 MB (повторный прогон 439 MB). Замер до включения захвата/аудио.

**Следствие для плана:** Electron закрывает все пять рисков без Rust/MSVC; кириллица/OneDrive в пути не мешают. Idle-память ~440-450 MB по workingSet (включая общие страницы, суммарно завышена). UI с вводом внутри focusable:false оверлея работать не будет (нужен отдельный фокусируемый dashboard). Страницы с getDisplayMedia/getUserMedia должны грузиться из secure context (file://, не data:). safeStorage API в Electron 45 переходит на async-варианты.

## S2 — Локальный STT whisper.cpp
**Скрипты:** `C:\Users\mager\AppData\Local\Temp\claude\spike-whisper\scripts\bench.mjs` (Node, HTTP-клиент + замеры), `gen.ps1` + `texts.json` (SAPI TTS). Релиз: тег `b5454` (в `releases/latest` стоит `v1.9.5` БЕЗ ассетов; бинарники лежат в b5454).
**Ответ:** да (CPU работает; base ~0.6 с с фиксированным языком; CUDA на Blackwell работает и даёт 40-110 мс; auto-detect языка удваивает латентность на CPU)

**Факты:**
- **Q1.** `whisper-bin-x64.zip` (9 MB): `Release\whisper-server.exe` есть (726 KB) + `ggml-cpu-*.dll` (авто-выбор `alderlake`), `whisper.dll`, `ggml*.dll`, `whisper-cli.exe` и др. Старт и готовность за 0.27 с (base). Запуск: `whisper-server.exe -m ggml-base.bin --host 127.0.0.1 --port 8091 -t 6`. `POST /inference`, multipart: `file` (wav 16k mono), `response_format=json|verbose_json`, `language=auto|en|ru|uk`, также принимает `prompt` (поле запроса) — 200 OK. Прочие флаги: `--prompt`, `--carry-initial-prompt`, `-l`, `-nt`, `-ng`, `--vad -vm`, `-sns`, `-nlp`, `--convert` (нужен ffmpeg), `--inference-path`.
  - `json`: `{"text":" Let's schedule the meeting ...\n"}` — только текст.
  - `verbose_json`: `task, language ("russian"), duration, text, segments[], detected_language, detected_language_probability, language_probabilities{код:вероятность}`. Сегмент: `id, text, start, end, tokens[], words[{word,start,end,t_dtw,probability}], temperature, avg_logprob, no_speech_prob`. Т.е. есть пер-слово вероятности, avg_logprob, no_speech_prob и вероятности языков. Пример: ru -> `ru:0.988 en:0.004`; en -> `en:0.997`.
  - Артефакт: сегмент может резаться посреди слова ("...обсудим б" | "юджет проекта.") — в `text` появляется `\n` внутри слова.
- **Q2.** Аудио en.wav 4.1 с, 6 потоков, после прогрева, среднее из 5:

| Модель | CPU, language=en | CPU, language=auto | CUDA, en | CUDA, auto |
|---|---|---|---|---|
| base | **614 мс** (546-651) | 1180 мс | 40-58 мс | 49 мс |
| small | **1946 мс** (1917-1974) | 4162 мс | 83 мс | 104 мс |
| large-v3-turbo-q5_0 | 10296 мс | 21548 мс | 71 мс | 112 мс |

  base < 1.2 с: да только с фиксированным языком (auto = 1.18 с, на границе). small < 1.2 с: нет (1.9 с; auto 4.2 с). turbo-q5 на CPU непригоден (10 с). `language=auto` на CPU добавляет полный лишний проход (~+0.55 с base, ~+2.2 с small). Время зависит от длины аудио; для 6-с фраз на base ~1.1 с (auto), ~0.6-0.7 с (фикс.). Потоки: только `-t 6` (другие значения не сравнивались).
- **Q3.** SAPI-голоса: `Microsoft Irina Desktop ru-RU`, `Microsoft Zira Desktop en-US`. **Украинского голоса нет**; UA-тест = украинский текст, прочитанный Irina (русский акцент/фонетика) — ненадёжный тест, реальную UA-речь не проверяли. TTS-аудио чистое, без шума, поэтому реальное качество на живой речи/шуме ниже.
  Транскрипты (CPU, language=auto, кроме отмеченного):
  - EN «Let's schedule the meeting for Thursday afternoon and review the budget.»: base/small/turbo — дословно верно.
  - RU «Давайте назначим встречу на четверг после обеда и обсудим бюджет проекта.»: base, small — верно; turbo — верно (без точки).
  - UA (Irina, текст «...призначимо зустріч на четвер після обіду та обговоримо бюджет проєкту»): детектор говорит `russian` (0.914-0.999) -> мусор в base (`Давайте призначим озусстричный четверг слябду та обговарим обюджет-практу.`), small (`...Азустрыч на четвертвёртвь с лябду...`), turbo (`...азустрыч на четверг слябдута обговорим о бюджет прокту`). С `language=uk`: base `призначима зустріч на четверпсля обговоримо бюджет про кту`, small `призначимо зустріч на четвертвір після обдута обговаримо бюджет про кту`, turbo `призначимо зустріч на четверг слябду та обговоримо бюджет про КТУ.` — частично верно, лучше всех turbo. Без UA-голоса вывод по UA: нет достоверных данных.
  - Tech EN «We deploy PostgreSQL, FastAPI and Kubernetes to production.» без prompt: base `Fast API, and Cuba Ernets`; small `Cuba urnets`; turbo верно (`PostgreSQL, FastAPI, and Kubernetes`).
  - Tech RU «Мы развернули PostgreSQL, FastAPI и Kubernetes на продакшене.» без prompt: base `пост греско Ирл, фестопейку вернитесь на продакшины`; small `пост грязку и рыл, фистопейку, берните сно продакшены`; turbo `пост Грес Куэрл, Фестерпи и Кубернитис на продакшены` (все плохо).
  - **Prompt есть**: поле запроса `prompt` работает (и серверный `--prompt`). С `prompt="PostgreSQL, FastAPI, Kubernetes, Docker, gRPC."`: EN — все три модели верно (`PostgreSQL, FastAPI, and Kubernetes`). RU-фраза: base `PostgreSQL, FastAPI и куберните сна продакшены`; small `постgreSQL, FastAPI, Kubernetes, на продакшены`; turbo `постgreSQL, FastAPI и Kubernetes на продакшены` — термины в основном восстанавливаются, но склейки типа `постgreSQL` остаются. Prompt латентность не меняет заметно (+0..-5%).
- **Q4.** Да, стоит. `whisper-bin-win-cuda-12.4.0-x64.zip` = 685 MB (в нём `ggml-cuda.dll` 544 MB, `cublasLt64_12.dll` 452 MB, `cublas64_12.dll` 95 MB, `cudart64_12.dll`), скачался нормально, распаковка ок. Запуск на RTX 5070 Ti: лог `ggml_cuda_init: found 1 CUDA devices ... Device 0: NVIDIA GeForce RTX 5070 Ti, compute capability 12.0, VMM: yes`, `whisper_backend_init_gpu: found GPU device 0: CUDA0`, `CUDA0 total size = 147.37 MB` (base). Работает на GPU, без падения/фолбэка. Латентность см. таблицу выше (40-110 мс). **Но**: первый запуск каждой новой модели/типа ядер — долгий прогрев: base 26.9 с (первый запрос; затем 124-221 мс при повторных запусках), turbo-q5 13.2 с на первом запросе (запускался на CUDA один раз, повторный прогрев не проверяли). Драйвер 617.42; на момент теста другие процессы уже занимали 15065 из 16303 MiB VRAM, при этом модели загрузились и работали. Установка CUDA-пакета не требовалась (CUDA-рантайм DLL в zip). Распакованный размер CUDA-папки большой (~1.2 GB).
- **Q5.** Working set сервера (после прогона запросов), CPU: base 265 MB (peak 267, private 749); small 660 MB (peak 663, private 1147); turbo-q5 714 MB (peak 746, private 1241). CUDA: base 425-438 MB (peak 429-658); small 554 MB; turbo-q5 539 MB (peak 865).
- SHA256 моделей (HF, ggerganov/whisper.cpp): `ggml-base.bin` 147 951 465 B `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`; `ggml-small.bin` 487 601 967 B `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`; `ggml-large-v3-turbo-q5_0.bin` 574 041 195 B `394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2`.
- Все серверы остановлены (0 процессов whisper-server).

**Следствие для плана:**
- Sidecar `whisper-server.exe` как HTTP на 127.0.0.1 — рабочий вариант; сборку не нужно, Rust/cmake не нужны. Запинить тег `b5454` (latest release `v1.9.5` без бинарников).
- На CPU без GPU: base + фиксированный язык (~0.6 с на 4 с аудио); `language=auto` на CPU почти вдвое дороже -> язык лучше определять/задавать вне запроса (или детектить редко и кэшировать). small на CPU (~1.9 с) не укладывается в 1.2 с.
- С GPU (CUDA 12.4 пакет, 685 MB) Blackwell sm_120 работает: turbo-q5 на 4 с аудио ~70-110 мс даже с auto — лучшее качество (единственная модель, верно распознавшая EN tech-термины без prompt; на RU/UA заметно лучше base/small). Нужно учесть: долгий первый прогрев (13-27 с) -> делать фоновый warmup при старте приложения; размер дистрибутива +~700 MB, иметь CPU-фолбэк (отдельная папка с CPU-сборкой).
- `prompt` с глоссарием технических терминов нужен и работает, но на RU-фразах полностью проблему латиницы не решает.
- `verbose_json` даёт `language_probabilities`, `avg_logprob`, `no_speech_prob`, пер-слово `probability` — можно использовать для отсечки мусора/смены языка. Артефакт: сегмент может обрываться посреди слова.
- UA не проверен на реальной речи (нет UA-голоса SAPI); нужны живые образцы. Whisper по TTS-UA с русским акцентом определяет язык как `ru`; для UA нужен явный `language=uk`.
- Рекомендация по дефолту: CPU — `base`, `-t 6`, явный `-l <lang>`; GPU — `large-v3-turbo-q5_0`, `-t 6`, `--host 127.0.0.1`, `language=auto` допустим.