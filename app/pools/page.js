'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Pools() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null) // 'create' or 'join'
  const [poolName, setPoolName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)

      // Check if already in a pool
      const { data: membership } = await supabase
        .from('pool_members')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)

      if (membership && membership.length > 0) {
        router.push('/dashboard')
        return
      }

      setLoading(false)
    }
    init()
  }, [])

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreate = async () => {
    if (!poolName.trim() || !username.trim()) {
      setError('Please fill in all fields')
      return
    }
    setSubmitting(true)
    setError(null)

    const code = generateInviteCode()

    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({ name: poolName, created_by: user.id, invite_code: code })
      .select()
      .single()

    if (poolError) { setError(poolError.message); setSubmitting(false); return }

    const { error: memberError } = await supabase
      .from('pool_members')
      .insert({ pool_id: pool.id, user_id: user.id, role: 'admin', username })

    if (memberError) { setError(memberError.message); setSubmitting(false); return }

    router.push('/dashboard')
  }

  const handleJoin = async () => {
    if (!inviteCode.trim() || !username.trim()) {
      setError('Please fill in all fields')
      return
    }
    setSubmitting(true)
    setError(null)

    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (poolError || !pool) {
      setError('Invalid invite code — double check and try again!')
      setSubmitting(false)
      return
    }

    const { error: memberError } = await supabase
      .from('pool_members')
      .insert({ pool_id: pool.id, user_id: user.id, role: 'member', username })

    if (memberError) { setError(memberError.message); setSubmitting(false); return }

    router.push('/dashboard')
  }

  if (loading) return <div className="min-h-screen bg-gray-900"></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">⚾ Westgate Book Pick'em</h1>
        <p className="text-gray-400 text-center mb-8">Join or create a pool to get started</p>

        {!mode && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full p-6 bg-blue-600 rounded-lg text-center hover:bg-blue-700"
            >
              <p className="text-2xl mb-2">🏆</p>
              <p className="text-xl font-bold">Create a Pool</p>
              <p className="text-gray-300 text-sm mt-1">Start a new pool and invite your friends</p>
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full p-6 bg-green-700 rounded-lg text-center hover:bg-green-800"
            >
              <p className="text-2xl mb-2">🤝</p>
              <p className="text-xl font-bold">Join a Pool</p>
              <p className="text-gray-300 text-sm mt-1">Enter an invite code to join an existing pool</p>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Create a Pool</h2>
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Your display name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
              />
              <input
                type="text"
                placeholder="Pool name (e.g. The Biesbol Crew)"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
              />
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="w-full p-3 bg-blue-600 rounded font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Pool'}
              </button>
              <button
                onClick={() => { setMode(null); setError(null) }}
                className="w-full p-3 bg-gray-600 rounded font-bold hover:bg-gray-700"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Join a Pool</h2>
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Your display name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
              />
              <input
                type="text"
                placeholder="Invite code (e.g. ABC123)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
              />
              <button
                onClick={handleJoin}
                disabled={submitting}
                className="w-full p-3 bg-green-600 rounded font-bold hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Joining...' : 'Join Pool'}
              </button>
              <button
                onClick={() => { setMode(null); setError(null) }}
                className="w-full p-3 bg-gray-600 rounded font-bold hover:bg-gray-700"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}