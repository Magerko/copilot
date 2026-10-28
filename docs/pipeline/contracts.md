# Контракты

Каноничная копия — `src/shared/types.ts`. Если файл и этот раздел расходятся, правда в коде, а расхождение — дефект документации.

## Процессы и модули
```
main (Node/Electron)
  session/        SessionManager, ConversationMachine, QuestionDetector, RequestCoordinator
  providers/      openai.ts, anthropic.ts, gemini.ts (OpenAI-compatible = openai.ts c baseUrl), router.ts
  asr/            WhisperSidecar (spawn whisper-server.exe), AsrManager (очередь, partial/final)
  context/        importers (txt/md/docx/pdf), chunker, bm25 retriever, prompt builder
  budget/         BudgetManager, pricing
  net/            NetGuard — единая точка исходящих запросов main + webRequest-фильтр renderer
  storage/        db.ts (node:sqlite, миграции), secrets.ts (safeStorage/DPAPI), settings.ts
  windows/        dashboard, overlay, region-picker, tray, shortcuts, displayProtection
renderer (React)
  dashboard/  onboarding/  settings/  overlay/  picker/
  audio/      capture.ts (mic getUserMedia, loopback getDisplayMedia), worklet (16 кГц mono PCM16), vad.ts
```
Renderer не ходит в сеть к провайдерам: все запросы идут через main → NetGuard. Ключи до renderer не доходят.

## Модели данных
```ts
type Source = 'user' | 'remote';
type Lang = 'ru' | 'uk' | 'en';

interface TranscriptSegment {
  sessionId: string; segmentId: string; source: Source;
  startMs: number; endMs: number;      // от начала сессии
  text: string; isFinal: boolean;
  lang: string | null;                 // только если ASR вернул язык
}

type UtteranceKind = 'question' | 'follow_up' | 'statement' | 'small_talk'
                   | 'coding_task' | 'screen_reference' | 'unknown';

type ConvState = 'idle' | 'listening' | 'partial_transcript' | 'question_candidate'
               | 'question_confirmed' | 'generating' | 'answer_ready' | 'superseded'
               | 'paused' | 'stopped' | 'error';

interface QuestionEvent {
  sessionId: string; questionId: string; revision: number; source: Source;
  text: string; startMs: number; endMs: number;
  kind: UtteranceKind;
  status: 'candidate' | 'confirmed' | 'superseded' | 'answered' | 'dismissed';
  supersedes: string | null;           // questionId предыдущего активного
  trigger: 'auto' | 'manual' | 'hotkey' | 'typed';
}

type AnswerKind = 'say' | 'points' | 'deep' | 'screen';
type ScreenTask = 'explain' | 'approach' | 'review';

interface AnswerEvent {
  sessionId: string; questionId: string; revision: number; answerId: string;
  kind: AnswerKind;
  provider: string; model: string; promptPreset: string;   // provenance
  text: string;
  status: 'streaming' | 'done' | 'cancelled' | 'error' | 'stale' | 'blocked';
  firstTokenMs: number | null; latencyMs: number | null;
  usage: { inputTokens: number; outputTokens: number; exact: boolean } | null;
  usageCostUsd: number | null;          // null = цена неизвестна, НЕ 0
  error: AppError | null;
}
```

## Провайдеры
```ts
type ProviderProtocol = 'openai' | 'anthropic' | 'gemini';   // OpenAI-compatible → 'openai'
type ProviderPreset = 'openai' | 'anthropic' | 'gemini' | 'anymodel' | 'ollama' | 'lmstudio' | 'custom';

interface ProviderConfig {
  id: string; label: string; preset: ProviderPreset; protocol: ProviderProtocol;
  baseUrl: string;                     // https:// или http://127.0.0.1|localhost
  hasKey: boolean;                     // сам ключ — только в secrets, id = `provider:${id}`
  allowFallback: boolean;              // можно ли использовать как fallback
  timeoutMs: number;                   // дефолт 12000 (первый токен)
}

type ModelRole = 'quick_answer' | 'deep_answer' | 'vision' | 'classification' | 'post_session_summary';
type RoleMap = Partial<Record<ModelRole, { providerId: string; model: string } | null>>;

interface ModelInfo { id: string; label?: string; vision: boolean | null }  // null = неизвестно

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; images?: { mime: string; base64: string }[] }
interface ChatRequest { model: string; messages: ChatMessage[]; maxTokens: number; temperature: number }
type StreamChunk = { type: 'text'; text: string } | { type: 'usage'; inputTokens: number; outputTokens: number };

interface ProviderAdapter {
  testConnection(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: AppError }>;
  listModels(): Promise<ModelInfo[]>;
  stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamChunk>;  // бросает ProviderError
}
```
Ретраи: 429/5xx/network — до 2 повторов с backoff 600 мс·2^n (уважая `retry-after` ≤ 5 с), только **до** первого токена. Fallback — только на провайдер с `allowFallback=true`, и сам переход показывается в UI.

## Ошибки
```ts
type ErrorCode = 'auth' | 'quota' | 'rate_limit' | 'server' | 'timeout' | 'network'
  | 'offline_blocked' | 'budget_blocked' | 'bad_request' | 'not_found' | 'cancelled'
  | 'unsupported' | 'asr_unavailable' | 'device_unavailable' | 'unknown';
interface AppError { code: ErrorCode; message: string /* ru, для пользователя */; detail?: string /* без секретов */; status?: number }
```
| HTTP / ситуация | code | UI |
|---|---|---|
| 401, 403 | auth | «Проверьте API-ключ» |
| 402, тело с `insufficient_quota`/`credit` | quota | «Закончился баланс или лимит» |
| 429 | rate_limit | backoff, затем «Слишком много запросов» |
| 5xx | server | ограниченный retry |
| нет первого токена за timeoutMs | timeout | «Отменить / fallback» |
| fetch failed | network | «Сеть недоступна» |
| Offline + не-loopback | offline_blocked | «Заблокировано офлайн-режимом» |
| лимит бюджета | budget_blocked | диалог подтверждения |

## Бюджет
```ts
interface BudgetLimits { perSessionUsd: number | null; perDayUsd: number | null; requestsPerMinute: number; maxConcurrent: number }
interface ModelPrice { inputPerMTok: number; outputPerMTok: number }   // вводит пользователь; local = 0
// pricing: Record<`${providerId}/${model}`, ModelPrice>
```
Цена неизвестна → стоимость `null`, денежный лимит для такой модели не считается, а UI предупреждает: «лимит $ не контролируется: цена неизвестна». Лимит достигнут → `budget_blocked`, разблокирует только явное «Продолжить» (флаг `overrideUntilUsd`).

## Хранилище (SQLite, `%APPDATA%/kairos-m/kairos.db`, WAL)
```sql
schema_version(version INTEGER)
sessions(id TEXT PK, started_at INTEGER, ended_at INTEGER, status TEXT /*active|ended|interrupted*/, profile_id TEXT, mode TEXT, title TEXT)
transcript_segments(id TEXT PK, session_id TEXT, source TEXT, start_ms INTEGER, end_ms INTEGER, text TEXT, lang TEXT)  -- только final
questions(id TEXT, revision INTEGER, session_id TEXT, source TEXT, text TEXT, kind TEXT, status TEXT, trigger TEXT, start_ms INTEGER, end_ms INTEGER, supersedes TEXT, created_at INTEGER, PRIMARY KEY(id, revision))
answers(id TEXT PK, session_id TEXT, question_id TEXT, revision INTEGER, kind TEXT, provider TEXT, model TEXT, preset TEXT, text TEXT, status TEXT, first_token_ms INTEGER, latency_ms INTEGER, input_tokens INTEGER, output_tokens INTEGER, cost_usd REAL, created_at INTEGER)
profiles(id TEXT PK, name TEXT, preset TEXT, style TEXT, answer_lang TEXT, extra TEXT /*json*/)
knowledge_documents(id TEXT PK, profile_id TEXT, name TEXT, kind TEXT /*cv|jd|notes*/, created_at INTEGER)
knowledge_chunks(id TEXT PK, document_id TEXT, ord INTEGER, section TEXT, text TEXT, trust TEXT /*user_provided|transcript|screen_capture|assistant_inferred*/)
usage_events(id TEXT PK, session_id TEXT, provider TEXT, model TEXT, at INTEGER, input_tokens INTEGER, output_tokens INTEGER, cost_usd REAL)
app_diagnostics(id INTEGER PK, at INTEGER, kind TEXT, data TEXT /*json, прогнан через redact()*/)
```
Индексы: `(session_id)` у всех дочерних, `(session_id, start_ms)` у сегментов, `usage_events(at)`. Удаление сессии стирает все дочерние строки в одной транзакции, затем `VACUUM` по запросу «Удалить всё».

Секреты: `%APPDATA%/kairos-m/secrets.bin` — JSON `{id: base64(safeStorage.encryptString(value))}`. Значения в логи не пишутся: `redact()` вырезает все известные секреты и паттерны `sk-…`, `AIza…`, `Bearer …`.

## Настройки (`settings.json`, без секретов)
| Параметр | Тип | Дефолт | Смысл |
|---|---|---|---|
| uiLang | 'ru'\|'uk'\|'en' | 'ru' | язык интерфейса |
| answerLang | 'auto'\|Lang | 'auto' | язык ответа (auto = язык вопроса) |
| offline | boolean | false | строгая блокировка не-loopback |
| autoAnswer | boolean | false | автогенерация на подтверждённый вопрос |
| asr.model | string | из S2 | ggml-модель |
| asr.language | 'auto'\|Lang | 'auto' | |
| asr.vocabulary | string[] | ['PostgreSQL','FastAPI','Kubernetes'] | initial prompt |
| audio.micDeviceId / loopback | string\|null / boolean | default / true | |
| contextWindowMin | number | 3 | окно транскрипта в промпте |
| overlay | {x,y,w,h,displayId,opacity,fontScale,expanded,theme,protect,clickThrough} | | сохраняется |
| shortcuts | Record<ShortcutAction,string> | см. ниже | |
| history | boolean | true | хранить историю |
| budget | BudgetLimits | {null,null,20,2} | |
| roles | RoleMap | {} | |
| consent | {mic,system,screen,cloud,history,acceptedAt} | все false | |

`ShortcutAction`: toggleOverlay `Ctrl+Alt+H`, toggleListen `Ctrl+Alt+L`, answerNow `Ctrl+Alt+Enter`, snapRegion `Ctrl+Alt+S`, scrollUp/Down `Ctrl+Alt+Up/Down`, expand `Ctrl+Alt+E`, panic `Ctrl+Alt+Backspace`.

## IPC (preload → `window.km`)
```ts
interface KmApi {
  getState(): Promise<AppSnapshot>; onState(cb: (s: AppSnapshot) => void): Unsub;
  settings: { get(): Promise<Settings>; patch(p: DeepPartial<Settings>): Promise<Settings> };
  providers: { list(); upsert(cfg, apiKey?: string); remove(id); test(id); models(id, refresh?: boolean) };
  session: { start(opts); stop(); pause(); resume(); answerNow(kind?: AnswerKind); askTyped(text);
             dismissCandidate(qid); confirmCandidate(qid); editQuestion(qid, text) };
  audio: { pushPcm(source: Source, pcm: ArrayBuffer /*Int16 16k mono*/, startMs: number, final: boolean); level(source, rms) };
  screen: { beginRegion(); submit(imageB64, task: ScreenTask, withCode: boolean); cancel() };
  knowledge: { import(profileId, filePath, kind); list(profileId); remove(docId) };
  history: { list(q?); get(id); remove(id); removeAll(); export(id, fmt: 'md' | 'json') };
  budget: { approveOverride() };
  diagnostics: { run(): Promise<DiagReport> };
  asr: { status(); downloadModel(name); }
}
```
`AppSnapshot` — единая модель для UI: состояние машины, активный вопрос + ревизия, кандидаты, активные ответы по kind, статусы Mic/System/ASR/LLM/Vision/Overlay/Protection, расход сессии, последние сегменты.

**Инвариант UI:** `snapshot.answers` содержит только ответы с `(questionId, revision) == activeQuestion`; чанки устаревших запросов отбрасываются в main до попадания в snapshot.

## Секреты и доступы
| Переменная | Что это | Где получить | Что при отсутствии |
|---|---|---|---|
| ключ провайдера (в UI) | API-ключ OpenAI/Anthropic/Gemini/AnyModel | кабинет провайдера | провайдер недоступен, Ollama работает без ключа |
| `KM_TEST_OPENAI_KEY` и т.п. (опц.) | для ручного smoke-теста | — | smoke-тест пропускается |

`.env*`, `node_modules`, `out`, `dist`, `resources/bin`, `*.db` — в `.gitignore`.
