'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(null)
  const [membership, setMembership] = useState(null)
  const [pool, setPool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
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

      setMembership(mem)
      setUsername(mem.username)
      setPool(mem.pools)
      setLoading(false)
    }
    init()

    // Update countdown every second
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleRepeatPool = async () => {
    if (!confirm('Create a new pool with the same players and settings?')) return
    
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    const { data: newPool, error } = await supabase
      .from('pools')
      .insert({
        name: pool.name + ' (2)',
        created_by: user.id,
        invite_code: newCode,
        scoring_type: pool.scoring_type,
        odds_format: pool.odds_format,
        daily_balance: pool.daily_balance,
        count_losses: pool.count_losses,
        leaderboard_sort: pool.leaderboard_sort,
        parlay_enabled: pool.parlay_enabled,
        parlay_max_picks: pool.parlay_max_picks,
        pick_limit_pct: pool.pick_limit_pct,
      })
      .select()
      .single()

    if (error) { alert('Error creating pool: ' + error.message); return }

    // Get all current members and add them to new pool
    const { data: currentMembers } = await supabase
      .from('pool_members')
      .select('*')
      .eq('pool_id', pool.id)

    const newMembers = currentMembers.map(m => ({
      pool_id: newPool.id,
      user_id: m.user_id,
      role: m.role,
      username: m.username
    }))

    await supabase.from('pool_members').insert(newMembers)

    // Remove everyone from old pool
    await supabase.from('pool_members').delete().eq('pool_id', pool.id)

    router.push('/dashboard')
  }

  const getPoolTypeLabel = (pool) => {
    if (!pool) return ''
    const type = pool.scoring_type || 'points'
    const odds = pool.odds_format === 'multiplier' ? 'Multiplier Odds' : 'American Odds'
    if (type === 'points') return `💰 Points Pool · ${odds} · ${pool.daily_balance || 1000} daily balance`
    if (type === 'wins') return `🏆 Total Wins Pool · ${odds}`
    if (type === 'winpct') return `📊 Win % Pool · ${odds}${pool.pick_limit_pct ? ` · ${pool.pick_limit_pct}% threshold` : ''}`
    return ''
  }

  const getPoolRules = (pool) => {
    if (!pool) return []
    const type = pool.scoring_type || 'points'
    if (type === 'points') {
      const rules = [
        `Each day you get ${pool.daily_balance || 1000} points to stake across games`,
        'Stake any amount on each pick — win multiplied by odds, lose your stake',
        pool.count_losses === 'true' ? 'Losses deduct your stake from your total' : 'Losses count as 0 — only wins add points',
      ]
      if (pool.parlay_enabled === 'true') rules.push(`Parlays allowed (max ${pool.parlay_max_picks} picks)`)
      return rules
    }
    if (type === 'wins') return [
      'Pick any game — every win counts equally regardless of odds',
      'Most total wins at the end of the pool wins',
      'Losses don\'t count against you',
    ]
    if (type === 'winpct') return [
      'Your score is your win percentage across all picks',
      'Each game counts as 1 — making 2 picks in a game counts as 200%',
      pool.pick_limit_pct ? `You must maintain a ${pool.pick_limit_pct}% pick rate or be disqualified` : 'No minimum pick rate set',
    ]
    return []
  }

  const getCountdown = (dateStr, label) => {
    if (!dateStr) return null
    const target = new Date(dateStr + 'T00:00:00')
    const diff = target - now
    if (diff <= 0) return null
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    return { label, days, hours, minutes, seconds }
  }

  const getPoolStatus = () => {
    if (!pool) return 'active'
    const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' })
    if (pool.start_date && today < pool.start_date) return 'pending'
    if (pool.end_date && today > pool.end_date) return 'ended'
    if (pool.end_date && today === pool.end_date) return 'final_day'
    return 'active'
  }

  if (loading) return <div className="min-h-screen bg-gray-900"></div>

  const poolStatus = getPoolStatus()
  const startCountdown = getCountdown(pool?.start_date, 'Pool starts in')
  const endCountdown = getCountdown(pool?.end_date, 'Pool ends in')
  const isAdmin = membership?.role === 'admin'
  const rules = getPoolRules(pool)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">⚾ Westgate Book Pick'em</h1>
          <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700">Log Out</button>
        </div>
        <p className="text-gray-400 mb-1">Welcome back, <span className="text-white font-bold">{username}</span></p>
        <p className="text-gray-500 text-sm mb-4">📍 {pool?.name}</p>

        {/* Pool Type */}
        <div className="bg-gray-800 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm font-bold text-blue-400">{getPoolTypeLabel(pool)}</p>
        </div>

        {/* Final Day Banner */}
        {poolStatus === 'final_day' && (
          <div className="bg-red-800 border border-red-500 rounded-lg px-4 py-3 mb-4 text-center">
            <p className="text-xl font-bold text-red-200">🚨 FINAL DAY</p>
            <p className="text-red-300 text-sm mt-1">Today is the last day to make picks — good luck!</p>
          </div>
        )}

        {/* Pool Ended Banner */}
        {poolStatus === 'ended' && (
          <div className="bg-gray-700 border border-gray-500 rounded-lg px-4 py-4 mb-4 text-center">
            <p className="text-xl font-bold">🏁 Pool Has Ended</p>
            <p className="text-gray-400 text-sm mt-1">The pool is over — check the leaderboard for final standings</p>
            {isAdmin && (
              <button
                onClick={handleRepeatPool}
                className="mt-3 bg-blue-600 px-6 py-2 rounded font-bold hover:bg-blue-700"
              >
                🔄 Run It Back — Same Players
              </button>
            )}
          </div>
        )}

        {/* Countdown Timer */}
        {poolStatus === 'pending' && startCountdown && (
          <div className="bg-blue-900 border border-blue-500 rounded-lg p-4 mb-4 text-center">
            <p className="text-blue-300 text-sm font-bold mb-2">⏳ {startCountdown.label}</p>
            <div className="flex justify-center gap-4">
              {[
                { val: startCountdown.days, label: 'Days' },
                { val: startCountdown.hours, label: 'Hours' },
                { val: startCountdown.minutes, label: 'Mins' },
                { val: startCountdown.seconds, label: 'Secs' },
              ].map(({ val, label }) => (
                <div key={label} className="text-center">
                  <p className="text-3xl font-bold text-white">{String(val).padStart(2, '0')}</p>
                  <p className="text-blue-400 text-xs">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-blue-400 text-xs mt-3">Picks open on {new Date(pool.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        )}

        {/* End countdown (active pool) */}
        {poolStatus === 'active' && endCountdown && (
          <div className="bg-gray-800 rounded-lg px-4 py-3 mb-4 flex justify-between items-center">
            <p className="text-gray-400 text-sm">⏳ Pool ends in</p>
            <p className="text-white font-bold text-sm">
              {endCountdown.days}d {endCountdown.hours}h {endCountdown.minutes}m
            </p>
          </div>
        )}

        {/* Rules */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <p className="text-sm font-bold text-gray-400 mb-2">📖 Pool Rules</p>
          <ul className="space-y-1">
            {rules.map((rule, i) => (
              <li key={i} className="text-gray-300 text-sm flex gap-2">
                <span className="text-blue-400">•</span>{rule}
              </li>
            ))}
          </ul>
        </div>

        {/* Nav Buttons — disabled if pool hasn't started */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => poolStatus !== 'pending' && router.push('/picks')}
            className={`p-6 rounded-lg text-center transition-colors ${poolStatus === 'pending' ? 'bg-gray-800 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <p className="text-2xl mb-2">⚾</p>
            <p className="text-xl font-bold">Daily Slate</p>
            <p className="text-gray-300 text-sm mt-1">{poolStatus === 'pending' ? 'Opens when pool starts' : 'Make your picks for today'}</p>
          </button>
          <button
            onClick={() => router.push('/leaderboard')}
            className="bg-green-700 p-6 rounded-lg text-center hover:bg-green-800"
          >
            <p className="text-2xl mb-2">🏆</p>
            <p className="text-xl font-bold">Leaderboard</p>
            <p className="text-gray-300 text-sm mt-1">See who's winning</p>
          </button>
          <button
            onClick={() => router.push('/my-picks')}
            className="bg-purple-700 p-6 rounded-lg text-center hover:bg-purple-800"
          >
            <p className="text-2xl mb-2">📋</p>
            <p className="text-xl font-bold">Picks</p>
            <p className="text-gray-300 text-sm mt-1">Active picks & history</p>
          </button>
          <button
            onClick={() => router.push('/settings')}
            className="bg-gray-700 p-6 rounded-lg text-center hover:bg-gray-600"
          >
            <p className="text-2xl mb-2">⚙️</p>
            <p className="text-xl font-bold">Settings</p>
            <p className="text-gray-300 text-sm mt-1">Pool settings & preferences</p>
          </button>
        </div>

      </div>
    </div>
  )
}