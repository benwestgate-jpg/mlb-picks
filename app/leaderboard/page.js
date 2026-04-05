'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Leaderboard() {
  const [user, setUser] = useState(null)
  const [pool, setPool] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('points')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)

      const { data: mem } = await supabase
        .from('pool_members')
        .select('*, pools(*)')
        .eq('user_id', user.id)
        .single()

      if (!mem) { router.push('/pools'); return }
      setPool(mem.pools)

      await fetchLeaderboard(mem.pool_id)
    }
    init()
  }, [])

  const fetchLeaderboard = async (poolId) => {
    const { data: members } = await supabase
      .from('pool_members')
      .select('*')
      .eq('pool_id', poolId)

    if (!members) { setLoading(false); return }

    const stats = await Promise.all(members.map(async (member) => {
      const { data: picks } = await supabase
        .from('picks')
        .select('*')
        .eq('user_id', member.user_id)
        .neq('result', 'pending')

      const wins = picks?.filter(p => p.result === 'win').length || 0
      const losses = picks?.filter(p => p.result === 'loss').length || 0
      const total = wins + losses

      let points = 0
      picks?.forEach(pick => {
        if (pick.result === 'win') {
          if (pick.odds > 0) points += pick.odds
          else points += Math.round(10000 / Math.abs(pick.odds))
        } else if (pick.result === 'loss') {
          points -= 100
        }
      })

      return {
        username: member.username,
        user_id: member.user_id,
        wins,
        losses,
        total,
        points,
        winPct: total > 0 ? Math.round((wins / total) * 100) : 0
      }
    }))

    setLeaderboard(stats)
    setLoading(false)
  }

  const sorted = [...leaderboard].sort((a, b) => {
    if (sortBy === 'points') return b.points - a.points
    if (sortBy === 'wins') return b.wins - a.wins
    if (sortBy === 'winPct') return b.winPct - a.winPct
    return 0
  })

  const getRankEmoji = (index) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  if (loading) return <div className="min-h-screen bg-gray-900"></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">🏆 Leaderboard</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700">Back</button>
        </div>
        <p className="text-gray-400 text-sm mb-6">📍 {pool?.name}</p>

        {/* Sort Tabs */}
        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setSortBy('points')}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${sortBy === 'points' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Points
          </button>
          <button
            onClick={() => setSortBy('wins')}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${sortBy === 'wins' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Total Wins
          </button>
          <button
            onClick={() => setSortBy('winPct')}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${sortBy === 'winPct' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Win %
          </button>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          {sorted.map((player, index) => (
            <div
              key={player.user_id}
              className={`bg-gray-800 rounded-lg p-4 flex items-center justify-between ${player.user_id === user?.id ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl w-8 text-center">{getRankEmoji(index)}</span>
                <div>
                  <p className="font-bold text-lg">{player.username} {player.user_id === user?.id ? '(you)' : ''}</p>
                  <p className="text-gray-400 text-sm">{player.wins}W - {player.losses}L · {player.winPct}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${player.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {player.points >= 0 ? '+' : ''}{player.points}
                </p>
                <p className="text-gray-400 text-xs">points</p>
              </div>
            </div>
          ))}
        </div>

        {leaderboard.length === 0 && (
          <p className="text-gray-400 text-center py-8">No picks have been graded yet!</p>
        )}
      </div>
    </div>
  )
}