import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Get today's games that have started
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('game_date', today)

    if (!games || games.length === 0) {
      return Response.json({ message: 'No games today' })
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

      await supabase
        .from('games')
        .update({
          away_score: awayScore,
          home_score: homeScore,
          status: detailedState || status
        })
        .eq('id', game.id)

      // If game is final, update pick results
      if (status === 'Final' || detailedState === 'Final' || detailedState === 'Game Over') {
        const { data: picks } = await supabase
          .from('picks')
          .select('*')
          .eq('game_id', game.id)
          .eq('result', 'pending')

        for (const pick of picks || []) {
          let result = 'loss'

          if (pick.pick_type === 'ml_rl') {
            if (pick.pick.includes('ML')) {
              const teamName = pick.pick.replace(' ML', '')
              const awayWon = awayScore > homeScore
              const homeWon = homeScore > awayScore
              if (teamName === game.away_team && awayWon) result = 'win'
              if (teamName === game.home_team && homeWon) result = 'win'
            } else if (pick.pick.includes('RL')) {
              const parts = pick.pick.split(' RL ')
              const teamName = parts[0]
              const line = parseFloat(parts[1])
              const awayMargin = awayScore - homeScore
              const homeMargin = homeScore - awayScore
              if (teamName === game.away_team && (awayMargin + line) > 0) result = 'win'
              if (teamName === game.home_team && (homeMargin + line) > 0) result = 'win'
            }
          } else if (pick.pick_type === 'over_under') {
            const totalRuns = awayScore + homeScore
            const line = parseFloat(pick.pick.split(' ')[1])
            if (pick.pick.startsWith('Over') && totalRuns > line) result = 'win'
            if (pick.pick.startsWith('Under') && totalRuns < line) result = 'loss'
            if (totalRuns === line) result = 'push'
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