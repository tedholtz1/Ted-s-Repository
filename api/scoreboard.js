export default async function handler(req, res) {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';
    const response = await fetch(url, {
      headers: {
        'user-agent': 'march-madness-office-challenge/1.0',
        'accept': 'application/json'
      }
    });
    if (!response.ok) {
      res.status(response.status).json({ error: 'Could not reach ESPN scoreboard feed.' });
      return;
    }

    const data = await response.json();
    const updatedGames = (data.events || []).map(event => {
      const comp = event.competitions?.[0];
      const competitors = comp?.competitors || [];
      const home = competitors[0];
      const away = competitors[1];
      const winner = competitors.find(c => c.winner);
      return {
        id: event.id,
        teamA: away?.team?.displayName || away?.team?.shortDisplayName,
        teamB: home?.team?.displayName || home?.team?.shortDisplayName,
        scoreA: away?.score ? Number(away.score) : null,
        scoreB: home?.score ? Number(home.score) : null,
        completed: comp?.status?.type?.completed || false,
        status: comp?.status?.type?.shortDetail || comp?.status?.type?.description || 'Scheduled',
        winner: winner?.team?.displayName || winner?.team?.shortDisplayName || null,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=90');
    res.status(200).json({ updatedGames });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
