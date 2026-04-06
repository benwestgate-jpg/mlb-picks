'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Pools() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null) // 'create' or 'join'
  const [step, setStep] = useState(1) // creation step 1-4
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Join fields
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')

  // Step 1 — Basics
  const [poolName, setPoolName] = useState('')
  const [displayName, setDisplayName] = useState('')

  // Step 2 — Scoring
  const [scoringType, setScoringType] = useState('points')
  const [oddsFormat, setOddsFormat] = useState('american')
  const [dailyBalance, setDailyBalance] = useState(1000)
  const [countLosses, setCountLosses] = useState('true')
  const [leaderboardSort, setLeaderboardSort] = useState('points')
  const [parlayEnabled, setParlayEnabled] = useState('false')
  const [parlayMaxPicks, setParlayMaxPicks] = useState(4)
  const [pickLimitEnabled, setPickLimitEnabled] = useState(false)
  const [pickLimitPct, setPickLimitPct] = useState(50)

  // Step 3 — Timeline
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)

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

  const generateInviteCode = () => Math.random().toString(36).substring(2, 8).toUpperCase()

  const handleCreate = async () => {
    setSubmitting(true)
    setError(null)

    const code = generateInviteCode()

    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({
        name: poolName,
        created_by: user.id,
        invite_code: code,
        scoring_type: scoringType,
        odds_format: oddsFormat,
        daily_balance: dailyBalance,
        count_losses: countLosses,
        leaderboard_sort: leaderboardSort,
        parlay_enabled: parlayEnabled,
        parlay_max_picks: parlayMaxPicks,
        pick_limit_pct: pickLimitEnabled ? pickLimitPct : null,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .select()
      .single()

    if (poolError) { setError(poolError.message); setSubmitting(false); return }

    const { error: memberError } = await supabase
      .from('pool_members')
      .insert({ pool_id: pool.id, user_id: user.id, role: 'admin', username: displayName })

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

  const canProceedStep1 = poolName.trim() && displayName.trim()
  const canProceedStep3 = true // timeline is optional

  if (loading) return <div className="min-h-screen bg-gray-900"></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">⚾ Westgate Book Pick'em</h1>
        <p className="text-gray-400 text-center mb-8">Join or create a pool to get started</p>

        {/* Mode Selection */}
        {!mode && (
          <div className="space-y-4">
            <button
              onClick={() => { setMode('create'); setStep(1) }}
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

        {/* JOIN FLOW */}
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
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
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

        {/* CREATE FLOW */}
        {mode === 'create' && (
          <div className="bg-gray-800 rounded-lg p-6">

            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-6">
              {['Basics', 'Scoring', 'Timeline', 'Review'].map((label, i) => (
                <div key={i} className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-400'}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`ml-1 text-xs ${step === i + 1 ? 'text-white' : 'text-gray-500'}`}>{label}</span>
                  {i < 3 && <div className="w-4 h-px bg-gray-600 mx-2" />}
                </div>
              ))}
            </div>

            {error && <p className="text-red-400 mb-4">{error}</p>}

            {/* STEP 1 — Basics */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold mb-2">Pool Basics</h2>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Your display name</label>
                  <input
                    type="text"
                    placeholder="e.g. Gate"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Pool name</label>
                  <input
                    type="text"
                    placeholder="e.g. The Biesbol Crew"
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
                    maxLength={30}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setMode(null); setError(null) }} className="flex-1 p-3 bg-gray-600 rounded font-bold hover:bg-gray-700">Back</button>
                  <button
                    onClick={() => { if (canProceedStep1) { setStep(2); setError(null) } else setError('Please fill in all fields') }}
                    className="flex-1 p-3 bg-blue-600 rounded font-bold hover:bg-blue-700"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 — Scoring */}
            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-lg font-bold mb-2">Scoring Settings</h2>

                {/* Scoring Type */}
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Scoring type</label>
                  <div className="flex gap-2">
                    {[
                      { key: 'points', label: '💰 Points', sub: 'Stake-based scoring' },
                      { key: 'wins', label: '🏆 Wins', sub: 'Total wins only' },
                      { key: 'winpct', label: '📊 Win %', sub: 'Win percentage' },
                    ].map(({ key, label, sub }) => (
                      <button
                        key={key}
                        onClick={() => { setScoringType(key); setLeaderboardSort(key) }}
                        className={`flex-1 p-3 rounded text-sm font-bold ${scoringType === key ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                      >
                        {label}
                        <p className="text-xs font-normal mt-1 text-gray-300">{sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Odds Format */}
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Odds format</label>
                  <div className="flex gap-2">
                    <button onClick={() => setOddsFormat('american')} className={`flex-1 p-3 rounded font-bold text-sm ${oddsFormat === 'american' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      American
                      <p className="text-xs font-normal mt-1">+150 / -180</p>
                    </button>
                    <button onClick={() => setOddsFormat('multiplier')} className={`flex-1 p-3 rounded font-bold text-sm ${oddsFormat === 'multiplier' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      Multiplier
                      <p className="text-xs font-normal mt-1">2.50x / 1.56x</p>
                    </button>
                  </div>
                </div>

                {/* Points-specific settings */}
                {scoringType === 'points' && (
                  <>
                    <div>
                      <label className="text-gray-400 text-sm mb-2 block">Daily balance (resets with odds each day)</label>
                      <div className="flex gap-2 flex-wrap">
                        {[100, 200, 500, 1000, 2000, 5000].map(val => (
                          <button
                            key={val}
                            onClick={() => setDailyBalance(val)}
                            className={`px-4 py-2 rounded font-bold text-sm ${dailyBalance === val ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm mb-2 block">Count losses?</label>
                      <div className="flex gap-2">
                        <button onClick={() => setCountLosses('true')} className={`flex-1 p-3 rounded font-bold text-sm ${countLosses === 'true' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                          Yes
                          <p className="text-xs font-normal mt-1">Losses deduct stake</p>
                        </button>
                        <button onClick={() => setCountLosses('false')} className={`flex-1 p-3 rounded font-bold text-sm ${countLosses === 'false' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                          No
                          <p className="text-xs font-normal mt-1">Losses = 0 pts</p>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm mb-2 block">Allow parlays?</label>
                      <div className="flex gap-2">
                        <button onClick={() => setParlayEnabled('true')} className={`flex-1 p-3 rounded font-bold text-sm ${parlayEnabled === 'true' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                          Yes
                        </button>
                        <button onClick={() => setParlayEnabled('false')} className={`flex-1 p-3 rounded font-bold text-sm ${parlayEnabled === 'false' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                          No
                        </button>
                      </div>
                      {parlayEnabled === 'true' && (
                        <div className="mt-3">
                          <label className="text-gray-400 text-sm mb-2 block">Max parlay picks</label>
                          <div className="flex gap-2">
                            {[2, 3, 4, 5, 6].map(val => (
                              <button
                                key={val}
                                onClick={() => setParlayMaxPicks(val)}
                                className={`flex-1 py-2 rounded font-bold text-sm ${parlayMaxPicks === val ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Win% specific settings */}
                {scoringType === 'winpct' && (
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Pick % threshold (disqualify below this)</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPickLimitEnabled(!pickLimitEnabled)} className={`px-4 py-2 rounded font-bold text-sm ${pickLimitEnabled ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                        {pickLimitEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                      {pickLimitEnabled && (
                        <div className="flex gap-2 flex-wrap">
                          {[25, 50, 75, 100, 125, 150].map(val => (
                            <button
                              key={val}
                              onClick={() => setPickLimitPct(val)}
                              className={`px-3 py-2 rounded font-bold text-sm ${pickLimitPct === val ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                            >
                              {val}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button onClick={() => setStep(1)} className="flex-1 p-3 bg-gray-600 rounded font-bold hover:bg-gray-700">← Back</button>
                  <button onClick={() => { setStep(3); setError(null) }} className="flex-1 p-3 bg-blue-600 rounded font-bold hover:bg-blue-700">Next →</button>
                </div>
              </div>
            )}

            {/* STEP 3 — Timeline */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold mb-2">Pool Timeline</h2>
                <p className="text-gray-400 text-sm">Optional — leave blank for an open-ended pool</p>

                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600"
                  />
                </div>

                {startDate && (
                  <div className="bg-gray-700 rounded p-3 text-sm text-gray-300">
                    ⏳ Players will see a countdown timer until <span className="text-white font-bold">{new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button onClick={() => setStep(2)} className="flex-1 p-3 bg-gray-600 rounded font-bold hover:bg-gray-700">← Back</button>
                  <button onClick={() => { setStep(4); setError(null) }} className="flex-1 p-3 bg-blue-600 rounded font-bold hover:bg-blue-700">Next →</button>
                </div>
              </div>
            )}

            {/* STEP 4 — Review */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold mb-2">Review & Create</h2>

                <div className="bg-gray-700 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pool name</span>
                    <span className="font-bold">{poolName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Your name</span>
                    <span className="font-bold">{displayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Scoring</span>
                    <span className="font-bold capitalize">{scoringType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Odds format</span>
                    <span className="font-bold capitalize">{oddsFormat}</span>
                  </div>
                  {scoringType === 'points' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Daily balance</span>
                        <span className="font-bold">{dailyBalance} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Count losses</span>
                        <span className="font-bold">{countLosses === 'true' ? 'Yes (-stake)' : 'No (0 pts)'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Parlays</span>
                        <span className="font-bold">{parlayEnabled === 'true' ? `Yes (max ${parlayMaxPicks})` : 'No'}</span>
                      </div>
                    </>
                  )}
                  {scoringType === 'winpct' && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pick % threshold</span>
                      <span className="font-bold">{pickLimitEnabled ? `${pickLimitPct}%` : 'None'}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Start date</span>
                    <span className="font-bold">{startDate || 'Open-ended'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">End date</span>
                    <span className="font-bold">{endDate || 'Open-ended'}</span>
                  </div>
                </div>

                <p className="text-gray-400 text-xs text-center">Settings can be changed in admin settings after creation</p>

                {error && <p className="text-red-400">{error}</p>}

                <div className="flex gap-2">
                  <button onClick={() => setStep(3)} className="flex-1 p-3 bg-gray-600 rounded font-bold hover:bg-gray-700">← Back</button>
                  <button
                    onClick={handleCreate}
                    disabled={submitting}
                    className="flex-1 p-3 bg-green-600 rounded font-bold hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : '🏆 Create Pool'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}