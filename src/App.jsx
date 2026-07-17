import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// 1. CONFIGURAZIONE ADMIN E SCADENZE
// L'Admin (tu) è l'unico che vedrà i campi per inserire i risultati e il tasto Reset.
const ADMIN_EMAIL = 'andrea.milano2004@gmail.com' 

const DATA_LIMITE_ANDATA = new Date('2026-08-22T15:00:00')
const DATA_LIMITE_RITORNO = new Date('2027-01-16T14:00:00')

// 2. DIZIONARIO LOGHI SQUADRE (FotMob - 100% Affidabile)
const LOGHI_SQUADRE = {
  "Inter": "https://images.fotmob.com/image_resources/logo/teamlogo/8636.png",
  "Juventus": "https://images.fotmob.com/image_resources/logo/teamlogo/9885.png",
  "Milan": "https://images.fotmob.com/image_resources/logo/teamlogo/8564.png",
  "Napoli": "https://images.fotmob.com/image_resources/logo/teamlogo/9875.png",
  "Roma": "https://images.fotmob.com/image_resources/logo/teamlogo/8686.png",
  "Lazio": "https://images.fotmob.com/image_resources/logo/teamlogo/8543.png",
  "Atalanta": "https://images.fotmob.com/image_resources/logo/teamlogo/8524.png",
  "Fiorentina": "https://images.fotmob.com/image_resources/logo/teamlogo/8535.png",
  "Bologna": "https://images.fotmob.com/image_resources/logo/teamlogo/9857.png",
  "Torino": "https://images.fotmob.com/image_resources/logo/teamlogo/9804.png",
  "Genoa": "https://images.fotmob.com/image_resources/logo/teamlogo/10233.png",
  "Parma": "https://images.fotmob.com/image_resources/logo/teamlogo/10167.png",
  "Como": "https://images.fotmob.com/image_resources/logo/teamlogo/10171.png",
  "Venezia": "https://images.fotmob.com/image_resources/logo/teamlogo/7881.png",
  "Sassuolo": "https://images.fotmob.com/image_resources/logo/teamlogo/7943.png",
  "Frosinone": "https://images.fotmob.com/image_resources/logo/teamlogo/9891.png",
  "Monza": "https://images.fotmob.com/image_resources/logo/teamlogo/6504.png",
  "Udinese": "https://images.fotmob.com/image_resources/logo/teamlogo/8600.png",
  "Cagliari": "https://images.fotmob.com/image_resources/logo/teamlogo/8529.png",
  "Lecce": "https://images.fotmob.com/image_resources/logo/teamlogo/9888.png",
  "Empoli": "https://images.fotmob.com/image_resources/logo/teamlogo/8534.png",
  "Hellas Verona": "https://images.fotmob.com/image_resources/logo/teamlogo/9876.png"
}

const LogoSquadra = ({ squadra }) => {
  const [error, setError] = useState(false)
  const url = LOGHI_SQUADRE[squadra]
  
  if (!url || error) {
    return <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase shrink-0 shadow-inner">{squadra.substring(0,3)}</div>
  }
  return <img src={url} alt={squadra} onError={() => setError(true)} className="w-7 h-7 object-contain shrink-0 drop-shadow-md" />
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nomeReg, setNomeReg] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [authError, setAuthError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  const [activeTab, setActiveTab] = useState('pronostici')

  const [profili, setProfili] = useState([])
  const [partite, setPartite] = useState([])
  const [tuttiPronostici, setTuttiPronostici] = useState([])
  
  const [isAndataScaduta, setIsAndataScaduta] = useState(false)
  const [isRitornoScaduto, setIsRitornoScaduto] = useState(false)

  const [faseAttiva, setFaseAttiva] = useState('andata')
  const [giornataAttiva, setGiornataAttiva] = useState(1)
  const [utenteSelezionato, setUtenteSelezionato] = useState(null)
  
  const [tipoClassificaSerieA, setTipoClassificaSerieA] = useState('reale')
  const [tipoClassificaFantagioco, setTipoClassificaFantagioco] = useState('generale')

  const isAdmin = session?.user?.email === ADMIN_EMAIL

  useEffect(() => {
    const checkTime = () => {
      const now = new Date()
      setIsAndataScaduta(now > DATA_LIMITE_ANDATA)
      setIsRitornoScaduto(now > DATA_LIMITE_RITORNO)
    }
    checkTime()
    const interval = setInterval(checkTime, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) caricaDatiGlobali()
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) caricaDatiGlobali()
    })
    return () => subscription.unsubscribe()
  }, [])

  const caricaDatiGlobali = async () => {
    setLoading(true)
    try {
      const [resProfili, resPartite, resPronostici] = await Promise.all([
        supabase.from('profili').select('*'),
        supabase.from('partite').select('*').order('giornata', { ascending: true }).order('id', { ascending: true }),
        supabase.from('pronostici').select('*')
      ])

      setProfili(resProfili.data || [])
      setPartite(resPartite.data || [])
      setTuttiPronostici(resPronostici.data || [])
    } catch (error) {
      console.error("Errore:", error.message)
    } finally {
      setLoading(false)
    }
  }

  // --- FANTAGIOCO PUNTI ---
  const calcolaSegnoReale = (golCasa, golTrasferta) => {
    if (golCasa === null || golTrasferta === null) return null
    if (golCasa > golTrasferta) return '1'
    if (golCasa < golTrasferta) return '2'
    return 'X'
  }

  const calcolaPuntiPartita = (partita, pronostico) => {
    let punti = 0
    if (!pronostico) return punti
    const segnoReale = calcolaSegnoReale(partita.gol_casa, partita.gol_trasferta)
    
    if (segnoReale && pronostico.pronostico_1x2 === segnoReale) {
      punti += 1
      if (partita.is_inter && pronostico.gol_casa_pronostico === partita.gol_casa && pronostico.gol_trasferta_pronostico === partita.gol_trasferta) {
        punti += 3
      }
    }
    return punti
  }

  const calcolaClassificaGenerale = () => {
    return profili.map(profilo => {
      let puntiTotali = 0
      const pronosticiUtente = tuttiPronostici.filter(p => p.profilo_id === profilo.id)
      pronosticiUtente.forEach(pronostico => {
        const partita = partite.find(p => p.id === pronostico.partita_id)
        if (partita) puntiTotali += calcolaPuntiPartita(partita, pronostico)
      })
      return { ...profilo, punti: puntiTotali }
    }).sort((a, b) => b.punti - a.punti)
  }

  const calcolaClassificaGiornata = (giornata) => {
    const partiteDelTurno = partite.filter(p => p.giornata === giornata)
    return profili.map(profilo => {
      let punti = 0
      const pronosticiUtente = tuttiPronostici.filter(p => p.profilo_id === profilo.id)
      pronosticiUtente.forEach(pronostico => {
        const partita = partiteDelTurno.find(p => p.id === pronostico.partita_id)
        if (partita) punti += calcolaPuntiPartita(partita, pronostico)
      })
      return { ...profilo, punti }
    }).sort((a, b) => b.punti - a.punti)
  }

  // --- CLASSIFICA SERIE A ---
  const calcolaClassificaSerieA = () => {
    const squadre = {}
    partite.forEach(p => {
      if (!squadre[p.squadra_casa]) squadre[p.squadra_casa] = { nome: p.squadra_casa, punti: 0, gf: 0, gs: 0 }
      if (!squadre[p.squadra_trasferta]) squadre[p.squadra_trasferta] = { nome: p.squadra_trasferta, punti: 0, gf: 0, gs: 0 }
    })

    const isCampionatoFinito = partite.length === 380 && partite.every(p => p.gol_casa !== null)

    partite.forEach(partita => {
      const casa = partita.squadra_casa
      const trasf = partita.squadra_trasferta

      if (tipoClassificaSerieA === 'reale') {
        if (partita.gol_casa !== null && partita.gol_trasferta !== null) {
          squadre[casa].gf += partita.gol_casa
          squadre[casa].gs += partita.gol_trasferta
          squadre[trasf].gf += partita.gol_trasferta
          squadre[trasf].gs += partita.gol_casa
          
          if (partita.gol_casa > partita.gol_trasferta) squadre[casa].punti += 3
          else if (partita.gol_casa < partita.gol_trasferta) squadre[trasf].punti += 3
          else { squadre[casa].punti += 1; squadre[trasf].punti += 1 }
        }
      } else {
        const pronostico = tuttiPronostici.find(p => p.partita_id === partita.id && p.profilo_id === session?.user?.id)
        if (pronostico && pronostico.pronostico_1x2) {
          if (pronostico.pronostico_1x2 === '1') squadre[casa].punti += 3
          else if (pronostico.pronostico_1x2 === '2') squadre[trasf].punti += 3
          else if (pronostico.pronostico_1x2 === 'X') { squadre[casa].punti += 1; squadre[trasf].punti += 1 }
          
          if (partita.is_inter && pronostico.gol_casa_pronostico !== null && pronostico.gol_trasferta_pronostico !== null) {
            squadre[casa].gf += pronostico.gol_casa_pronostico
            squadre[casa].gs += pronostico.gol_trasferta_pronostico
            squadre[trasf].gf += pronostico.gol_trasferta_pronostico
            squadre[trasf].gs += pronostico.gol_casa_pronostico
          }
        }
      }
    })

    return Object.values(squadre).sort((a, b) => {
      if (b.punti !== a.punti) return b.punti - a.punti 
      if (isCampionatoFinito && tipoClassificaSerieA === 'reale') {
        const scontriDiretti = partite.filter(p => 
          (p.squadra_casa === a.nome && p.squadra_trasferta === b.nome) || 
          (p.squadra_casa === b.nome && p.squadra_trasferta === a.nome)
        )
        let ptsA = 0, ptsB = 0, gfA = 0, gfB = 0;
        scontriDiretti.forEach(m => {
          if (m.gol_casa !== null && m.gol_trasferta !== null) {
            if (m.squadra_casa === a.nome) {
              gfA += m.gol_casa; gfB += m.gol_trasferta;
              if (m.gol_casa > m.gol_trasferta) ptsA += 3;
              else if (m.gol_casa < m.gol_trasferta) ptsB += 3;
              else { ptsA++; ptsB++; }
            } else {
              gfA += m.gol_trasferta; gfB += m.gol_casa;
              if (m.gol_trasferta > m.gol_casa) ptsA += 3;
              else if (m.gol_trasferta < m.gol_casa) ptsB += 3;
              else { ptsA++; ptsB++; }
            }
          }
        })

        if (ptsB !== ptsA) return ptsB - ptsA
        const gdA = gfA - gfB
        const gdB = gfB - gfA
        if (gdB !== gdA) return gdB - gdA
      }
      const diffA = a.gf - a.gs
      const diffB = b.gf - b.gs
      if (diffB !== diffA) return diffB - diffA
      return b.gf - a.gf 
    })
  }

  // --- AZIONI DATABASE ---
  const salvaPronostico = async (partitaId, valore1X2, golCasa = null, golTrasferta = null) => {
    const partita = partite.find(p => p.id === partitaId)
    const isScaduta = partita.giornata <= 19 ? isAndataScaduta : isRitornoScaduto
    if (isScaduta) return

    const userId = session.user.id
    const pronEsistente = tuttiPronostici.find(p => p.partita_id === partitaId && p.profilo_id === userId) || {}
    
    const nuovoPronostico = {
      profilo_id: userId,
      partita_id: partitaId,
      pronostico_1x2: valore1X2 !== undefined ? valore1X2 : pronEsistente.pronostico_1x2,
      gol_casa_pronostico: golCasa !== null ? (golCasa === '' ? null : parseInt(golCasa)) : pronEsistente.gol_casa_pronostico,
      gol_trasferta_pronostico: golTrasferta !== null ? (golTrasferta === '' ? null : parseInt(golTrasferta)) : pronEsistente.gol_trasferta_pronostico,
    }

    setTuttiPronostici(prev => [...prev.filter(p => !(p.partita_id === partitaId && p.profilo_id === userId)), nuovoPronostico])
    await supabase.from('pronostici').upsert(nuovoPronostico, { onConflict: 'profilo_id, partita_id' })
  }

  const salvaRisultatoReale = async (partitaId, golCasa, golTrasferta) => {
    if (!isAdmin) return
    // Supporto per cancellazione (gestisce stringhe vuote o annullamenti)
    const gc = (golCasa === '' || golCasa === null) ? null : parseInt(golCasa)
    const gt = (golTrasferta === '' || golTrasferta === null) ? null : parseInt(golTrasferta)

    setPartite(prev => prev.map(p => p.id === partitaId ? { ...p, gol_casa: gc, gol_trasferta: gt } : p))
    await supabase.from('partite').update({ gol_casa: gc, gol_trasferta: gt }).eq('id', partitaId)
  }

  // --- RENDER COMPONENTI UI ---
  const renderSelettoreGiornate = () => {
    const giornate = faseAttiva === 'andata' ? Array.from({length: 19}, (_, i) => i + 1) : Array.from({length: 19}, (_, i) => i + 20)
    return (
      <div className="mb-4">
        <div className="flex bg-slate-900 rounded-lg p-1 mb-3 border border-slate-800">
          <button onClick={() => { setFaseAttiva('andata'); setGiornataAttiva(1); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${faseAttiva === 'andata' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400'}`}>Andata (1-19)</button>
          <button onClick={() => { setFaseAttiva('ritorno'); setGiornataAttiva(20); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${faseAttiva === 'ritorno' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400'}`}>Ritorno (20-38)</button>
        </div>
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
          {giornate.map(g => (
            <button key={g} onClick={() => setGiornataAttiva(g)} className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border transition-all ${giornataAttiva === g ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{g}</button>
          ))}
        </div>
      </div>
    )
  }

  const renderPartitaCard = (partita, utenteTargetId, isRisultatiReali = false) => {
    const pronostico = tuttiPronostici.find(p => p.partita_id === partita.id && p.profilo_id === utenteTargetId) || {}
    const isMioProfilo = utenteTargetId === session?.user?.id
    const segnoReale = calcolaSegnoReale(partita.gol_casa, partita.gol_trasferta)
    const puntiOttenuti = calcolaPuntiPartita(partita, pronostico)
    const isGiocata = partita.gol_casa !== null
    const isScaduta = partita.giornata <= 19 ? isAndataScaduta : isRitornoScaduto

    return (
      <div key={partita.id} className={`bg-slate-900 border ${partita.is_inter ? 'border-yellow-500/30' : 'border-slate-800'} p-4 rounded-2xl shadow-xl mb-4 relative`}>
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Giornata {partita.giornata}</span>
          {partita.is_inter && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-bold px-2 py-0.5 rounded-full">Speciale Inter</span>}
        </div>

        {isRisultatiReali ? (
          <div className="flex justify-between items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800/50">
            <div className="flex items-center gap-3 w-[35%]"><LogoSquadra squadra={partita.squadra_casa}/><span className="font-bold text-sm text-slate-200 truncate">{partita.squadra_casa}</span></div>
            
            {isAdmin ? (
              <div className="flex flex-col items-center justify-center w-[30%] gap-1">
                <div className="flex gap-2 items-center justify-center w-full">
                  <input type="number" min="0" value={partita.gol_casa ?? ''} onChange={(e) => salvaRisultatoReale(partita.id, e.target.value, partita.gol_trasferta)} className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center font-bold text-slate-100" />
                  <span className="text-slate-500">-</span>
                  <input type="number" min="0" value={partita.gol_trasferta ?? ''} onChange={(e) => salvaRisultatoReale(partita.id, partita.gol_casa, e.target.value)} className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center font-bold text-slate-100" />
                </div>
                {/* TASTO RESET PER ADMIN */}
                {isGiocata && (
                  <button onClick={() => salvaRisultatoReale(partita.id, '', '')} className="text-[9px] mt-1 font-bold bg-red-500/10 text-red-500 px-2 py-1 rounded border border-red-500/20 uppercase tracking-wider transition-all hover:bg-red-500/20">
                    Reset
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-3 items-center justify-center w-[30%] bg-slate-900 border border-slate-700/50 py-1.5 px-3 rounded-lg shadow-inner">
                <span className="text-lg font-extrabold text-emerald-400">{partita.gol_casa !== null ? partita.gol_casa : '-'}</span>
                <span className="text-slate-500 font-bold">:</span>
                <span className="text-lg font-extrabold text-emerald-400">{partita.gol_trasferta !== null ? partita.gol_trasferta : '-'}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 w-[35%]"><span className="font-bold text-sm text-slate-200 truncate text-right">{partita.squadra_trasferta}</span><LogoSquadra squadra={partita.squadra_trasferta}/></div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 w-[35%]"><LogoSquadra squadra={partita.squadra_casa}/><span className="font-bold text-xs sm:text-sm text-slate-200 truncate">{partita.squadra_casa}</span></div>
              
              <div className="flex gap-1.5 justify-center w-[30%]">
                {['1', 'X', '2'].map((v) => {
                  const isSelected = pronostico.pronostico_1x2 === v
                  const isEsatto = isGiocata && segnoReale === v && isSelected
                  const isSbagliato = isGiocata && segnoReale !== v && isSelected

                  return (
                    <button
                      key={v} disabled={isScaduta || !isMioProfilo}
                      onClick={() => salvaPronostico(partita.id, v)}
                      className={`w-9 h-9 rounded-lg font-bold text-sm flex items-center justify-center
                        ${isSelected && !isGiocata ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950' : ''}
                        ${!isSelected && !isGiocata ? 'bg-slate-950 border border-slate-800 text-slate-400' : ''}
                        ${isEsatto ? 'bg-green-500 text-white' : ''}
                        ${isSbagliato ? 'bg-red-500 text-white' : ''}
                        ${isGiocata && !isSelected ? 'bg-slate-950/50 border border-slate-800/30 text-slate-600 opacity-40' : ''}
                        ${isScaduta && !isGiocata && !isSelected ? 'opacity-40 cursor-not-allowed' : ''}
                      `}
                    >{v}</button>
                  )
                })}
              </div>

              <div className="flex items-center justify-end gap-2 w-[35%]"><span className="font-bold text-xs sm:text-sm text-slate-200 truncate text-right">{partita.squadra_trasferta}</span><LogoSquadra squadra={partita.squadra_trasferta}/></div>
            </div>

            {partita.is_inter && (
              <div className="mt-4 pt-3.5 border-t border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 text-center">Risultato Esatto (Bonus)</p>
                <div className="flex justify-center gap-3 items-center">
                  <input type="number" min="0" disabled={isScaduta || !isMioProfilo} value={pronostico.gol_casa_pronostico ?? ''} onChange={(e) => salvaPronostico(partita.id, undefined, e.target.value, null)} className="w-12 h-10 bg-slate-950 border border-slate-800 rounded-lg text-center font-bold text-sm text-slate-200 disabled:opacity-50" />
                  <span className="font-bold text-slate-600">-</span>
                  <input type="number" min="0" disabled={isScaduta || !isMioProfilo} value={pronostico.gol_trasferta_pronostico ?? ''} onChange={(e) => salvaPronostico(partita.id, undefined, null, e.target.value)} className="w-12 h-10 bg-slate-950 border border-slate-800 rounded-lg text-center font-bold text-sm text-slate-200 disabled:opacity-50" />
                </div>
              </div>
            )}
            
            {isGiocata && (
               <div className="absolute top-0 right-0 bg-slate-950 border-b border-l border-slate-800 rounded-bl-xl px-3 py-1">
                 <span className={`text-xs font-bold ${puntiOttenuti > 0 ? 'text-green-400' : 'text-slate-500'}`}>{puntiOttenuti > 0 ? `+${puntiOttenuti} pt` : '0 pt'}</span>
               </div>
            )}
          </>
        )}
      </div>
    )
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError(''); setLoading(true)
    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { nome: nomeReg } } })
      if (error) setAuthError(error.message)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error.message)
    }
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500"></div></div>
  if (!session) return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative">
            <h1 className="text-3xl font-extrabold text-center bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent mb-8">FantaSerieA</h1>
            {authError && <div className="bg-red-950/50 text-red-200 text-xs p-3 rounded-xl mb-6 text-center">{authError}</div>}
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegistering && <input type="text" required value={nomeReg} onChange={(e) => setNomeReg(e.target.value)} placeholder="Tuo Nome" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none text-white" />}
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none text-white" />
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Password" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-10 text-sm outline-none text-white" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? (
                    // Icona "Occhio Sbarrato" (Nascondi)
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    // Icona "Occhio Aperto" (Mostra)
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>              <button type="submit" className="w-full bg-emerald-500 text-slate-950 font-bold p-3.5 rounded-xl text-sm">{isRegistering ? 'Registrati' : 'Accedi'}</button>
            </form>
            <div className="mt-6 text-center"><button onClick={() => setIsRegistering(!isRegistering)} className="text-xs text-slate-400 underline">{isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}</button></div>
        </div>
      </div>
  )

  const partiteGiornata = partite.filter(p => p.giornata === giornataAttiva)
  const isGiornataConclusa = partiteGiornata.length > 0 && partiteGiornata.every(p => p.gol_casa !== null)
  
  const classificaGenerale = calcolaClassificaGenerale()
  const classificaGiornata = calcolaClassificaGiornata(giornataAttiva)
  const classificaSerieA = calcolaClassificaSerieA()
  
  const scadutaAttuale = faseAttiva === 'andata' ? isAndataScaduta : isRitornoScaduto

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20 flex justify-between items-center shadow-md">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">FantaSerieA</h1>
          <span className="text-[9px] text-slate-400 font-mono">LIMITE A: 22/08 | R: 16/01</span>
        </div>
        
        <div className="flex items-center gap-3">
          {scadutaAttuale ? (
            <span className="bg-red-500/10 text-red-400 text-xs px-2.5 py-1 rounded-full border border-red-500/20 font-bold">Chiuso</span>
          ) : (
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">Aperto</span>
          )}
          {/* Nuovo bottone Logout */}
          <button onClick={handleLogout} className="text-[10px] bg-slate-800 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 font-bold transition-all">
            Esci
          </button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'pronostici' && (
          <section className="animate-fade-in">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">I Miei Pronostici</h2>
            {renderSelettoreGiornate()}
            <div className="mt-2">
              {partiteGiornata.map(p => renderPartitaCard(p, session.user.id, false))}
            </div>
          </section>
        )}

        {activeTab === 'risultati' && (
          <section className="animate-fade-in">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Risultati Reali</h2>
            {!isAdmin && <p className="text-xs text-emerald-400 mb-4 bg-emerald-950/30 p-2 rounded border border-emerald-900">Guarda i risultati ufficiali in tempo reale.</p>}
            {renderSelettoreGiornate()}
            <div className="mt-2">
              {partiteGiornata.map(p => renderPartitaCard(p, null, true))}
            </div>
          </section>
        )}

        {activeTab === 'classifica' && (
          <section className="animate-fade-in">
            {!utenteSelezionato ? (
              <>
                <div className="flex bg-slate-900 rounded-lg p-1 mb-4 border border-slate-800">
                  <button onClick={() => setTipoClassificaFantagioco('generale')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${tipoClassificaFantagioco === 'generale' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}>Generale</button>
                  <button onClick={() => setTipoClassificaFantagioco('giornata')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${tipoClassificaFantagioco === 'giornata' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}>Di Giornata</button>
                </div>

                {tipoClassificaFantagioco === 'giornata' && (
                  <div className="mb-6">
                    {renderSelettoreGiornate()}
                    <div className="flex items-center gap-2 mt-4 justify-center">
                      {isGiornataConclusa ? (
                        <span className="bg-green-500/20 text-green-400 text-xs px-3 py-1 rounded-full border border-green-500/30 font-bold">✅ Giornata {giornataAttiva} Conclusa</span>
                      ) : (
                        <span className="bg-yellow-500/20 text-yellow-400 text-xs px-3 py-1 rounded-full border border-yellow-500/30 font-bold">⏳ Giornata {giornataAttiva} in Corso</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 border-b border-slate-800">
                      <tr><th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Pos</th><th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Giocatore</th><th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Punti</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {(tipoClassificaFantagioco === 'generale' ? classificaGenerale : classificaGiornata).map((utente, index) => (
                        <tr key={utente.id} onClick={() => setUtenteSelezionato(utente)} className="cursor-pointer hover:bg-slate-800/50">
                          <td className="p-4 font-bold text-slate-400">{index + 1}°</td>
                          <td className="p-4 font-bold text-slate-200">{utente.nome} {utente.id === session.user.id && '(Tu)'}</td>
                          <td className="p-4 font-extrabold text-right text-emerald-400">{utente.punti}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div>
                <button onClick={() => setUtenteSelezionato(null)} className="mb-4 text-xs text-emerald-400 font-bold hover:text-emerald-300">← Torna indietro</button>
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-extrabold text-slate-100">{utenteSelezionato.nome}</h2><span className="text-sm font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/20">{utenteSelezionato.punti} Punti</span></div>
                
                {renderSelettoreGiornate()}
                
                {(!scadutaAttuale && utenteSelezionato.id !== session.user.id) ? (
                  <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl text-center mt-6">🔒<br/><br/>I pronostici del girone di {faseAttiva} saranno svelati dopo la sua chiusura per evitare copiature!</div>
                ) : (
                  <div className="mt-4">{partiteGiornata.map(p => renderPartitaCard(p, utenteSelezionato.id, false))}</div>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'serie_a' && (
          <section className="animate-fade-in">
             <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Classifica Serie A</h2>
             <div className="flex bg-slate-900 rounded-lg p-1 mb-4 border border-slate-800">
                <button onClick={() => setTipoClassificaSerieA('reale')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${tipoClassificaSerieA === 'reale' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Reale</button>
                <button onClick={() => setTipoClassificaSerieA('pronostici')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${tipoClassificaSerieA === 'pronostici' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}>Mia Predizione</button>
             </div>
             <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
               <table className="w-full text-left">
                 <thead className="bg-slate-950 border-b border-slate-800">
                   <tr>
                     <th className="p-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">#</th>
                     <th className="p-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Squadra</th>
                     <th className="p-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">Pt</th>
                     <th className="p-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">GF</th>
                     <th className="p-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">GS</th>
                     <th className="p-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">DR</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800 text-xs">
                   {classificaSerieA.map((squadra, index) => {
                     const isInter = squadra.nome === 'Inter'
                     const showGoals = isInter

                     return (
                       <tr key={squadra.nome} className={isInter ? 'bg-yellow-900/10' : ''}>
                         <td className="p-3 text-slate-500 font-bold">{index + 1}</td>
                         <td className="p-3 font-bold text-slate-200 flex items-center gap-2"><LogoSquadra squadra={squadra.nome}/><span className="truncate">{squadra.nome}</span></td>
                         <td className="p-3 font-bold text-center text-emerald-400">{squadra.punti}</td>
                         <td className="p-3 text-center text-slate-400">{showGoals ? squadra.gf : '-'}</td>
                         <td className="p-3 text-center text-slate-400">{showGoals ? squadra.gs : '-'}</td>
                         <td className="p-3 text-center text-slate-400 font-bold">{showGoals ? (squadra.gf - squadra.gs) : '-'}</td>
                       </tr>
                     )
                   })}
                 </tbody>
               </table>
             </div>
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex justify-around p-3 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-30">
        <button onClick={() => { setActiveTab('pronostici'); setUtenteSelezionato(null); }} className={`flex flex-col items-center w-full py-1 text-[10px] uppercase tracking-wider transition-colors ${activeTab === 'pronostici' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>Pronostici</button>
        <button onClick={() => { setActiveTab('risultati'); setUtenteSelezionato(null); }} className={`flex flex-col items-center w-full py-1 text-[10px] uppercase tracking-wider transition-colors ${activeTab === 'risultati' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>Risultati</button>
        <button onClick={() => setActiveTab('classifica')} className={`flex flex-col items-center w-full py-1 text-[10px] uppercase tracking-wider transition-colors ${activeTab === 'classifica' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>Fantagioco</button>
        <button onClick={() => setActiveTab('serie_a')} className={`flex flex-col items-center w-full py-1 text-[10px] uppercase tracking-wider transition-colors ${activeTab === 'serie_a' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>Serie A</button>
      </nav>
    </div>
  )
}