import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  try {
    // Get tomorrow's date in Arizona time
    const now = new Date()
    const tomorrowAZ = new Date(now.toLocaleString('en-US', { timeZone: 'America/Phoenix' }))
    tomorrowAZ.setDate(tomorrowAZ.getDate() + 1)
    const tomorrowStr = tomorrowAZ.toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' })

    // Fetch ALL tomorrow's games from MLB Stats API (free, no key needed)
    const mlbRes = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${tomorrowStr}`
    )
    const mlbData = await mlbRes.json()

    if (!mlbData.dates || mlbData.dates.length === 0) {
      return Response.json({ message: 'No MLB games found for tomorrow', date: tomorrowStr })
    }

    const games = mlbData.dates[0].games

    const gamesToInsert = games.map(game => {
      const gameTimeUTC = game.gameDate
      const gameTimeAZ = new Date(gameTimeUTC).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Phoenix'
      })

      return {
        game_date: tomorrowStr,
        away_team: game.teams.away.team.name,
        home_team: game.teams.home.team.name,
        game_time: gameTimeAZ,
        game_time_utc: gameTimeUTC,
        game_pk: game.gamePk,
        ml_away: null,
        ml_home: null,
        rl_away: null,
        rl_home: null,
        rl_away_point: null,
        rl_home_point: null,
        over_under: null,
        over_odds: null,
        under_odds: null,
        away_score: null,
        home_score: null,
        status: 'scheduled'
      }
    })

    // Delete tomorrow's existing games first
    await supabase.from('games').delete().eq('game_date', tomorrowStr)

    // Insert all games
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