import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  try {
    const apiKey = process.env.ODDS_API_KEY

    // Get tomorrow's date in Arizona time
    const now = new Date()
    const tomorrowAZ = new Date(now.toLocaleString('en-US', { timeZone: 'America/Phoenix' }))
    tomorrowAZ.setDate(tomorrowAZ.getDate() + 1)
    const tomorrowStr = tomorrowAZ.toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' })

    // Get tomorrow's games already in Supabase
    const { data: existingGames } = await supabase
      .from('games')
      .select('*')
      .eq('game_date', tomorrowStr)

    if (!existingGames || existingGames.length === 0) {
      return Response.json({ message: 'No games in database for tomorrow — run fetch-games first' })
    }

    // Fetch odds from The Odds API
    const oddsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=draftkings`
    )
    const oddsData = await oddsRes.json()

    if (!oddsData || !Array.isArray(oddsData)) {
      return Response.json({ error: 'No odds data returned' }, { status: 500 })
    }

    let updatedCount = 0

    for (const game of existingGames) {
      // Match odds to game by team names
      const oddsGame = oddsData.find(o =>
        (o.away_team === game.away_team && o.home_team === game.home_team) ||
        (o.away_team.includes(game.away_team.split(' ').pop()) &&
         o.home_team.includes(game.home_team.split(' ').pop()))
      )

      if (!oddsGame) continue

      const dk = oddsGame.bookmakers[0]
      if (!dk) continue

      const h2h = dk.markets.find(m => m.key === 'h2h')
      const spreads = dk.markets.find(m => m.key === 'spreads')
      const totals = dk.markets.find(m => m.key === 'totals')

      const awayTeam = game.away_team
      const homeTeam = game.home_team

      await supabase
        .from('games')
        .update({
          ml_away: h2h?.outcomes.find(o => o.name === oddsGame.away_team)?.price ?? null,
          ml_home: h2h?.outcomes.find(o => o.name === oddsGame.home_team)?.price ?? null,
          rl_away: spreads?.outcomes.find(o => o.name === oddsGame.away_team)?.price ?? null,
          rl_home: spreads?.outcomes.find(o => o.name === oddsGame.home_team)?.price ?? null,
          rl_away_point: spreads?.outcomes.find(o => o.name === oddsGame.away_team)?.point ?? null,
          rl_home_point: spreads?.outcomes.find(o => o.name === oddsGame.home_team)?.point ?? null,
          over_under: totals?.outcomes.find(o => o.name === 'Over')?.point ?? null,
          over_odds: totals?.outcomes.find(o => o.name === 'Over')?.price ?? null,
          under_odds: totals?.outcomes.find(o => o.name === 'Under')?.price ?? null,
        })
        .eq('id', game.id)

      updatedCount++
    }

    return Response.json({
      success: true,
      games_matched: updatedCount,
      total_games: existingGames.length,
      date: tomorrowStr
    })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}