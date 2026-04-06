import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  try {
    const todayUTC = new Date().toISOString().split('T')[0]
    const yesterdayUTC = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Get today's AND yesterday's games (for late night games)
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .in('game_date', [todayUTC, yesterdayUTC])

    if (!games || games.length === 0) {
      return Response.json({ message: 'No games found' })
    }

    let updatedCount = 0

    for (const game of games) {
      if (!game.game_pk) continue

      const url = `https://statsapi.mlb.com/api/v1.1/game/${game.game_pk}/feed/live`
      const res = await fetch(url)
      const data = await res.json()

      const status = data.gameData?.status?.abstractGameState
      const detailedState = data.gameData?.status?.detailedState
      const linescore = data.liveData?.linescore
      const awayScore = linescore?.teams?.away?.runs ?? null
      const homeScore = linescore?.teams?.home?.runs ?? null

      // Check for postponed/suspended — auto-void all picks
      const isPostponed = detailedState === 'Postponed' || detailedState === 'Suspended'

      await supabase
        .from('games')
        .update({
          away_score: awayScore,
          home_score: homeScore,
          status: detailedState || status
        })
        .eq('id', game.id)

      // Void all picks if postponed
      if (isPostponed) {
        await supabase
          .from('picks')
          .update({ result: 'push' })
          .eq('game_id', game.id)
          .eq('result', 'pending')
        updatedCount++
        continue
      }

      const isFinal = status === 'Final' || detailedState === 'Final' || detailedState === 'Game Over'

      if (isFinal && awayScore !== null && homeScore !== null) {
        const { data: picks } = await supabase
          .from('picks')
          .select('*')
          .eq('game_id', game.id)
          .eq('result', 'pending')

        for (const pick of picks || []) {
          let result = 'loss'

          if (pick.pick_type === 'ml_rl') {
            if (pick.pick.includes(' ML')) {
              const teamName = pick.pick.replace(' ML', '')
              if (awayScore === homeScore) {
                result = 'push' // tie game (rare but possible)
              } else if (teamName === game.away_team && awayScore > homeScore) {
                result = 'win'
              } else if (teamName === game.home_team && homeScore > awayScore) {
                result = 'win'
              }
            } else if (pick.pick.includes(' RL ')) {
              const parts = pick.pick.split(' RL ')
              const teamName = parts[0]
              const line = parseFloat(parts[1])
              let margin = 0
              if (teamName === game.away_team) margin = awayScore - homeScore
              if (teamName === game.home_team) margin = homeScore - awayScore
              const covered = margin + line
              if (covered > 0) result = 'win'
              else if (covered === 0) result = 'push'
              else result = 'loss'
            }
          } else if (pick.pick_type === 'over_under') {
            const totalRuns = awayScore + homeScore
            const line = game.over_under ?? parseFloat(pick.pick.split(' ')[1])
            if (totalRuns === line) {
              result = 'push'
            } else if (pick.pick.startsWith('Over') && totalRuns > line) {
              result = 'win'
            } else {
              result = 'loss'
            }
          }

          await supabase
            .from('picks')
            .update({ result })
            .eq('id', pick.id)
        }
        updatedCount++
      }
    }

    return Response.json({ success: true, games_checked: games.length, games_finalized: updatedCount })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}