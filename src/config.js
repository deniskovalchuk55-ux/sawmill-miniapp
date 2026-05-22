// ============================================================
// НАЛАШТУВАННЯ — ЗАПОВНИ СВОЇ ДАНІ
// ============================================================

export const NOTION_TOKEN = import.meta.env.VITE_NOTION_TOKEN
// Отримати: notion.so → Settings → Integrations → New integration

export const NOTION_DB_ID = import.meta.env.VITE_NOTION_DB_ID
// Отримати: відкрий базу в Notion → URL виглядає так:
// notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
//            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ — це і є DB_ID

// ── НАЛАШТУВАННЯ ЗАРПЛАТИ ──────────────────────────────────
export const SALARY_CONFIG = {
  hourlyRate:       100,   // грн за годину
  bonusLongDay:     500,   // бонус за день 10+ год
  bonusSaturday:    500,   // бонус за суботу
  premiumAmount:    1500,  // премія за 21 роб. день
  minWorkDays:      19,    // мінімум для бонусів
  longDayHours:     10,    // год для "довгого дня"
  longDaysForBonus: 10,    // скільки довгих днів потрібно
  premiumDays:      21,    // днів для премії
}

// ── НАЗВИ ПОЛІВ В NOTION ───────────────────────────────────
// Має збігатись з назвами колонок у твоїй базі Notion!
export const NOTION_FIELDS = {
  workerName: 'Робітник',   // Text або Select
  date:       'Дата',       // Date
  hours:      'Години',     // Number
  telegramId: 'TG_ID',      // Number (chat_id робітника)
}
