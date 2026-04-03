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
    const today = new Date().toISOString().split('T')[0]

    // Fetch today's picks with game data
    const { data: active } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
      .eq('game_date', today)
      .order('created_at', { ascending: false })

    // Fetch all past picks with game data
    const { data: history } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
      .lt('game_date', today)
      .order('game_date', { ascending: false })

    setActivePicks(active || [])
    setHistoryPicks(history || [])
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
    if (result === 'win') {
      if (odds > 0) return `+${odds}`
      return `+${Math.round(10000 / Math.abs(odds))}`
    }
    if (result === 'loss') return '-100'
    return '--'
  }

  const PickCard = ({ pick }) => {
    const game = pick.games
    if (!game) return null

    return (
      <div className="bg-gray-800 rounded-lg p-4 mb-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-white font-bold">{game.away_team} @ {game.home_team}</p>
            <p className="text-gray-400 text-sm">{pick.game_date} · {game.game_time}</p>
          </div>
          <div className="text-right">
            <p className={`font-bold ${getResultColor(pick.result)}`}>
              {getResultLabel(pick.result)}
            </p>
            <p className={`text-sm font-bold ${getResultColor(pick.result)}`}>
              {getPoints(pick.result, pick.odds)}
            </p>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="bg-gray-700 rounded px-3 py-1">
            <p className="text-blue-400 font-bold text-sm">{pick.pick}</p>
            <p className="text-gray-400 text-xs">{pick.pick_type === 'ml_rl' ? 'ML / RL' : 'Over/Under'}</p>
          </div>
          {game.away_score !== null && game.home_score !== null && (
            <div className="text-center">
              <p className="text-white font-bold text-lg">
                {game.away_score} - {game.home_score}
              </p>
              <p className="text-gray-400 text-xs">{game.status}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!user) return <div className="min-h-screen bg-gray-900"></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">📋 My Picks</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700">Back</button>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 rounded-md font-bold transition-colors ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Active ({activePicks.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-md font-bold transition-colors ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            History ({historyPicks.length})
          </button>
        </div>

        {loading && <p className="text-gray-400">Loading picks...</p>}

        {!loading && activeTab === 'active' && (
          <div>
            {activePicks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No picks for today yet. <br/>
                <button onClick={() => router.push('/picks')} className="text-blue-400 hover:underline mt-2 block">Make your picks →</button>
              </p>
            ) : (
              activePicks.map(pick => <PickCard key={pick.id} pick={pick} />)
            )}
          </div>
        )}

        {!loading && activeTab === 'history' && (
          <div>
            {historyPicks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No pick history yet.</p>
            ) : (
              historyPicks.map(pick => <PickCard key={pick.id} pick={pick} />)
            )}
          </div>
        )}
      </div>
    </div>
  )
}