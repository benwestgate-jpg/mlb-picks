'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Picks() {
  const [user, setUser] = useState(null)
  const [todayGames, setTodayGames] = useState([])
  const [tomorrowGames, setTomorrowGames] = useState([])
  const [activeTab, setActiveTab] = useState('today')
  const [loading, setLoading] = useState(true)
  const [todayPicks, setTodayPicks] = useState({})
  const [tomorrowPicks, setTomorrowPicks] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showTomorrow, setShowTomorrow] = useState(false)
  const [oddsFormat, setOddsFormat] = useState('american')
  const router = useRouter()

  const getTodayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' })
  const getTomorrowStr = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' })
  }

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Phoenix'
  })

  const tomorrowLabel = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/Phoenix'
    })
  })()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)

      const nowAZ = new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' })
      const hourAZ = new Date(nowAZ).getHours()
      setShowTomorrow(hourAZ >= 18)

      const { data: mem } = await supabase
        .from('pool_members')
        .select('*, pools(*)')
        .eq('user_id', user.id)
        .single()

      if (mem?.pools?.odds_format) setOddsFormat(mem.pools.odds_format)

      await fetchGames()
      await fetchExistingPicks(user.id)
    }
    init()
  }, [])

  const fetchGames = async () => {
    const todayStr = getTodayStr()
    const tomorrowStr = getTomorrowStr()

    const { data: today } = await supabase
      .from('games')
      .select('*')
      .eq('game_date', todayStr)
      .order('game_time_utc', { ascending: true })

    const { data: tomorrow } = await supabase
      .from('games')
      .select('*')
      .eq('game_date', tomorrowStr)
      .order('game_time_utc', { ascending: true })

    setTodayGames(today || [])
    setTomorrowGames(tomorrow || [])
    setLoading(false)
  }

  const fetchExistingPicks = async (userId) => {
    const todayStr = getTodayStr()
    const tomorrowStr = getTomorrowStr()

    const { data: todayData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('game_date', todayStr)

    const { data: tomorrowData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('game_date', tomorrowStr)

    const buildMap = (data) => {
      const map = {}
      data?.forEach(pick => {
        if (!map[pick.game_id]) map[pick.game_id] = {}
        map[pick.game_id][pick.pick_type] = {
          pick: pick.pick,
          odds: pick.odds,
          saved: true
        }
      })
      return map
    }

    setTodayPicks(buildMap(todayData))
    setTomorrowPicks(buildMap(tomorrowData))
  }

  const isGameLocked = (game) => {
    if (!game.game_time_utc) return false
    return new Date() >= new Date(game.game_time_utc)
  }

  const formatOdds = (odds) => {
    if (!odds) return ''
    if (oddsFormat === 'multiplier') {
      if (odds > 0) return `${((odds / 100) + 1).toFixed(2)}x`
      return `${((100 / Math.abs(odds)) + 1).toFixed(2)}x`
    }
    return odds > 0 ? `+${odds}` : `${odds}`
  }

  const userPicks = activeTab === 'today' ? todayPicks : tomorrowPicks
  const setUserPicks = activeTab === 'today' ? setTodayPicks : setTomorrowPicks

  const handlePick = (game, category, pick, odds) => {
    if (isGameLocked(game)) {
      alert('This game has already started — picks are locked!')
      return
    }
    setUserPicks(prev => ({
      ...prev,
      [game.id]: {
        ...prev[game.id],
        [category]: { pick, odds, saved: false }
      }
    }))
  }

  const isSelected = (gameId, category, pick) => userPicks[gameId]?.[category]?.pick === pick
  const isSaved = (gameId, category) => userPicks[gameId]?.[category]?.saved === true

  const submitPicks = async () => {
    if (!user) return
    setSubmitting(true)

    const gameDateStr = activeTab === 'today' ? getTodayStr() : getTomorrowStr()
    const picksToUpsert = []

    for (const [gameId, categories] of Object.entries(userPicks)) {
      for (const [category, pickData] of Object.entries(categories)) {
        if (!pickData.pick) continue
        picksToUpsert.push({
          user_id: user.id,
          game_id: parseInt(gameId),
          pick: pickData.pick,
          pick_type: category,
          game_date: gameDateStr,
          result: 'pending',
          odds: pickData.odds || null
        })
      }
    }

    if (picksToUpsert.length === 0) {
      alert('Please make at least one pick!')
      setSubmitting(false)
      return
    }

    for (const pick of picksToUpsert) {
      await supabase
        .from('picks')
        .delete()
        .eq('user_id', user.id)
        .eq('game_id', pick.game_id)
        .eq('pick_type', pick.pick_type)
        .eq('game_date', gameDateStr)
    }

    const { error } = await supabase.from('picks').insert(picksToUpsert)
    if (error) {
      alert('Error saving picks: ' + error.message)
    } else {
      alert(`${picksToUpsert.length} picks saved!`)
      await fetchExistingPicks(user.id)
    }
    setSubmitting(false)
  }

  const GameCard = ({ game, isTomorrow }) => {
    const locked = isGameLocked(game)
    const noOdds = !game.ml_away && !game.ml_home

    return (
      <div className={`rounded-lg p-6 mb-4 transition-opacity ${locked ? 'bg-gray-900 opacity-50' : 'bg-gray-800'}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{game.away_team} @ {game.home_team}</h2>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">{game.game_time}</span>
            {locked && <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold">LOCKED</span>}
            {isTomorrow && noOdds && <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded font-bold">ODDS TBD</span>}
          </div>
        </div>

        {noOdds && isTomorrow ? (
          <p className="text-gray-500 text-sm text-center py-4">Odds not yet available — check back tomorrow morning</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-sm font-bold text-gray-400 mb-2 text-center">
              <div>TEAM</div>
              <div>ML / RL</div>
              <div>OVER/UNDER</div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2 items-center">
              <div className="font-bold">{game.away_team}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePick(game, 'ml_rl', `${game.away_team} ML`, game.ml_away)}
                  disabled={locked}
                  className={`flex-1 p-2 rounded text-center text-sm transition-colors ${isSelected(game.id, 'ml_rl', `${game.away_team} ML`) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} ${isSaved(game.id, 'ml_rl') && isSelected(game.id, 'ml_rl', `${game.away_team} ML`) ? 'ring-2 ring-blue-400' : ''} ${locked ? 'cursor-not-allowed' : ''}`}
                >
                  ML {formatOdds(game.ml_away)}
                </button>
                <button
                  onClick={() => handlePick(game, 'ml_rl', `${game.away_team} RL ${game.rl_away_point}`, game.rl_away)}
                  disabled={locked}
                  className={`flex-1 p-2 rounded text-center text-sm transition-colors ${isSelected(game.id, 'ml_rl', `${game.away_team} RL ${game.rl_away_point}`) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} ${isSaved(game.id, 'ml_rl') && isSelected(game.id, 'ml_rl', `${game.away_team} RL ${game.rl_away_point}`) ? 'ring-2 ring-blue-400' : ''} ${locked ? 'cursor-not-allowed' : ''}`}
                >
                  {game.rl_away_point > 0 ? '+' : ''}{game.rl_away_point} {formatOdds(game.rl_away)}
                </button>
              </div>
              <button
                onClick={() => handlePick(game, 'over_under', `Over ${game.over_under}`, game.over_odds)}
                disabled={locked}
                className={`p-2 rounded text-center text-sm transition-colors ${isSelected(game.id, 'over_under', `Over ${game.over_under}`) ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'} ${isSaved(game.id, 'over_under') && isSelected(game.id, 'over_under', `Over ${game.over_under}`) ? 'ring-2 ring-green-400' : ''} ${locked ? 'cursor-not-allowed' : ''}`}
              >
                Over {game.over_under} {formatOdds(game.over_odds)}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="font-bold">{game.home_team}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePick(game, 'ml_rl', `${game.home_team} ML`, game.ml_home)}
                  disabled={locked}
                  className={`flex-1 p-2 rounded text-center text-sm transition-colors ${isSelected(game.id, 'ml_rl', `${game.home_team} ML`) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} ${isSaved(game.id, 'ml_rl') && isSelected(game.id, 'ml_rl', `${game.home_team} ML`) ? 'ring-2 ring-blue-400' : ''} ${locked ? 'cursor-not-allowed' : ''}`}
                >
                  ML {formatOdds(game.ml_home)}
                </button>
                <button
                  onClick={() => handlePick(game, 'ml_rl', `${game.home_team} RL ${game.rl_home_point}`, game.rl_home)}
                  disabled={locked}
                  className={`flex-1 p-2 rounded text-center text-sm transition-colors ${isSelected(game.id, 'ml_rl', `${game.home_team} RL ${game.rl_home_point}`) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} ${isSaved(game.id, 'ml_rl') && isSelected(game.id, 'ml_rl', `${game.home_team} RL ${game.rl_home_point}`) ? 'ring-2 ring-blue-400' : ''} ${locked ? 'cursor-not-allowed' : ''}`}
                >
                  {game.rl_home_point > 0 ? '+' : ''}{game.rl_home_point} {formatOdds(game.rl_home)}
                </button>
              </div>
              <button
                onClick={() => handlePick(game, 'over_under', `Under ${game.over_under}`, game.under_odds)}
                disabled={locked}
                className={`p-2 rounded text-center text-sm transition-colors ${isSelected(game.id, 'over_under', `Under ${game.over_under}`) ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'} ${isSaved(game.id, 'over_under') && isSelected(game.id, 'over_under', `Under ${game.over_under}`) ? 'ring-2 ring-green-400' : ''} ${locked ? 'cursor-not-allowed' : ''}`}
              >
                Under {game.over_under} {formatOdds(game.under_odds)}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  if (!user) return <div className="min-h-screen bg-gray-900"></div>

  const games = activeTab === 'today' ? todayGames : tomorrowGames

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">⚾ Daily Slate</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700">Back</button>
        </div>
        <p className="text-gray-400 text-sm mb-6">{activeTab === 'today' ? todayLabel : tomorrowLabel}</p>

        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-2 rounded-md font-bold transition-colors ${activeTab === 'today' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Today ({todayGames.length} games)
          </button>
          {showTomorrow && (
            <button
              onClick={() => setActiveTab('tomorrow')}
              className={`flex-1 py-2 rounded-md font-bold transition-colors ${activeTab === 'tomorrow' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Tomorrow ({tomorrowGames.length} games)
            </button>
          )}
        </div>

        {loading && <p className="text-gray-400">Loading games...</p>}
        {!loading && games.length === 0 && <p className="text-gray-400">No games found.</p>}

        {games.map((game) => (
          <GameCard key={game.id} game={game} isTomorrow={activeTab === 'tomorrow'} />
        ))}

        {games.length > 0 && (
          <button
            onClick={submitPicks}
            disabled={submitting}
            className="w-full p-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 mt-4 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : `Submit Picks (${Object.keys(userPicks).length} games picked)`}
          </button>
        )}
      </div>
    </div>
  )
}