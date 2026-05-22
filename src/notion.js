// ================================================================
// notion.js — підключення до всіх 7 баз Notion
// ================================================================

const NOTION_API = 'https://api.notion.com/v1'

function headers() {
  return {
    'Authorization': `Bearer ${import.meta.env.VITE_NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  }
}

// ── ID баз (вставити свої з Notion URL) ────────────────────────
export const DB = {
  shifts:       import.meta.env.VITE_DB_SHIFTS,       // Зміни
  staff:        import.meta.env.VITE_DB_STAFF,         // Персонал
  advances:     import.meta.env.VITE_DB_ADVANCES,      // Аванси
  bonuses:      import.meta.env.VITE_DB_BONUSES,       // Премії
  fixedStaff:   import.meta.env.VITE_DB_FIXED_STAFF,   // Фіксована ставка
  debts:        import.meta.env.VITE_DB_DEBTS,         // Борги
  debtPayments: import.meta.env.VITE_DB_DEBT_PAYMENTS, // Виплати боргів
}

// ── Базовий запит до Notion ────────────────────────────────────
async function queryDB(dbId, filter = null, sorts = null) {
  const body = { page_size: 100 }
  if (filter) body.filter = filter
  if (sorts)  body.sorts  = sorts

  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const e = await res.json()
    throw new Error(`Notion [${dbId?.slice(0,8)}]: ${e.message}`)
  }
  const data = await res.json()
  return data.results
}

// ── Хелпери для читання полів Notion ──────────────────────────
const prop = {
  text:   (p) => p?.rich_text?.[0]?.plain_text || p?.title?.[0]?.plain_text || '',
  num:    (p) => p?.number ?? 0,
  date:   (p) => p?.date?.start || '',
  select: (p) => p?.select?.name || '',
}

// ── Поточний місяць ────────────────────────────────────────────
function monthRange() {
  const now   = new Date()
  const start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const end   = new Date(now.getFullYear(), now.getMonth()+1, 0)
    .toISOString().slice(0,10)
  return { start, end }
}

function dateFilter(field) {
  const { start, end } = monthRange()
  return {
    and: [
      { property: field, date: { on_or_after:  start } },
      { property: field, date: { on_or_before: end   } },
    ]
  }
}

// ================================================================
// ЗАВАНТАЖЕННЯ ВСІХ ДАНИХ ПАРАЛЕЛЬНО (7 запитів одночасно)
// ================================================================
export async function fetchAllData() {
  const { start, end } = monthRange()

  const [shifts, staff, advances, bonuses, fixedStaff, debts, debtPayments] =
    await Promise.all([

      // 1. Зміни — тільки поточний місяць
      queryDB(DB.shifts, dateFilter('Дата')),

      // 2. Персонал — всі (ставки)
      queryDB(DB.staff),

      // 3. Аванси — поточний місяць
      queryDB(DB.advances, dateFilter('Дата')),

      // 4. Премії — поточний місяць
      queryDB(DB.bonuses, dateFilter('Дата')),

      // 5. Фіксована ставка — всі
      queryDB(DB.fixedStaff),

      // 6. Борги — активні (залишок > 0)
      queryDB(DB.debts, {
        property: 'Залишок боргу',
        number: { greater_than: 0 }
      }),

      // 7. Виплати боргів — поточний місяць
      queryDB(DB.debtPayments, dateFilter('Дата')),
    ])

  return {
    shifts:       parseShifts(shifts),
    staff:        parseStaff(staff),
    advances:     parseAdvances(advances),
    bonuses:      parseBonuses(bonuses),
    fixedStaff:   parseFixedStaff(fixedStaff),
    debts:        parseDebts(debts),
    debtPayments: parseDebtPayments(debtPayments),
  }
}

// ================================================================
// ПАРСЕРИ
// ================================================================

function parseShifts(rows) {
  return rows.map(r => {
    const p = r.properties
    return {
      id:         r.id,
      tgId:       prop.num(p['ID']),
      name:       prop.text(p['ПІБ']),
      date:       prop.date(p['Дата']),
      hours:      prop.num(p['Години']),
      packs:      prop.num(p['Кількість збитих пачок']),
      rateHour:   prop.num(p['Ставка в год.']),
      ratePack:   prop.num(p['Ставка за збиту пачку']),
      earnHours:  prop.num(p['Виробіток з годин']),
      earnPacks:  prop.num(p['Виробіток зі збитих пачок']),
    }
  }).filter(r => r.date)
}

function parseStaff(rows) {
  return rows.map(r => {
    const p = r.properties
    return {
      id:       r.id,
      tgId:     prop.num(p['ID']),
      name:     prop.text(p['ПІБ']),
      rateHour: prop.num(p['Ставка в годину']),
      ratePack: prop.num(p['Ставка за пачку']),
    }
  })
}

function parseAdvances(rows) {
  return rows.map(r => {
    const p = r.properties
    return {
      tgId:   prop.num(p['ID']),
      name:   prop.text(p['ПІБ']),
      date:   prop.date(p['Дата']),
      amount: prop.num(p['Сума авансу']),
    }
  })
}

function parseBonuses(rows) {
  return rows.map(r => {
    const p = r.properties
    return {
      tgId:   prop.num(p['ID']),
      name:   prop.text(p['ПІБ']),
      date:   prop.date(p['Дата']),
      amount: prop.num(p['Сума премії']),
    }
  })
}

function parseFixedStaff(rows) {
  return rows.map(r => {
    const p = r.properties
    return {
      tgId:   prop.num(p['ID']),
      name:   prop.text(p['ПІБ']),
      salary: prop.num(p['Фіксована зарплата']),
      role:   prop.text(p['Посада']),
    }
  })
}

function parseDebts(rows) {
  return rows.map(r => {
    const p = r.properties
    return {
      id:          r.id,
      tgId:        prop.num(p['ID']),
      name:        prop.text(p['ПІБ']),
      totalDebt:   prop.num(p['Сума боргу']),
      remaining:   prop.num(p['Залишок боргу']),
    }
  })
}

function parseDebtPayments(rows) {
  return rows.map(r => {
    const p = r.properties
    return {
      tgId:   prop.num(p['ID']),
      name:   prop.text(p['ПІБ']),
      date:   prop.date(p['Дата']),
      amount: prop.num(p['Сума виплати']),
    }
  })
}

// ================================================================
// РОЗРАХУНОК ЗАРПЛАТИ
// ================================================================

const CFG = {
  minDaysForBonus:  19,
  bonusLongDay:     500,   // грн — за день 10+ год
  bonusSaturday:    500,   // грн — за суботу
  premiumDays:      21,    // днів для премії
  premiumAmount:    1500,  // грн
  longDayHours:     10,
  longDaysNeeded:   10,
}

function isSat(d) { return new Date(d).getDay() === 6 }
function isSun(d) { return new Date(d).getDay() === 0 }

export function calcWorkerSalary(tgId, data) {
  const { shifts, staff, advances, bonuses, debts, debtPayments } = data

  // Ставки з таблиці Персонал
  const staffInfo = staff.find(s => s.tgId === tgId) || {}

  // Зміни цього місяця
  const myShifts = shifts.filter(s => s.tgId === tgId)

  // Групуємо по датах
  const dayMap = {}
  myShifts.forEach(s => {
    if (!dayMap[s.date]) dayMap[s.date] = { hours: 0, packs: 0 }
    dayMap[s.date].hours += s.hours
    dayMap[s.date].packs += s.packs
  })
  const days = Object.entries(dayMap).map(([date, v]) => ({ date, ...v }))

  // Базові показники
  const totalHours  = days.reduce((s, d) => s + d.hours, 0)
  const totalPacks  = days.reduce((s, d) => s + d.packs, 0)
  const workDays    = days.filter(d => !isSun(d.date)).length
  const longDays    = days.filter(d => d.hours >= CFG.longDayHours && !isSun(d.date)).length
  const saturdays   = days.filter(d => isSat(d.date)).length

  // Ставки (з таблиці зміни або персонал)
  const rateHour = myShifts[0]?.rateHour || staffInfo.rateHour || 0
  const ratePack = myShifts[0]?.ratePack || staffInfo.ratePack || 0

  // Заробіток
  const earnHours = totalHours * rateHour
  const earnPacks = totalPacks * ratePack
  const baseEarn  = earnHours + earnPacks

  // Бонуси (тільки якщо 19+ роб. днів)
  const bonusActive = workDays >= CFG.minDaysForBonus
  const bonusLong   = bonusActive && longDays >= CFG.longDaysNeeded
    ? longDays * CFG.bonusLongDay : 0
  const bonusSat    = bonusActive ? saturdays * CFG.bonusSaturday : 0
  const premium     = workDays >= CFG.premiumDays ? CFG.premiumAmount : 0

  // Ручні премії
  const manualBonuses = bonuses
    .filter(b => b.tgId === tgId)
    .reduce((s, b) => s + b.amount, 0)

  // Аванси
  const totalAdvances = advances
    .filter(a => a.tgId === tgId)
    .reduce((s, a) => s + a.amount, 0)

  // Борги (виплати цього місяця)
  const debtThisMonth = debtPayments
    .filter(p => p.tgId === tgId)
    .reduce((s, p) => s + p.amount, 0)

  // Залишок боргу
  const debtInfo = debts.find(d => d.tgId === tgId)
  const debtRemaining = debtInfo?.remaining || 0

  // ФІНАЛ
  const grossSalary = baseEarn + bonusLong + bonusSat + premium + manualBonuses
  const finalPayout = grossSalary - totalAdvances - debtThisMonth

  return {
    // Ідентифікація
    tgId, name: staffInfo.name || '',
    rateHour, ratePack,

    // Відпрацьовано
    totalHours, totalPacks, workDays, longDays, saturdays,
    days,

    // Нарахування
    earnHours, earnPacks, baseEarn,
    bonusActive,
    bonusLong, bonusSat, premium, manualBonuses,
    grossSalary,

    // Відрахування
    totalAdvances, debtThisMonth, debtRemaining,

    // Підсумок
    finalPayout,

    // До бонусів
    daysToBonus:   Math.max(0, CFG.minDaysForBonus - workDays),
    longToBonus:   bonusActive ? Math.max(0, CFG.longDaysNeeded - longDays) : CFG.longDaysNeeded,
    daysToPremium: Math.max(0, CFG.premiumDays - workDays),
  }
}

// Розрахунок для всіх робітників одразу
export function calcAllWorkers(data) {
  const { shifts, staff, fixedStaff } = data

  // Унікальні ID з таблиці зміни
  const activeIds = [...new Set(shifts.map(s => s.tgId).filter(Boolean))]

  const shiftWorkers = activeIds.map(tgId => ({
    type: 'shift',
    ...calcWorkerSalary(tgId, data),
    name: staff.find(s => s.tgId === tgId)?.name ||
          shifts.find(s => s.tgId === tgId)?.name || `ID ${tgId}`,
  }))

  const fixedWorkers = fixedStaff.map(w => ({
    type: 'fixed',
    tgId: w.tgId,
    name: w.name,
    role: w.role,
    grossSalary: w.salary,
    finalPayout: w.salary - (data.advances.filter(a=>a.tgId===w.tgId).reduce((s,a)=>s+a.amount,0)),
    totalAdvances: data.advances.filter(a=>a.tgId===w.tgId).reduce((s,a)=>s+a.amount,0),
    debtThisMonth: data.debtPayments.filter(p=>p.tgId===w.tgId).reduce((s,p)=>s+p.amount,0),
    debtRemaining: data.debts.find(d=>d.tgId===w.tgId)?.remaining || 0,
    // Порожні поля для сумісності
    totalHours:0, totalPacks:0, workDays:0, earnHours:0, earnPacks:0,
    bonusLong:0, bonusSat:0, premium:0, manualBonuses:0,
  }))

  return [...shiftWorkers, ...fixedWorkers]
}
