// ================================================================
// rates.js — зміна ставок через Notion API
// ================================================================

const NOTION_API = 'https://api.notion.com/v1'

function headers() {
  return {
    'Authorization': `Bearer ${import.meta.env.VITE_NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  }
}

// Знайти сторінку робітника в Notion по TG ID
async function findStaffPage(tgId) {
  const res = await fetch(
    `${NOTION_API}/databases/${import.meta.env.VITE_DB_STAFF}/query`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        filter: { property: 'ID', number: { equals: tgId } },
        page_size: 1,
      }),
    }
  )
  const data = await res.json()
  return data.results?.[0] || null
}

// Оновити ставки в Notion
export async function updateRates(tgId, { rateHour, ratePack }) {
  const page = await findStaffPage(tgId)
  if (!page) throw new Error(`Робітника з ID ${tgId} не знайдено`)

  const properties = {}
  if (rateHour !== undefined) {
    properties['Ставка в годину'] = { number: Number(rateHour) }
  }
  if (ratePack !== undefined) {
    properties['Ставка за пачку'] = { number: Number(ratePack) }
  }

  const res = await fetch(`${NOTION_API}/pages/${page.id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ properties }),
  })

  if (!res.ok) {
    const e = await res.json()
    throw new Error(`Notion: ${e.message}`)
  }
  return await res.json()
}

// ================================================================
// Компонент — модалка редагування ставок (тільки для власника)
// ================================================================
import { useState } from 'react'

const C = {
  bg: '#0b1017', surface: '#111820', border: 'rgba(56,189,248,0.12)',
  accent: '#38bdf8', gold: '#f59e0b', green: '#22c55e',
  red: '#f87171', muted: '#4a6070', text: '#e2f0f9', dim: '#6b8fa8',
}

export function RatesModal({ worker, onClose, onSaved }) {
  const [rateHour, setRateHour] = useState(worker.rateHour ?? '')
  const [ratePack, setRatePack] = useState(worker.ratePack ?? '')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)

  async function save() {
    try {
      setLoading(true); setError(null)
      await updateRates(worker.tgId, {
        rateHour: rateHour !== '' ? rateHour : undefined,
        ratePack: ratePack !== '' ? ratePack : undefined,
      })
      setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1200)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text,
    padding: '10px 14px', fontSize: 15,
    fontFamily: 'inherit', width: '100%',
    outline: 'none',
  }

  return (
    // Overlay
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100, padding: '0 0 0 0',
    }}>
      {/* Sheet */}
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: '16px 16px 0 0', padding: '24px 20px 36px',
        width: '100%', maxWidth: 480,
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: C.muted, borderRadius: 2, margin: '0 auto 20px' }} />

        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          ✏️ Ставки — {worker.name}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>
          TG ID: {worker.tgId}
        </div>

        {/* Rate hour */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>
            СТАВКА ЗА ГОДИНУ (грн)
          </div>
          <input
            type="number" value={rateHour}
            onChange={e => setRateHour(e.target.value)}
            placeholder={worker.rateHour ? `Зараз: ${worker.rateHour}` : 'Введи суму'}
            style={inputStyle}
          />
        </div>

        {/* Rate pack */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>
            СТАВКА ЗА ПАЧКУ (грн)
          </div>
          <input
            type="number" value={ratePack}
            onChange={e => setRatePack(e.target.value)}
            placeholder={worker.ratePack ? `Зараз: ${worker.ratePack}` : 'Введи суму'}
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{ color: C.red, fontSize: 12, marginBottom: 12, padding: '8px 12px', background: `${C.red}11`, borderRadius: 8 }}>
            ⚠ {error}
          </div>
        )}

        {success && (
          <div style={{ color: C.green, fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
            ✅ Ставки оновлено!
          </div>
        )}

        <button onClick={save} disabled={loading || success} style={{
          width: '100%', background: success ? C.green : C.accent,
          color: '#000', border: 'none', borderRadius: 10,
          padding: '14px', fontSize: 14, fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
          opacity: loading ? 0.7 : 1, letterSpacing: 1,
        }}>
          {loading ? 'Збереження...' : success ? '✓ Збережено' : 'Зберегти'}
        </button>
      </div>
    </div>
  )
}

// ================================================================
// Компонент — картка ставок для робітника (тільки перегляд)
// ================================================================
export function WorkerRatesCard({ rateHour, ratePack }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 12 }}>
        МОЇ СТАВКИ
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'rgba(56,189,248,0.06)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>ЗА ГОДИНУ</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.accent }}>{rateHour ?? '—'}</div>
          <div style={{ fontSize: 10, color: C.muted }}>грн / год</div>
        </div>
        <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>ЗА ПАЧКУ</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.gold }}>{ratePack ?? '—'}</div>
          <div style={{ fontSize: 10, color: C.muted }}>грн / пачка</div>
        </div>
      </div>
    </div>
  )
}
