// ================================================================
// forms.jsx — форми внесення годин і премій
// ================================================================
import { useState } from 'react'

const NOTION_API = 'https://api.notion.com/v1'
function headers() {
  return {
    'Authorization': `Bearer ${import.meta.env.VITE_NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  }
}

async function saveShift({ tgId, name, rateHour, ratePack, date, hours, packs }) {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      parent: { database_id: import.meta.env.VITE_DB_SHIFTS },
      properties: {
        'ПІБ':                       { title: [{ text: { content: name } }] },
        'ID':                        { number: tgId },
        'Дата':                      { date: { start: date } },
        'Години':                    { number: hours },
        'Кількість збитих пачок':    { number: packs },
        'Ставка в год.':             { number: rateHour },
        'Ставка за збиту пачку':     { number: ratePack },
        'Виробіток з годин':         { number: hours * rateHour },
        'Виробіток зі збитих пачок': { number: packs * ratePack },
      },
    }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e.message) }
}

async function saveBonus({ tgId, name, date, amount, reason }) {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      parent: { database_id: import.meta.env.VITE_DB_BONUSES },
      properties: {
        'ПІБ':         { title: [{ text: { content: name } }] },
        'ID':          { number: tgId },
        'Дата':        { date: { start: date } },
        'Сума премії': { number: amount },
        'Причина':     { rich_text: [{ text: { content: reason || '' } }] },
      },
    }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e.message) }
}

// ── Стилі ─────────────────────────────────────────────────
const C = {
  bg:'#0b1017', surface:'#111820', border:'rgba(56,189,248,0.12)',
  accent:'#38bdf8', gold:'#f59e0b', green:'#22c55e',
  red:'#f87171', muted:'#4a6070', text:'#e2f0f9', dim:'#6b8fa8',
}
const inp = {
  background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`,
  borderRadius:8, color:C.text, padding:'12px 14px', fontSize:16,
  fontFamily:'inherit', width:'100%', outline:'none', WebkitAppearance:'none',
}
const lbl = { fontSize:10, color:C.muted, letterSpacing:2, textTransform:'uppercase', marginBottom:6 }

function Sheet({ onClose, children }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end', zIndex:100 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'16px 16px 0 0', padding:'20px 20px 44px', width:'100%' }}>
        <div style={{ width:40, height:4, background:C.muted, borderRadius:2, margin:'0 auto 20px' }}/>
        {children}
      </div>
    </div>
  )
}

function SaveBtn({ loading, success, color=C.accent, label }) {
  return (
    <button type="submit" disabled={loading||success} style={{
      width:'100%', background:success?C.green:color, color:'#000',
      border:'none', borderRadius:10, padding:14, fontSize:14,
      fontWeight:700, cursor:loading?'wait':'pointer',
      fontFamily:'inherit', letterSpacing:1, marginTop:4,
      opacity:loading?0.7:1,
    }}>
      {loading ? 'Збереження...' : success ? '✓ Збережено!' : label}
    </button>
  )
}

// Тип зміни: годинна / пачки / змішана
const SHIFT_TYPES = [
  { key:'hours', label:'⏱ Години',        icon:'⏱' },
  { key:'packs', label:'📦 Пачки',         icon:'📦' },
  { key:'mixed', label:'⏱📦 Змішана',     icon:'⏱📦' },
]

// ================================================================
// ФОРМА ГОДИН
// ================================================================
export function HoursForm({ worker, allWorkers, isOwner, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0,10)
  const [selectedId, setSelectedId] = useState(worker.tgId)
  const [shiftType,  setShiftType]  = useState('hours')
  const [date,       setDate]       = useState(today)
  const [hours,      setHours]      = useState('')
  const [packs,      setPacks]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [error,      setError]      = useState(null)

  const sel = isOwner
    ? (allWorkers.find(w => w.tgId === Number(selectedId)) || worker)
    : worker

  const earnPreview = (
    (parseFloat(hours)||0) * (sel.rateHour||0) +
    (parseFloat(packs)||0) * (sel.ratePack||0)
  )

  async function handleSubmit(e) {
    e.preventDefault()
    const h = shiftType==='packs' ? 0 : parseFloat(hours)||0
    const p = shiftType==='hours' ? 0 : parseFloat(packs)||0
    if (h===0 && p===0) return
    try {
      setLoading(true); setError(null)
      await saveShift({ tgId:sel.tgId, name:sel.name, rateHour:sel.rateHour||0, ratePack:sel.ratePack||0, date, hours:h, packs:p })
      setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1400)
    } catch(e) { setError(e.message) }
    finally    { setLoading(false) }
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:20 }}>⏱ Внести зміну</div>
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Вибір робітника — тільки власник */}
        {isOwner && (
          <div>
            <div style={lbl}>РОБІТНИК</div>
            <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
              {allWorkers.filter(w=>w.type==='shift').map(w=>(
                <option key={w.tgId} value={w.tgId}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Тип зміни */}
        <div>
          <div style={lbl}>ТИП ЗМІНИ</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {SHIFT_TYPES.map(t => (
              <button key={t.key} type="button" onClick={()=>setShiftType(t.key)} style={{
                padding:'10px 6px', borderRadius:8, border:`1px solid ${shiftType===t.key?C.accent:C.border}`,
                background:shiftType===t.key?'rgba(56,189,248,0.1)':'transparent',
                color:shiftType===t.key?C.accent:C.dim, cursor:'pointer',
                fontSize:12, fontFamily:'inherit', fontWeight:shiftType===t.key?700:400,
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Дата */}
        <div>
          <div style={lbl}>ДАТА</div>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp}/>
        </div>

        {/* Години — показуємо якщо НЕ тільки пачки */}
        {shiftType !== 'packs' && (
          <div>
            <div style={lbl}>КІЛЬКІСТЬ ГОДИН</div>
            <input
              type="number" inputMode="decimal" step="0.5" min="0" max="24"
              value={hours} onChange={e=>setHours(e.target.value)}
              placeholder="напр. 8 або 8.5"
              style={inp}
            />
            {hours && sel.rateHour && (
              <div style={{ fontSize:11, color:C.accent, marginTop:4 }}>
                = {Math.round(parseFloat(hours)*sel.rateHour).toLocaleString('uk-UA')} грн
              </div>
            )}
          </div>
        )}

        {/* Пачки — показуємо якщо НЕ тільки години */}
        {shiftType !== 'hours' && (
          <div>
            <div style={lbl}>КІЛЬКІСТЬ ПАЧОК</div>
            <input
              type="number" inputMode="numeric" min="0"
              value={packs} onChange={e=>setPacks(e.target.value)}
              placeholder="напр. 12"
              style={inp}
            />
            {packs && sel.ratePack && (
              <div style={{ fontSize:11, color:C.gold, marginTop:4 }}>
                = {Math.round(parseFloat(packs)*sel.ratePack).toLocaleString('uk-UA')} грн
              </div>
            )}
          </div>
        )}

        {/* Прев'ю заробітку */}
        {earnPreview > 0 && (
          <div style={{ background:'rgba(34,197,94,0.08)', border:`1px solid rgba(34,197,94,0.2)`, borderRadius:10, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, color:C.dim }}>Заробіток за зміну</span>
            <span style={{ fontSize:18, fontWeight:700, color:C.green }}>
              {Math.round(earnPreview).toLocaleString('uk-UA')} грн
            </span>
          </div>
        )}

        {error && (
          <div style={{ color:C.red, fontSize:12, padding:'8px 12px', background:`${C.red}11`, borderRadius:8 }}>⚠ {error}</div>
        )}

        <SaveBtn loading={loading} success={success} color={C.accent} label="Зберегти зміну"/>
      </form>
    </Sheet>
  )
}

// ================================================================
// ФОРМА ПРЕМІЇ (тільки власник)
// ================================================================
export function BonusForm({ worker, allWorkers, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0,10)
  const [selectedId, setSelectedId] = useState(worker.tgId)
  const [date,       setDate]       = useState(today)
  const [amount,     setAmount]     = useState('')
  const [reason,     setReason]     = useState('')
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [error,      setError]      = useState(null)

  const sel = allWorkers.find(w => w.tgId === Number(selectedId)) || worker

  async function handleSubmit(e) {
    e.preventDefault()
    if (!amount) return
    try {
      setLoading(true); setError(null)
      await saveBonus({ tgId:sel.tgId, name:sel.name, date, amount:parseFloat(amount), reason })
      setSuccess(true)
      setTimeout(() => { onSaved(); onClose() }, 1400)
    } catch(e) { setError(e.message) }
    finally    { setLoading(false) }
  }

  // Швидкі суми
  const quickAmounts = [200, 300, 500, 1000]

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:20 }}>🏆 Нарахувати премію</div>
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Робітник */}
        <div>
          <div style={lbl}>РОБІТНИК</div>
          <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
            {allWorkers.map(w=>(
              <option key={w.tgId} value={w.tgId}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Дата */}
        <div>
          <div style={lbl}>ДАТА</div>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp}/>
        </div>

        {/* Сума */}
        <div>
          <div style={lbl}>СУМА ПРЕМІЇ (грн)</div>
          {/* Швидкі кнопки */}
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            {quickAmounts.map(a=>(
              <button key={a} type="button" onClick={()=>setAmount(String(a))} style={{
                flex:1, padding:'8px 0', borderRadius:8,
                border:`1px solid ${amount===String(a)?C.gold:C.border}`,
                background:amount===String(a)?'rgba(245,158,11,0.15)':'transparent',
                color:amount===String(a)?C.gold:C.dim,
                fontSize:12, cursor:'pointer', fontFamily:'inherit',
              }}>{a}</button>
            ))}
          </div>
          <input
            type="number" inputMode="numeric" min="0"
            value={amount} onChange={e=>setAmount(e.target.value)}
            placeholder="або введи вручну"
            style={inp}
          />
        </div>

        {/* Причина */}
        <div>
          <div style={lbl}>ПРИЧИНА (необов'язково)</div>
          <input
            type="text" value={reason} onChange={e=>setReason(e.target.value)}
            placeholder="напр. За перевиконання плану"
            style={inp}
          />
        </div>

        {/* Прев'ю */}
        {amount && (
          <div style={{ background:'rgba(245,158,11,0.08)', border:`1px solid rgba(245,158,11,0.2)`, borderRadius:10, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, color:C.dim }}>{sel.name}</span>
            <span style={{ fontSize:18, fontWeight:700, color:C.gold }}>
              +{parseFloat(amount).toLocaleString('uk-UA')} грн
            </span>
          </div>
        )}

        {error && (
          <div style={{ color:C.red, fontSize:12, padding:'8px 12px', background:`${C.red}11`, borderRadius:8 }}>⚠ {error}</div>
        )}

        <SaveBtn loading={loading} success={success} color={C.gold} label="Нарахувати премію"/>
      </form>
    </Sheet>
  )
}
