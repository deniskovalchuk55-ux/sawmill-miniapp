import { useState, useEffect } from 'react'
import { fetchAllData, calcAllWorkers, calcWorkerSalary } from './notion.js'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ── Твій Telegram ID (отримати у @userinfobot) ────────────
const OWNER_TG_ID = Number(import.meta.env.VITE_OWNER_TG_ID)

const C = {
  bg:'#0b1017', surface:'#111820', border:'rgba(56,189,248,0.12)',
  accent:'#38bdf8', gold:'#f59e0b', green:'#22c55e',
  red:'#f87171', muted:'#4a6070', text:'#e2f0f9', dim:'#6b8fa8',
  purple:'#a78bfa',
  w:['#38bdf8','#22c55e','#f59e0b','#a78bfa','#fb7185','#34d399'],
}
const fmt  = n => Math.round(n).toLocaleString('uk-UA')
const fmtH = n => Number(n).toFixed(1)

// ── КОМПОНЕНТИ ─────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
      <div style={{fontSize:40}}>🪵</div>
      <div style={{color:C.accent,fontSize:12,letterSpacing:3}}>ЗАВАНТАЖЕННЯ...</div>
      <style>{`@keyframes sl{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
      <div style={{width:140,height:2,background:C.border,borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:'35%',background:C.accent,borderRadius:2,animation:'sl 1s ease-in-out infinite'}}/>
      </div>
    </div>
  )
}

function ErrScreen({msg, onRetry}) {
  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:24}}>
      <div style={{fontSize:36}}>⚠️</div>
      <div style={{color:C.red,fontSize:14}}>Помилка підключення</div>
      <div style={{color:C.dim,fontSize:11,textAlign:'center',maxWidth:300,lineHeight:1.6}}>{msg}</div>
      <Btn onClick={onRetry}>Спробувати знову</Btn>
      <div style={{color:C.muted,fontSize:10,textAlign:'center',maxWidth:280,lineHeight:1.5}}>
        Перевір змінні оточення у Vercel:<br/>VITE_NOTION_TOKEN, VITE_DB_SHIFTS тощо
      </div>
    </div>
  )
}

function Btn({onClick,children,color=C.accent,small=false}) {
  return (
    <button onClick={onClick} style={{
      background:color,color:'#000',border:'none',borderRadius:8,
      padding:small?'6px 14px':'10px 24px',
      fontSize:small?11:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700,letterSpacing:1
    }}>{children}</button>
  )
}

function Card({children, topColor, style={}}) {
  return (
    <div style={{
      background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
      padding:'16px 18px', ...(topColor?{borderTop:`2px solid ${topColor}`}:{}), ...style
    }}>{children}</div>
  )
}

function Label({children}) {
  return <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>{children}</div>
}

function ProgBar({val,max,color}) {
  return (
    <div style={{height:5,borderRadius:3,background:`${color}22`,overflow:'hidden'}}>
      <div style={{height:'100%',width:`${Math.min(100,val/max*100)}%`,background:color,borderRadius:3,transition:'width .4s'}}/>
    </div>
  )
}

function SectionTitle({children}) {
  return <div style={{fontSize:10,color:C.accent,letterSpacing:2,textTransform:'uppercase',marginBottom:12}}>{children}</div>
}

function Row({label,value,color=C.text,bold=false}) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.border}`,fontSize:13}}>
      <span style={{color:C.dim}}>{label}</span>
      <span style={{color,fontWeight:bold?700:400}}>{value}</span>
    </div>
  )
}

const TTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null
  return (
    <div style={{background:'#1a2535',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:11}}>
      <div style={{color:C.accent,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{color:p.color||C.text}}>{p.name}: {fmt(p.value)} грн</div>)}
    </div>
  )
}

// ================================================================
// OWNER DASHBOARD
// ================================================================
function OwnerDashboard({allWorkers, onRefresh}) {
  const [detail, setDetail] = useState(null)

  const totalFOP     = allWorkers.reduce((s,w)=>s+w.finalPayout,0)
  const totalGross   = allWorkers.reduce((s,w)=>s+w.grossSalary,0)
  const totalDebts   = allWorkers.reduce((s,w)=>s+w.debtRemaining,0)
  const totalAdvance = allWorkers.reduce((s,w)=>s+w.totalAdvances,0)

  const chartData = allWorkers.map((w,i)=>({
    name: w.name.split(' ').slice(-1)[0], // прізвище
    base: w.earnHours + w.earnPacks,
    bonus: w.bonusLong+w.bonusSat+w.premium+w.manualBonuses,
    color: C.w[i%C.w.length],
  }))

  if (detail) return <WorkerDetail w={detail} onBack={()=>setDetail(null)} isOwner />

  return (
    <div style={{minHeight:'100vh',background:C.bg,paddingBottom:32}}>
      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.accent,letterSpacing:2}}>🪵 ПИЛОРАМА</div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:2}}>{new Date().toLocaleDateString('uk-UA',{month:'long',year:'numeric'}).toUpperCase()}</div>
        </div>
        <button onClick={onRefresh} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:8,padding:'6px 12px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>↻ Оновити</button>
      </div>

      <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
        {/* KPI */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {[
            {l:'До виплати',    v:fmt(totalFOP)+' грн',     c:C.accent},
            {l:'Нараховано',    v:fmt(totalGross)+' грн',   c:C.green},
            {l:'Виданих авансів',v:fmt(totalAdvance)+' грн',c:C.gold},
            {l:'Борги (залишок)',v:fmt(totalDebts)+' грн',  c:C.red},
          ].map((k,i)=>(
            <Card key={i} topColor={k.c}>
              <Label>{k.l}</Label>
              <div style={{fontSize:18,fontWeight:700,color:k.c}}>{k.v}</div>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card>
          <SectionTitle>НАРАХУВАННЯ ПО РОБІТНИКАХ</SectionTitle>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={chartData} barSize={14} margin={{left:-24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)"/>
              <XAxis dataKey="name" stroke={C.muted} fontSize={10}/>
              <YAxis stroke={C.muted} fontSize={9} tickFormatter={v=>`${v/1000}к`}/>
              <Tooltip content={<TTip/>}/>
              <Bar dataKey="base"  name="Ставка"  stackId="a" fill={C.accent}/>
              <Bar dataKey="bonus" name="Бонуси"  stackId="a" fill={C.gold} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:'flex',gap:12,marginTop:6,fontSize:10}}>
            {[['Ставка',C.accent],['Бонуси',C.gold]].map(([l,c])=>(
              <span key={l} style={{color:c}}>● {l}</span>
            ))}
          </div>
        </Card>

        {/* Workers list */}
        <Card>
          <SectionTitle>СПИСОК ПЕРСОНАЛУ</SectionTitle>
          {allWorkers.map((w,i)=>(
            <button key={w.tgId||i} onClick={()=>setDetail(w)}
              style={{width:'100%',background:'rgba(255,255,255,0.02)',border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:8,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <div>
                  <span style={{color:C.w[i%C.w.length],fontWeight:600,fontSize:13}}>{w.name}</span>
                  {w.type==='fixed' && <span style={{marginLeft:8,fontSize:10,color:C.purple,background:`${C.purple}22`,padding:'1px 6px',borderRadius:4}}>{w.role||'фікс.'}</span>}
                </div>
                <span style={{color:C.accent,fontWeight:700,fontSize:13}}>{fmt(w.finalPayout)} ₴</span>
              </div>
              {w.type==='shift' && (
                <>
                  <ProgBar val={w.workDays} max={21} color={C.w[i%C.w.length]}/>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:10,color:C.muted}}>
                    <span>{w.workDays} днів · {fmtH(w.totalHours)} год</span>
                    <span>{w.longDays} довгих · {w.totalPacks} пачок</span>
                  </div>
                </>
              )}
              {w.debtRemaining>0 && <div style={{marginTop:6,fontSize:10,color:C.red}}>⚠ Борг: {fmt(w.debtRemaining)} грн</div>}
            </button>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ================================================================
// WORKER DETAIL (власник дивиться деталі робітника)
// ================================================================
function WorkerDetail({w, onBack, isOwner=false}) {
  const hoursChart = (w.days||[]).map(d=>({
    day: d.date.slice(8),
    normal: d.hours < 10 ? d.hours : 0,
    long:   d.hours >= 10 ? d.hours : 0,
  }))

  return (
    <div style={{minHeight:'100vh',background:C.bg,paddingBottom:32}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={onBack} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>← Назад</button>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>{w.name}</div>
          <div style={{fontSize:10,color:C.muted}}>{w.type==='fixed'?(w.role||'Фіксована ставка'):'Погодинний + пачки'}</div>
        </div>
      </div>

      <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
        {/* Top cards */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <Card topColor={C.accent}>
            <Label>До виплати</Label>
            <div style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(w.finalPayout)} ₴</div>
          </Card>
          <Card topColor={C.green}>
            <Label>Нараховано</Label>
            <div style={{fontSize:18,fontWeight:700,color:C.green}}>{fmt(w.grossSalary)} ₴</div>
          </Card>
        </div>

        {/* Hours chart */}
        {hoursChart.length > 0 && (
          <Card>
            <SectionTitle>ГОДИНИ ПО ДНЯХ  🟡 = 10+ год</SectionTitle>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={hoursChart} barSize={12} margin={{left:-24}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)"/>
                <XAxis dataKey="day" stroke={C.muted} fontSize={9}/>
                <YAxis stroke={C.muted} fontSize={9} domain={[0,14]}/>
                <Tooltip formatter={v=>`${v} год`} contentStyle={{background:'#1a2535',border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
                <Bar dataKey="normal" name="Год." stackId="a" fill={C.accent}/>
                <Bar dataKey="long"   name="10+" stackId="a" fill={C.gold} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Progress */}
        {w.type==='shift' && (
          <Card>
            <SectionTitle>ПРОГРЕС</SectionTitle>
            {[
              {l:'Робочі дні', val:w.workDays, max:21, c:C.accent, s:`${w.workDays}/21`},
              {l:'Довгих днів (10+ год)', val:w.longDays, max:10, c:C.gold, s:`${w.longDays}/10`},
              {l:'Суботи', val:w.saturdays, max:4, c:C.purple, s:`${w.saturdays} шт`},
            ].map(p=>(
              <div key={p.l} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                  <span style={{color:C.dim}}>{p.l}</span>
                  <span style={{color:p.c,fontWeight:600}}>{p.s}</span>
                </div>
                <ProgBar val={p.val} max={p.max} color={p.c}/>
              </div>
            ))}
            <div style={{marginTop:4,fontSize:12,display:'flex',flexDirection:'column',gap:5}}>
              {!w.bonusActive
                ? <span style={{color:C.gold}}>⏳ До бонусів: ще {w.daysToBonus} дні</span>
                : <span style={{color:C.green}}>✅ Бонуси активні!</span>}
              {w.bonusActive && w.longDays<10
                ? <span style={{color:C.gold}}>⏳ До бонусу 10+ год: ще {w.longToBonus} днів</span>
                : w.bonusActive ? <span style={{color:C.green}}>✅ Бонус довгих днів!</span> : null}
              {w.daysToPremium>0
                ? <span style={{color:C.purple}}>🏆 До премії: ще {w.daysToPremium} дні</span>
                : <span style={{color:C.green}}>🏆 Премія нарахована!</span>}
            </div>
          </Card>
        )}

        {/* Breakdown */}
        <Card>
          <SectionTitle>РОЗБИВКА</SectionTitle>
          {w.type==='shift' && <>
            <Row label={`Погодинно (${fmtH(w.totalHours)} год × ${fmt(w.rateHour)} грн)`} value={`${fmt(w.earnHours)} грн`}/>
            <Row label={`Пачки (${w.totalPacks} × ${fmt(w.ratePack)} грн)`} value={`${fmt(w.earnPacks)} грн`}/>
            {w.bonusLong>0   && <Row label={`Бонус довгі дні (${w.longDays}×)`} value={`+${fmt(w.bonusLong)} грн`} color={C.gold}/>}
            {w.bonusSat>0    && <Row label={`Бонус суботи (${w.saturdays}×)`}   value={`+${fmt(w.bonusSat)} грн`}  color={C.gold}/>}
            {w.premium>0     && <Row label="Премія за 21 день"                   value={`+${fmt(w.premium)} грн`}   color={C.green}/>}
            {w.manualBonuses>0&&<Row label="Ручні премії"                        value={`+${fmt(w.manualBonuses)} грн`} color={C.green}/>}
          </>}
          {w.type==='fixed' && <Row label="Фіксована ставка" value={`${fmt(w.grossSalary)} грн`}/>}
          <Row label="Нараховано" value={`${fmt(w.grossSalary)} грн`} bold/>
          {w.totalAdvances>0 && <Row label="Аванси" value={`-${fmt(w.totalAdvances)} грн`} color={C.red}/>}
          {w.debtThisMonth>0 && <Row label="Виплата боргу" value={`-${fmt(w.debtThisMonth)} грн`} color={C.red}/>}
          <div style={{display:'flex',justifyContent:'space-between',paddingTop:12,fontSize:14}}>
            <span style={{color:C.muted,letterSpacing:1}}>ДО ВИПЛАТИ</span>
            <span style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(w.finalPayout)} ₴</span>
          </div>
          {w.debtRemaining>0 && (
            <div style={{marginTop:10,padding:'8px 12px',background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8,fontSize:12,color:C.red}}>
              ⚠ Залишок боргу: {fmt(w.debtRemaining)} грн
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ================================================================
// WORKER SELF VIEW
// ================================================================
function WorkerSelfView({tgId, data, onRefresh}) {
  const w = calcWorkerSalary(tgId, data)
  return <WorkerDetail w={w} onBack={()=>{}} isOwner={false}/>
}

// ================================================================
// MAIN APP
// ================================================================
export default function App() {
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [appData, setAppData] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [tgId,    setTgId]    = useState(null)

  async function load() {
    try {
      setLoading(true); setError(null)
      const tg   = window.Telegram?.WebApp
      tg?.ready(); tg?.expand()
      tg?.setHeaderColor('#0b1017')
      tg?.setBackgroundColor('#0b1017')

      const uid = tg?.initDataUnsafe?.user?.id || null
      setTgId(uid)
      setIsOwner(uid === OWNER_TG_ID)

      const data = await fetchAllData()
      const workers = calcAllWorkers(data)
      setAppData({ raw: data, workers })
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  if (loading)  return <Spinner/>
  if (error)    return <ErrScreen msg={error} onRetry={load}/>
  if (!appData) return null

  if (isOwner) {
    return <OwnerDashboard allWorkers={appData.workers} onRefresh={load}/>
  }
  return <WorkerSelfView tgId={tgId} data={appData.raw} onRefresh={load}/>
}
