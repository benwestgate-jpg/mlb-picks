'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Picks() {
  const [user, setUser] = useState(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [userPicks, setUserPicks] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Phoenix'
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
      await fetchGames()
      await fetchExistingPicks(user.id)
    }
    init()
  }, [])

  const fetchGames = async () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('game_date', todayStr)
      .order('game_time_utc', { ascending: true })
    if (!error) setGames(data)
    setLoading(false)
  }

  const fetchExistingPicks = async (userId) => {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('game_date', todayStr)

    if (data) {
      const picksMap = {}
      data.forEach(pick => {
        if (!picksMap[pick.game_id]) picksMap[pick.game_id] = {}
        picksMap[pick.game_id][pick.pick_type] = {
          pick: pick.pick,
          odds: pick.odds,
          saved: true
        }
      })
      setUserPicks(picksMap)
    }
  }

  const isGameLocked = (game) => {
    if (!game.game_time_utc) return false
    return new Date() >= new Date(game.game_time_utc)
  }

  const formatOdds = (odds) => {
    if (!odds) return ''
    return odds > 0 ? `+${odds}` : `${odds}`
  }

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

  const isSelected = (gameId, category, pick) => {
    return userPicks[gameId]?.[category]?.pick === pick
  }

  const isSaved = (gameId, category) => {
    return userPicks[gameId]?.[category]?.saved === true
  }

  const submitPicks = async () => {
    if (!user) return
    setSubmitting(true)
    const todayStr = new Date().toISOString().split('T')[0]
    const picksToUpsert = []

    for (const [gameId, categories] of Object.entries(userPicks)) {
      for (const [category, pickData] of Object.entries(categories)) {
        if (!pickData.pick) continue
        picksToUpsert.push({
          user_id: user.id,
          game_id: parseInt(gameId),
          pick: pickData.pick,
          pick_type: category,
          game_date: todayStr,
          result: 'pending'
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
        .eq('game_date', todayStr)
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

  if (!user) return <div className="min-h-screen bg-gray-900"></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">⚾ Daily Slate</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700">Back</button>
        </div>
        <p className="text-gray-400 text-sm mb-8">{today}</p>

        {loading && <p className="text-gray-400">Loading games...</p>}
        {!loading && games.length === 0 && <p className="text-gray-400">No games found for today.</p>}

        {games.map((game) => {
          const locked = isGameLocked(game)
          return (
            <div key={game.id} className={`rounded-lg p-6 mb-4 transition-opacity ${locked ? 'bg-gray-900 opacity-50' : 'bg-gray-800'}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{game.away_team} @ {game.home_team}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">{game.game_time}</span>
                  {locked && <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold">LOCKED</span>}
                </div>
              </div>

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
            </div>
          )
        })}

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