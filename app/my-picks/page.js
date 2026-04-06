'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function MyPicks() {
  const [user, setUser] = useState(null)
  const [activePicks, setActivePicks] = useState([])
  const [historyPicks, setHistoryPicks] = useState([])
  const [activeTab, setActiveTab] = useState('active')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
      fetchPicks(user.id)
    }
    init()
  }, [])

  const fetchPicks = async (userId) => {
    const { data: active } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
      .eq('result', 'pending')
      .order('game_date', { ascending: true })

    const { data: history } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
      .neq('result', 'pending')
      .order('game_date', { ascending: false })

    const groupByGame = (picks) => {
      const grouped = {}
      picks?.forEach(pick => {
        if (!grouped[pick.game_id]) {
          grouped[pick.game_id] = {
            game: pick.games,
            game_date: pick.game_date,
            picks: []
          }
        }
        grouped[pick.game_id].picks.push(pick)
      })
      return Object.values(grouped)
    }

    setActivePicks(groupByGame(active || []))
    setHistoryPicks(groupByGame(history || []))
    setLoading(false)
  }

  const getResultColor = (result) => {
    if (result === 'win') return 'text-green-400'
    if (result === 'loss') return 'text-red-400'
    return 'text-yellow-400'
  }

  const getResultLabel = (result) => {
    if (result === 'win') return 'WIN'
    if (result === 'loss') return 'LOSS'
    return 'PENDING'
  }

  const getPoints = (result, odds) => {
    if (!odds) return '--'
    if (result === 'win') {
      if (odds > 0) return `+${odds}`
      return `+${Math.round(10000 / Math.abs(odds))}`
    }
    if (result === 'loss') return '-100'
    return '--'
  }

  const GameCard = ({ gameGroup }) => {
    const { game, game_date, picks } = gameGroup
    if (!game) return null

    return (
      <div className="bg-gray-800 rounded-lg p-4 mb-3">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-white font-bold text-lg">{game.away_team} @ {game.home_team}</p>
            <p className="text-gray-400 text-sm">{game_date} · {game.game_time}</p>
          </div>
          {game.away_score !== null && game.home_score !== null && (
            <div className="text-center">
              <p className="text-white font-bold text-xl">{game.away_score} - {game.home_score}</p>
              <p className="text-gray-400 text-xs">{game.status}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {picks.map(pick => (
            <div key={pick.id} className="flex justify-between items-center bg-gray-700 rounded px-3 py-2">
              <div>
                <p className="text-blue-400 font-bold">{pick.pick}</p>
                <p className="text-gray-400 text-xs">{pick.pick_type === 'ml_rl' ? 'ML / RL' : 'Over/Under'}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${getResultColor(pick.result)}`}>{getResultLabel(pick.result)}</p>
                <p className={`text-sm ${getResultColor(pick.result)}`}>{getPoints(pick.result, pick.odds)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!user) return <div className="min-h-screen bg-gray-900"></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">📋 Picks</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700">Back</button>
        </div>

        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 rounded-md font-bold transition-colors ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Active ({activePicks.length} games)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-md font-bold transition-colors ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            History ({historyPicks.length} games)
          </button>
        </div>

        {loading && <p className="text-gray-400">Loading picks...</p>}

        {!loading && activeTab === 'active' && (
          <div>
            {activePicks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No active picks yet.
                <button onClick={() => router.push('/picks')} className="text-blue-400 hover:underline mt-2 block">Make your picks →</button>
              </p>
            ) : (
              activePicks.map((group, i) => <GameCard key={i} gameGroup={group} />)
            )}
          </div>
        )}

        {!loading && activeTab === 'history' && (
          <div>
            {historyPicks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No pick history yet.</p>
            ) : (
              historyPicks.map((group, i) => <GameCard key={i} gameGroup={group} />)
            )}
          </div>
        )}
      </div>
    </div>
  )
}