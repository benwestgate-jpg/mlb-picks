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
  const [activeTab, setActiveTab] = useState('users')
  const [newPoolName, setNewPoolName] = useState('')
  const [oddsFormat, setOddsFormat] = useState('american')
  const [leaderboardSort, setLeaderboardSort] = useState('points')
  const [scoringType, setScoringType] = useState('points')
  const [countLosses, setCountLosses] = useState('true')
  const [dailyBalance, setDailyBalance] = useState(1000)
  const [parlayEnabled, setParlayEnabled] = useState('false')
  const [parlayMaxPicks, setParlayMaxPicks] = useState(4)
  const [pickLimitEnabled, setPickLimitEnabled] = useState(false)
  const [pickLimitPct, setPickLimitPct] = useState(50)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState('')
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
      setNewDisplayName(mem.username || '')
      setOddsFormat(mem.pools?.odds_format || 'american')
      setLeaderboardSort(mem.pools?.leaderboard_sort || 'points')
      setScoringType(mem.pools?.scoring_type || 'points')
      setCountLosses(mem.pools?.count_losses?.toString() || 'true')
      setDailyBalance(mem.pools?.daily_balance || 1000)
      setParlayEnabled(mem.pools?.parlay_enabled?.toString() || 'false')
      setParlayMaxPicks(mem.pools?.parlay_max_picks || 4)
      setPickLimitEnabled(!!mem.pools?.pick_limit_pct)
      setPickLimitPct(mem.pools?.pick_limit_pct || 50)
      setStartDate(mem.pools?.start_date || '')
      setEndDate(mem.pools?.end_date || '')

      const { data: allMembers } = await supabase
        .from('pool_members')
        .select('*')
        .eq('pool_id', mem.pool_id)

      setMembers(allMembers || [])
      setLoading(false)
    }
    init()
  }, [])

  const showMessage = (msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }

  // Check if pool has started — lock scoring settings
  const poolStarted = pool?.start_date && new Date().toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' }) >= pool.start_date

  const handleSavePoolName = async () => {
    setSaving(true)
    const { error } = await supabase.from('pools').update({ name: newPoolName }).eq('id', pool.id)
    if (error) showMessage('Error saving: ' + error.message)
    else { setPool(prev => ({ ...prev, name: newPoolName })); showMessage('Pool name updated!') }
    setSaving(false)
  }

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim()) return
    const { error } = await supabase.from('pool_members').update({ username: newDisplayName.trim() }).eq('id', membership.id)
    if (error) showMessage('Error saving: ' + error.message)
    else {
      setMembership(prev => ({ ...prev, username: newDisplayName.trim() }))
      setMembers(prev => prev.map(m => m.id === membership.id ? { ...m, username: newDisplayName.trim() } : m))
      setShowNameModal(false)
      showMessage('Display name updated!')
    }
  }

  const handleSaveScoring = async () => {
    if (poolStarted) return
    const { error } = await supabase.from('pools').update({
      scoring_type: scoringType,
      odds_format: oddsFormat,
      leaderboard_sort: scoringType,
      daily_balance: dailyBalance,
      count_losses: countLosses,
      parlay_enabled: parlayEnabled,
      parlay_max_picks: parlayMaxPicks,
      pick_limit_pct: pickLimitEnabled ? pickLimitPct : null,
    }).eq('id', pool.id)
    if (error) showMessage('Error saving: ' + error.message)
    else {
      setPool(prev => ({ ...prev, scoring_type: scoringType, odds_format: oddsFormat, leaderboard_sort: scoringType, daily_balance: dailyBalance, count_losses: countLosses, parlay_enabled: parlayEnabled, parlay_max_picks: parlayMaxPicks, pick_limit_pct: pickLimitEnabled ? pickLimitPct : null }))
      showMessage('Scoring settings saved!')
    }
  }

  const handleSaveTimeline = async () => {
    if (poolStarted) return
    const { error } = await supabase.from('pools').update({
      start_date: startDate || null,
      end_date: endDate || null,
    }).eq('id', pool.id)
    if (error) showMessage('Error saving: ' + error.message)
    else { setPool(prev => ({ ...prev, start_date: startDate, end_date: endDate })); showMessage('Timeline saved!') }
  }

  const handleOddsFormat = async (format) => {
    setOddsFormat(format)
  }

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove this member from the pool?')) return
    await supabase.from('pool_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
    showMessage('Member removed!')
  }

  const handleLeavePool = async () => {
    if (!confirm('Are you sure you want to leave this pool? You will need a new invite code to rejoin.')) return
    await supabase.from('pool_members').delete().eq('id', membership.id)
    router.push('/pools')
  }

  const handleDeletePool = async () => {
    if (!confirm('Are you sure you want to permanently delete this pool? This cannot be undone.')) return
    await supabase.from('pool_members').delete().eq('pool_id', pool.id)
    await supabase.from('pools').delete().eq('id', pool.id)
    router.push('/pools')
  }

  const handleRegenerateCode = async () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    await supabase.from('pools').update({ invite_code: newCode }).eq('id', pool.id)
    setPool(prev => ({ ...prev, invite_code: newCode }))
    showMessage('New invite code generated!')
  }

  if (loading) return <div className="min-h-screen bg-gray-900"></div>

  const tabs = isAdmin ? ['users', 'scoring', 'timeline', 'games', 'corrections'] : ['users']
  const tabLabels = { users: '👥 Users', scoring: '📊 Scoring', timeline: '📅 Timeline', games: '⚾ Games', corrections: '🔧 Corrections' }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">

        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">⚙️ Settings</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700">Back</button>
        </div>
        <p className="text-gray-400 text-sm mb-6">{pool?.name} · {membership?.role}</p>

        {message && (
          <div className="bg-green-800 text-green-200 px-4 py-3 rounded mb-6">{message}</div>
        )}

        {/* Display Name Modal */}
        {showNameModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm mx-4">
              <h2 className="text-lg font-bold mb-4">Change Display Name</h2>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveDisplayName()}
                className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 mb-4"
                placeholder="Enter new display name"
                maxLength={20}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowNameModal(false)} className="flex-1 bg-gray-600 px-4 py-2 rounded hover:bg-gray-700 font-bold">Cancel</button>
                <button onClick={handleSaveDisplayName} className="flex-1 bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 font-bold">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex mb-6 bg-gray-800 rounded-lg p-1 gap-1 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-md font-bold text-xs transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-bold mb-3">Members ({members.length})</h2>
              <div className="space-y-2">
                {members.map(member => (
                  <div key={member.id} className="flex justify-between items-center bg-gray-700 rounded px-3 py-2">
                    <div>
                      <p className="font-bold">
                        {member.role === 'admin' && <span className="mr-1">👑</span>}
                        {member.username}
                        {member.user_id === user.id && <span className="text-blue-400 text-xs ml-2">(you)</span>}
                      </p>
                      <p className="text-gray-400 text-xs">{member.role}</p>
                    </div>
                    {isAdmin && member.user_id !== user.id && (
                      <button onClick={() => handleRemoveMember(member.id)} className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1 rounded font-bold">Kick</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {!isAdmin && (
              <div className="flex gap-3">
                <button onClick={() => setShowNameModal(true)} className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-lg font-bold">✏️ Change Display Name</button>
                <button onClick={handleLeavePool} className="flex-1 bg-red-700 hover:bg-red-600 px-4 py-3 rounded-lg font-bold">🚪 Leave Pool</button>
              </div>
            )}

            {isAdmin && (
              <>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-bold mb-3">Invite Code</h2>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl font-bold text-blue-400 tracking-widest">{pool?.invite_code}</span>
                    <button onClick={() => { navigator.clipboard.writeText(pool?.invite_code); showMessage('Copied!') }} className="bg-gray-600 px-3 py-1 rounded text-sm hover:bg-gray-700">Copy</button>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">Share this code with friends to invite them</p>
                  <button onClick={handleRegenerateCode} className="bg-yellow-600 px-4 py-2 rounded hover:bg-yellow-700 font-bold text-sm">Regenerate Code</button>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-bold mb-3">Pool Name</h2>
                  <div className="flex gap-2">
                    <input type="text" value={newPoolName} onChange={(e) => setNewPoolName(e.target.value)} className="flex-1 p-3 rounded bg-gray-700 text-white border border-gray-600" />
                    <button onClick={handleSavePoolName} disabled={saving} className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">Save</button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowNameModal(true)} className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-lg font-bold">✏️ Change Display Name</button>
                  <button onClick={handleDeletePool} className="flex-1 bg-red-700 hover:bg-red-600 px-4 py-3 rounded-lg font-bold">🗑️ Delete Pool</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* SCORING TAB */}
        {activeTab === 'scoring' && (
          <div className="space-y-4">
            {poolStarted && (
              <div className="bg-yellow-900 border border-yellow-600 rounded-lg px-4 py-3 text-yellow-200 text-sm font-bold">
                🔒 Pool has started — scoring settings are locked
              </div>
            )}

            <div className={`space-y-4 ${poolStarted ? 'opacity-50 pointer-events-none' : ''}`}>

              {/* Scoring Type */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-bold mb-1">Scoring Type</h2>
                <p className="text-gray-400 text-sm mb-4">How this pool determines the winner</p>
                <div className="flex gap-2">
                  {[
                    { key: 'points', label: '💰 Points', sub: 'Stake-based' },
                    { key: 'wins', label: '🏆 Wins', sub: 'Total wins' },
                    { key: 'winpct', label: '📊 Win %', sub: 'Win rate' },
                  ].map(({ key, label, sub }) => (
                    <button
                      key={key}
                      onClick={() => setScoringType(key)}
                      className={`flex-1 p-3 rounded font-bold text-sm ${scoringType === key ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      {label}
                      <p className="text-xs font-normal mt-1 text-gray-300">{sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Odds Format — only for points */}
              {scoringType === 'points' && (
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-bold mb-1">Odds Format</h2>
                  <p className="text-gray-400 text-sm mb-4">How odds are displayed to all pool members</p>
                  <div className="flex gap-3">
                    <button onClick={() => handleOddsFormat('american')} className={`flex-1 p-3 rounded font-bold ${oddsFormat === 'american' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      American
                      <p className="text-sm font-normal mt-1">+150 / -180</p>
                    </button>
                    <button onClick={() => handleOddsFormat('multiplier')} className={`flex-1 p-3 rounded font-bold ${oddsFormat === 'multiplier' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      Multiplier
                      <p className="text-sm font-normal mt-1">2.50x / 1.56x</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Points-specific */}
              {scoringType === 'points' && (
                <>
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h2 className="text-lg font-bold mb-1">Daily Balance</h2>
                    <p className="text-gray-400 text-sm mb-4">Points each player gets to stake per day</p>
                    <div className="flex gap-2 flex-wrap">
                      {[100, 200, 500, 1000, 2000, 5000].map(val => (
                        <button key={val} onClick={() => setDailyBalance(val)} className={`px-4 py-2 rounded font-bold text-sm ${dailyBalance === val ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>{val}</button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h2 className="text-lg font-bold mb-1">Count Losses?</h2>
                    <p className="text-gray-400 text-sm mb-4">When enabled, losses deduct your stake. When disabled, losses count as 0.</p>
                    <div className="flex gap-3">
                      <button onClick={() => setCountLosses('true')} className={`flex-1 p-3 rounded font-bold ${countLosses === 'true' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                        Yes
                        <p className="text-sm font-normal mt-1">Losses = -stake</p>
                      </button>
                      <button onClick={() => setCountLosses('false')} className={`flex-1 p-3 rounded font-bold ${countLosses === 'false' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                        No
                        <p className="text-sm font-normal mt-1">Losses = 0 pts</p>
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h2 className="text-lg font-bold mb-1">Parlays</h2>
                    <p className="text-gray-400 text-sm mb-4">Allow players to combine picks into parlays</p>
                    <div className="flex gap-3 mb-3">
                      <button onClick={() => setParlayEnabled('true')} className={`flex-1 p-3 rounded font-bold ${parlayEnabled === 'true' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Allowed</button>
                      <button onClick={() => setParlayEnabled('false')} className={`flex-1 p-3 rounded font-bold ${parlayEnabled === 'false' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Not Allowed</button>
                    </div>
                    {parlayEnabled === 'true' && (
                      <>
                        <p className="text-gray-400 text-sm mb-2">Max parlay picks</p>
                        <div className="flex gap-2">
                          {[2, 3, 4, 5, 6].map(val => (
                            <button key={val} onClick={() => setParlayMaxPicks(val)} className={`flex-1 py-2 rounded font-bold text-sm ${parlayMaxPicks === val ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>{val}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Win% specific */}
              {scoringType === 'winpct' && (
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-bold mb-1">Pick % Threshold</h2>
                  <p className="text-gray-400 text-sm mb-4">Players below this pick rate are marked disqualified on the leaderboard</p>
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => setPickLimitEnabled(!pickLimitEnabled)} className={`px-4 py-2 rounded font-bold text-sm ${pickLimitEnabled ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      {pickLimitEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  {pickLimitEnabled && (
                    <div className="flex gap-2 flex-wrap">
                      {[25, 50, 75, 100, 125, 150].map(val => (
                        <button key={val} onClick={() => setPickLimitPct(val)} className={`px-3 py-2 rounded font-bold text-sm ${pickLimitPct === val ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>{val}%</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {!poolStarted && (
              <button onClick={handleSaveScoring} className="w-full p-3 bg-blue-600 rounded font-bold hover:bg-blue-700">
                Save Scoring Settings
              </button>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            {poolStarted && (
              <div className="bg-yellow-900 border border-yellow-600 rounded-lg px-4 py-3 text-yellow-200 text-sm font-bold">
                🔒 Pool has started — timeline is locked
              </div>
            )}

            <div className={`space-y-4 ${poolStarted ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-bold mb-1">Start Date</h2>
                <p className="text-gray-400 text-sm mb-3">Players can't make picks until this date. Leave blank for open-ended.</p>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
                />
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-bold mb-1">End Date</h2>
                <p className="text-gray-400 text-sm mb-3">Pool freezes after this date. Leave blank for open-ended.</p>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
                />
              </div>
            </div>

            {!poolStarted && (
              <button onClick={handleSaveTimeline} className="w-full p-3 bg-blue-600 rounded font-bold hover:bg-blue-700">
                Save Timeline
              </button>
            )}
          </div>
        )}

        {/* GAMES TAB */}
        {activeTab === 'games' && (
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <p className="text-4xl mb-3">⚾</p>
            <h2 className="text-lg font-bold mb-2">Games Management</h2>
            <p className="text-gray-400 text-sm">Game delay detection and manual unlock controls coming soon.</p>
            <p className="text-gray-400 text-sm mt-2">Delayed games will be auto-detected via the MLB API score updates.</p>
          </div>
        )}

        {/* CORRECTIONS TAB */}
        {activeTab === 'corrections' && (
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <p className="text-4xl mb-3">🔧</p>
            <h2 className="text-lg font-bold mb-2">Stat Corrections</h2>
            <p className="text-gray-400 text-sm">Manual pick correction tools coming soon.</p>
          </div>
        )}

      </div>
    </div>
  )
}