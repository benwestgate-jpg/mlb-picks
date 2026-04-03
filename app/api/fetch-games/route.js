import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  try {
    const apiKey = process.env.ODDS_API_KEY

    // Fetch odds from The Odds API
    const oddsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=draftkings`
    )
    const oddsData = await oddsRes.json()

    if (!oddsData || !Array.isArray(oddsData)) {
      return Response.json({ error: 'No odds data returned' }, { status: 500 })
    }

    // Get tomorrow's date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Filter for tomorrow's games only
    const tomorrowGames = oddsData.filter(game => {
      const gameDate = new Date(game.commence_time).toISOString().split('T')[0]
      return gameDate === tomorrowStr
    })

    // Format and insert into Supabase
    const gamesToInsert = tomorrowGames.map(game => {
      const dk = game.bookmakers[0]
      const h2h = dk?.markets.find(m => m.key === 'h2h')
      const spreads = dk?.markets.find(m => m.key === 'spreads')
      const totals = dk?.markets.find(m => m.key === 'totals')

      const awayTeam = game.away_team
      const homeTeam = game.home_team

      return {
        game_date: tomorrowStr,
        away_team: awayTeam,
        home_team: homeTeam,
game_time: new Date(game.commence_time).toLocaleTimeString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Phoenix'
}),
game_time_utc: game.commence_time,
        ml_away: h2h?.outcomes.find(o => o.name === awayTeam)?.price ?? null,
        ml_home: h2h?.outcomes.find(o => o.name === homeTeam)?.price ?? null,
        rl_away: spreads?.outcomes.find(o => o.name === awayTeam)?.price ?? null,
rl_home: spreads?.outcomes.find(o => o.name === homeTeam)?.price ?? null,
rl_away_point: spreads?.outcomes.find(o => o.name === awayTeam)?.point ?? null,
rl_home_point: spreads?.outcomes.find(o => o.name === homeTeam)?.point ?? null,
        over_under: totals?.outcomes.find(o => o.name === 'Over')?.point ?? null,
        over_odds: totals?.outcomes.find(o => o.name === 'Over')?.price ?? null,
        under_odds: totals?.outcomes.find(o => o.name === 'Under')?.price ?? null,
        away_score: null,
        home_score: null,
        status: 'scheduled',
        game_pk: null
      }
    })

    // Delete tomorrow's existing games first to avoid duplicates
    await supabase.from('games').delete().eq('game_date', tomorrowStr)

    // Insert new games
    const { error } = await supabase.from('games').insert(gamesToInsert)

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ 
      success: true, 
      games_inserted: gamesToInsert.length,
      date: tomorrowStr
    })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}