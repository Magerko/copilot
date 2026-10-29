import type { UiLang } from '@shared/types'

let lang: UiLang = 'ru'
export function setLang(l: UiLang): void {
  lang = l
  document.documentElement.lang = l
}

// I use the Russian text as the key; missing translations fall back to it.
const DICT: Record<string, [uk: string, en: string]> = {
  'Продолжить прошлую сессию': ['Продовжити минулу сесію', 'Resume previous session'],
  Главная: ['Головна', 'Home'],
  Сессия: ['Сесія', 'Session'],
  История: ['Історія', 'History'],
  'Профиль и документы': ['Профіль і документи', 'Profile & documents'],
  Настройки: ['Налаштування', 'Settings'],
  'Начать сессию': ['Почати сесію', 'Start session'],
  Завершить: ['Завершити', 'Stop'],
  Пауза: ['Пауза', 'Pause'],
  Продолжить: ['Продовжити', 'Resume'],
  Ответить: ['Відповісти', 'Answer'],
  'Ответить сейчас': ['Відповісти зараз', 'Answer now'],
  Подробнее: ['Детальніше', 'Deep dive'],
  Тезисы: ['Тези', 'Talking points'],
  'Следующий вопрос': ['Наступне питання', 'Next question'],
  Развернуть: ['Розгорнути', 'Expand'],
  Свернуть: ['Згорнути', 'Collapse'],
  'Снимок экрана': ['Знімок екрана', 'Screenshot'],
  'Слушаю…': ['Слухаю…', 'Listening…'],
  'Пауза — захват остановлен': ['Пауза — захоплення зупинено', 'Paused — capture stopped'],
  'Сессия не запущена': ['Сесію не запущено', 'No active session'],
  'Возможный вопрос': ['Можливе питання', 'Possible question'],
  'Это вопрос': ['Це питання', 'It is a question'],
  Нет: ['Ні', 'No'],
  Вопрос: ['Питання', 'Question'],
  'Генерирую…': ['Генерую…', 'Generating…'],
  'Последние вопросы': ['Останні питання', 'Recent questions'],
  Код: ['Код', 'Code'],
  Микрофон: ['Мікрофон', 'Microphone'],
  'Звук собеседника': ['Звук співрозмовника', 'Remote audio'],
  Распознавание: ['Розпізнавання', 'Speech recognition'],
  'Модель ответов': ['Модель відповідей', 'Answer model'],
  Изображения: ['Зображення', 'Vision'],
  Оверлей: ['Оверлей', 'Overlay'],
  'Защита экрана': ['Захист екрана', 'Capture protection'],
  Сеть: ['Мережа', 'Network'],
  Тренировка: ['Тренування', 'Practice'],
  'Интервью / звонок': ['Інтерв’ю / дзвінок', 'Interview / call'],
  'Встреча (только транскрипт)': ['Зустріч (лише транскрипт)', 'Meeting (transcript only)'],
  'Что уходит провайдеру': ['Що йде провайдеру', 'What is sent to the provider'],
  'Последние сессии': ['Останні сесії', 'Recent sessions'],
  Далее: ['Далі', 'Next'],
  Назад: ['Назад', 'Back'],
  Пропустить: ['Пропустити', 'Skip'],
  Готово: ['Готово', 'Done'],
  'Задать вопрос текстом': ['Поставити питання текстом', 'Type a question'],
  Отправить: ['Надіслати', 'Send'],
  Отмена: ['Скасувати', 'Cancel'],
  'Аварийная остановка': ['Аварійна зупинка', 'Emergency stop'],
  'Цена неизвестна': ['Ціна невідома', 'Price unknown'],
  'Добро пожаловать в Copilot': ['Ласкаво просимо до Copilot', 'Welcome to Copilot'],
  Язык: ['Мова', 'Language'],
  Звук: ['Звук', 'Audio'],
  Модель: ['Модель', 'Model'],
  Профиль: ['Профіль', 'Profile'],
  Проверка: ['Перевірка', 'Self-test'],
  Согласие: ['Згода', 'Consent'],
  'Объясни условие': ['Поясни умову', 'Explain the task'],
  'Предложи подход': ['Запропонуй підхід', 'Suggest an approach'],
  'Разбери код': ['Розбери код', 'Review the code'],
  'с кодом': ['з кодом', 'with code'],
  'Размыть область': ['Розмити область', 'Blur area'],
  'Выделите область мышью. Esc — отмена.': ['Виділіть область мишею. Esc — скасувати.', 'Drag to select an area. Esc to cancel.']
}

export function t(ru: string): string {
  if (lang === 'ru') return ru
  const e = DICT[ru]
  if (!e) return ru
  return lang === 'uk' ? e[0] : e[1]
}
