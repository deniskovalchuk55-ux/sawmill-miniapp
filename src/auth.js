// ================================================================
// auth.js — перевірка доступу до Mini App
// ================================================================
// Логіка:
// 1. Відкрив Mini App → беремо TG ID з Telegram.WebApp
// 2. Перевіряємо чи є цей ID в базі "Персонал" або "Фіксована ставка"
// 3. Якщо є → пускаємо, якщо нема → екран "Немає доступу"
// ================================================================

const NOTION_API = 'https://api.notion.com/v1'

function headers() {
  return {
    'Authorization': `Bearer ${import.meta.env.VITE_NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  }
}

// Перевірити чи є TG ID в базі персоналу
export async function checkAccess(tgId) {
  if (!tgId) return { allowed: false, reason: 'no_tg_id' }

  // Шукаємо в обох базах паралельно
  const [staffRes, fixedRes] = await Promise.all([
    fetch(`${NOTION_API}/databases/${import.meta.env.VITE_DB_STAFF}/query`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        filter: { property: 'ID', number: { equals: tgId } },
        page_size: 1,
      })
    }),
    fetch(`${NOTION_API}/databases/${import.meta.env.VITE_DB_FIXED_STAFF}/query`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        filter: { property: 'ID', number: { equals: tgId } },
        page_size: 1,
      })
    }),
  ])

  const [staffData, fixedData] = await Promise.all([
    staffRes.json(),
    fixedRes.json(),
  ])

  const inStaff = staffData.results?.length > 0
  const inFixed = fixedData.results?.length > 0

  if (!inStaff && !inFixed) {
    return { allowed: false, reason: 'not_found' }
  }

  // Беремо дані про людину
  const record = inStaff
    ? staffData.results[0]
    : fixedData.results[0]

  const props = record.properties
  const name =
    props['ПІБ']?.rich_text?.[0]?.plain_text ||
    props['ПІБ']?.title?.[0]?.plain_text || ''

  return {
    allowed: true,
    type: inFixed ? 'fixed' : 'shift',
    name,
    tgId,
  }
}

// Екран відмови в доступі
export function AccessDeniedScreen({ tgId }) {
  const C = {
    bg: '#0b1017', red: '#f87171', dim: '#6b8fa8', muted: '#4a6070',
    border: 'rgba(56,189,248,0.12)', accent: '#38bdf8',
  }
  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ color: C.red, fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
        Доступ закрито
      </div>
      <div style={{
        color: C.dim, fontSize: 13, textAlign: 'center',
        maxWidth: 280, lineHeight: 1.7,
      }}>
        Тебе ще не додано до системи.<br/>
        Зверніться до власника.
      </div>
      {tgId && (
        <div style={{
          background: 'rgba(56,189,248,0.06)',
          border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 16px',
          fontSize: 11, color: C.muted, textAlign: 'center',
        }}>
          Твій Telegram ID:<br/>
          <span style={{ color: C.accent, fontSize: 14, fontWeight: 700 }}>{tgId}</span>
          <br/>
          <span style={{ fontSize: 10 }}>(надішли власнику для додавання)</span>
        </div>
      )}
    </div>
  )
}
