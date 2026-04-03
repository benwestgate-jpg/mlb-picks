'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Picks() {
  const [user, setUser] = useState(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [userPicks, setUserPicks] = useState({})
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
      fetchGames()
    }
    init()
  }, [])

  const fetchGames = async () => {
    const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const today = tomorrow.toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('game_date', today)
      .order('game_time', { ascending: true })
    if (!error) setGames(data)
    setLoading(false)
  }

  const formatOdds = (odds) => {
    if (!odds) return ''
    return odds > 0 ? `+${odds}` : `${odds}`
  }

  const handlePick = (gameId, category, pick, odds) => {
    setUserPicks(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [category]: { pick, odds }
      }
    }))
  }

  const isSelected = (gameId, category, pick) => {
    return userPicks[gameId]?.[category]?.pick === pick
  }

  const submitPicks = async () => {
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    
    const picksToInsert = []
    
    for (const [gameId, categories] of Object.entries(userPicks)) {
      for (const [category, pickData] of Object.entries(categories)) {
        picksToInsert.push({
          user_id: user.id,
          game_id: parseInt(gameId),
          pick: pickData.pick,
          pick_type: category,
          game_date: today,
          result: 'pending'
        })
      }
    }

    if (picksToInsert.length === 0) {
      alert('Please make at least one pick!')
      return
    }

    const { error } = await supabase.from('picks').insert(picksToInsert)
    if (error) alert('Error saving picks: ' + error.message)
    else alert(`${picksToInsert.length} picks saved!`)
  }

  if (!user) return <div className="min-h-screen bg-gray-900"></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">⚾ Today's Picks</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700">Back</button>
        </div>

        {loading && <p className="text-gray-400">Loading games...</p>}
        {!loading && games.length === 0 && <p className="text-gray-400">No games found for today.</p>}

        {games.map((game) => (
          <div key={game.id} className="bg-gray-800 rounded-lg p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{game.away_team} @ {game.home_team}</h2>
              <span className="text-gray-400 text-sm">{game.game_time}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm font-bold text-gray-400 mb-2 text-center">
              <div>TEAM</div>
              <div>ML / RL</div>
              <div>OVER/UNDER</div>
            </div>

            {/* Away Team Row */}
            <div className="grid grid-cols-3 gap-2 mb-2 items-center">
              <div className="font-bold">{game.away_team}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePick(game.id, 'ml_rl', `${game.away_team} ML`, game.ml_away)}
                  className={`flex-1 p-2 rounded text-center text-sm ${isSelected(game.id, 'ml_rl', `${game.away_team} ML`) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  ML {formatOdds(game.ml_away)}
                </button>
                <button
                  onClick={() => handlePick(game.id, 'ml_rl', `${game.away_team} RL ${game.rl_away_point}`, game.rl_away)}
                  className={`flex-1 p-2 rounded text-center text-sm ${isSelected(game.id, 'ml_rl', `${game.away_team} RL ${game.rl_away_point}`) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  {game.rl_away_point > 0 ? '+' : ''}{game.rl_away_point} {formatOdds(game.rl_away)}
                </button>
              </div>
              <button
                onClick={() => handlePick(game.id, 'over_under', `Over ${game.over_under}`, game.over_odds)}
                className={`p-2 rounded text-center text-sm ${isSelected(game.id, 'over_under', `Over ${game.over_under}`) ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                Over {game.over_under} {formatOdds(game.over_odds)}
              </button>
            </div>

            {/* Home Team Row */}
            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="font-bold">{game.home_team}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePick(game.id, 'ml_rl', `${game.home_team} ML`, game.ml_home)}
                  className={`flex-1 p-2 rounded text-center text-sm ${isSelected(game.id, 'ml_rl', `${game.home_team} ML`) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  ML {formatOdds(game.ml_home)}
                </button>
                <button
                  onClick={() => handlePick(game.id, 'ml_rl', `${game.home_team} RL ${game.rl_home_point}`, game.rl_home)}
                  className={`flex-1 p-2 rounded text-center text-sm ${isSelected(game.id, 'ml_rl', `${game.home_team} RL ${game.rl_home_point}`) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  {game.rl_home_point > 0 ? '+' : ''}{game.rl_home_point} {formatOdds(game.rl_home)}
                </button>
              </div>
              <button
                onClick={() => handlePick(game.id, 'over_under', `Under ${game.over_under}`, game.under_odds)}
                className={`p-2 rounded text-center text-sm ${isSelected(game.id, 'over_under', `Under ${game.over_under}`) ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                Under {game.over_under} {formatOdds(game.under_odds)}
              </button>
            </div>
          </div>
        ))}

        {games.length > 0 && (
          <button
            onClick={submitPicks}
            className="w-full p-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 mt-4"
          >
            Submit Picks ({Object.keys(userPicks).length} games picked)
          </button>
        )}
      </div>
    </div>
  )
}