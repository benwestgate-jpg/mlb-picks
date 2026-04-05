'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(null)
  const [poolName, setPoolName] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)

      const { data: membership } = await supabase
        .from('pool_members')
        .select('*, pools(*)')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!membership) {
        router.push('/pools')
        return
      }

      setUsername(membership.username)
      setPoolName(membership.pools?.name)
    }
    init()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) return <div className="min-h-screen bg-gray-900"></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">⚾ Westgate Book Pick'em</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
          >
            Log Out
          </button>
        </div>
        <p className="text-gray-400 mb-1">Welcome back, <span className="text-white font-bold">{username}</span></p>
        <p className="text-gray-500 text-sm mb-8">📍 {poolName}</p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/picks')}
            className="bg-blue-600 p-6 rounded-lg text-center hover:bg-blue-700"
          >
            <p className="text-2xl mb-2">⚾</p>
            <p className="text-xl font-bold">Daily Slate</p>
            <p className="text-gray-300 text-sm mt-1">Make your picks for today</p>
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