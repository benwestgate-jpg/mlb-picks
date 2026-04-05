'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Settings() {
  const [user, setUser] = useState(null)
  const [membership, setMembership] = useState(null)
  const [pool, setPool] = useState(null)
  const [members, setMembers] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newPoolName, setNewPoolName] = useState('')
  const [oddsFormat, setOddsFormat] = useState('american')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
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
      setPool(mem.pools)
      setIsAdmin(mem.role === 'admin')
      setNewPoolName(mem.pools?.name || '')
      setOddsFormat(mem.pools?.odds_format || 'american')

      const { data: allMembers } = await supabase
        .from('pool_members')
        .select('*')
        .eq('pool_id', mem.pool_id)

      setMembers(allMembers || [])
      setLoading(false)
    }
    init()
  }, [])

  const handleSavePoolName = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('pools')
      .update({ name: newPoolName })
      .eq('id', pool.id)
    if (error) setMessage('Error saving: ' + error.message)
    else setMessage('Pool name updated!')
    setSaving(false)
  }

  const handleOddsFormat = async (format) => {
    setOddsFormat(format)
    await supabase
      .from('pools')
      .update({ odds_format: format })
      .eq('id', pool.id)
    setMessage('Odds format updated!')
  }

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove this member from the pool?')) return
    await supabase.from('pool_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setMessage('Member removed!')
  }

  const handleLeavePool = async () => {
    if (!confirm('Are you sure you want to leave this pool? You will need a new invite code to rejoin.')) return
    await supabase.from('pool_members').delete().eq('id', membership.id)
    router.push('/pools')
  }

  const handleDeletePool = async () => {
    if (!confirm('Are you sure you want to permanently delete this pool? This will remove all members and cannot be undone.')) return
    await supabase.from('pool_members').delete().eq('pool_id', pool.id)
    await supabase.from('pools').delete().eq('id', pool.id)
    router.push('/pools')
  }

  const handleRegenerateCode = async () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    await supabase.from('pools').update({ invite_code: newCode }).eq('id', pool.id)
    setPool(prev => ({ ...prev, invite_code: newCode }))
    setMessage('New invite code generated!')
  }

  if (loading) return <div className="min-h-screen bg-gray-900"></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">⚙️ Settings</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700">Back</button>
        </div>

        {message && (
          <div className="bg-green-800 text-green-200 px-4 py-3 rounded mb-6">
            {message}
          </div>
        )}

        {/* Pool Info */}
        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <h2 className="text-xl font-bold mb-1">{pool?.name}</h2>
          <p className="text-gray-400 text-sm mb-4">You are a {membership?.role}</p>
          <p className="text-gray-400 text-sm">Your display name: <span className="text-white font-bold">{membership?.username}</span></p>
        </div>

        {/* Invite Code */}
        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <h2 className="text-lg font-bold mb-3">Invite Code</h2>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-blue-400 tracking-widest">{pool?.invite_code}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(pool?.invite_code); setMessage('Copied!') }}
              className="bg-gray-600 px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              Copy
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-2">Share this code with friends to invite them</p>
        </div>

        {/* Members List */}
        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <h2 className="text-lg font-bold mb-3">Members ({members.length})</h2>
          <div className="space-y-2">
            {members.map(member => (
              <div key={member.id} className="flex justify-between items-center bg-gray-700 rounded px-3 py-2">
                <div>
                  <p className="font-bold">{member.username}</p>
                  <p className="text-gray-400 text-xs">{member.role}</p>
                </div>
                {isAdmin && member.user_id !== user.id && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-red-400 text-sm hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Admin Settings */}
        {isAdmin && (
          <>
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h2 className="text-lg font-bold mb-3">Pool Name</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  className="flex-1 p-3 rounded bg-gray-700 text-white border border-gray-600"
                />
                <button
                  onClick={handleSavePoolName}
                  disabled={saving}
                  className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h2 className="text-lg font-bold mb-3">Odds Format</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => handleOddsFormat('american')}
                  className={`flex-1 p-3 rounded font-bold ${oddsFormat === 'american' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  American
                  <p className="text-sm font-normal mt-1">+150 / -180</p>
                </button>
                <button
                  onClick={() => handleOddsFormat('multiplier')}
                  className={`flex-1 p-3 rounded font-bold ${oddsFormat === 'multiplier' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  Multiplier
                  <p className="text-sm font-normal mt-1">2.50x / 1.56x</p>
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h2 className="text-lg font-bold mb-3">Regenerate Invite Code</h2>
              <p className="text-gray-400 text-sm mb-3">This will invalidate the current code</p>
              <button
                onClick={handleRegenerateCode}
                className="bg-yellow-600 px-4 py-2 rounded hover:bg-yellow-700 font-bold"
              >
                Generate New Code
              </button>
            </div>
          </>
        )}

        {/* Leave / Delete Pool */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-3">
            {isAdmin ? 'Delete Pool' : 'Leave Pool'}
          </h2>
          <p className="text-gray-400 text-sm mb-3">
            {isAdmin
              ? 'This will permanently delete the pool and remove all members.'
              : 'You will need a new invite code to rejoin.'}
          </p>
          <button
            onClick={isAdmin ? handleDeletePool : handleLeavePool}
            className="bg-red-600 px-4 py-2 rounded hover:bg-red-700 font-bold"
          >
            {isAdmin ? 'Delete Pool' : 'Leave Pool'}
          </button>
        </div>

      </div>
    </div>
  )
}