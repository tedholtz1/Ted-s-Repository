const SUPABASE_URL = window.SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const supabaseReady = !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
const supabase = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const POINTS_BY_ROUND = {
  "First Four": 0,
  "Round of 64": 1,
  "Round of 32": 2,
  "Sweet 16": 4,
  "Elite 8": 8,
  "Final Four": 16,
  "Champion": 32,
};

const regionOrder = ["West", "East", "Midwest", "South"];
let entries = [];
let state = null;

const entryModal = document.getElementById('entry-modal');
const entryForm = document.getElementById('entry-form');
const nameInput = document.getElementById('employee-name');
const teamOne = document.getElementById('team-one');
const teamTwo = document.getElementById('team-two');

function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function normalizeTeam(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(st|state|univ|university)\b/g, (m) => m)
    .trim();
}

function buildTeamOptions(teams) {
  const opts = ['<option value="">Choose a team</option>']
    .concat(teams.map(team => `<option value="${team.name}">${team.seed}. ${team.name} (${team.region})</option>`));
  teamOne.innerHTML = opts.join('');
  teamTwo.innerHTML = opts.join('');
}

function currentRoundForTeam(teamName) {
  const team = state.teams.find(t => t.name === teamName);
  if (!team) return 0;
  return team.advanced_to || 0;
}

function scoreEntry(entry) {
  return [entry.team_one, entry.team_two].reduce((sum, teamName) => {
    const roundIndex = currentRoundForTeam(teamName);
    const points = [0, 1, 2, 4, 8, 16, 32][roundIndex] || 0;
    return sum + points;
  }, 0);
}

function renderLeaderboard() {
  const container = document.getElementById('leaderboard');
  const template = document.getElementById('leaderboard-row-template');
  const sorted = [...entries]
    .map(entry => ({ ...entry, points: scoreEntry(entry) }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  document.getElementById('entry-count').textContent = String(sorted.length);
  if (!sorted.length) {
    container.innerHTML = '<div class="empty-state">No one has entered picks yet.</div>';
    return;
  }

  container.innerHTML = '';
  sorted.forEach((entry, idx) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.rank').textContent = idx + 1;
    node.querySelector('.entrant-name').textContent = entry.name;
    node.querySelector('.entrant-picks').textContent = `${entry.team_one} • ${entry.team_two}`;
    node.querySelector('.score').textContent = entry.points;
    container.appendChild(node);
  });
}

function renderMostPicked() {
  const container = document.getElementById('most-picked');
  const counts = new Map();
  entries.forEach(entry => {
    [entry.team_one, entry.team_two].forEach(team => counts.set(team, (counts.get(team) || 0) + 1));
  });
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">Most-picked teams will appear after entries come in.</div>';
    return;
  }
  container.innerHTML = rows.map(([team, count]) => `
    <div class="most-picked-item">
      <div>
        <strong>${team}</strong>
        <span>${state.teams.find(t => t.name === team)?.region || ''}</span>
      </div>
      <strong>${count}</strong>
    </div>
  `).join('');
}

function gameCard(game) {
  const teamA = state.teams.find(t => t.name === game.teamA);
  const teamB = state.teams.find(t => t.name === game.teamB);
  const winner = game.winner;
  const status = game.status || 'Scheduled';
  const scoreLine = [game.scoreA, game.scoreB].every(v => typeof v === 'number') ? `${game.scoreA}-${game.scoreB}` : status;

  const line = (team, score, isWinner) => `
    <div class="team-line ${winner ? (isWinner ? 'winner' : 'loser') : ''}">
      <div class="seed">${team?.seed || ''}</div>
      <div class="team-name">${team?.name || 'TBD'}</div>
      <div class="team-status">${score ?? ''}</div>
    </div>`;

  return `
    <article class="game-card">
      <div class="game-top">
        <span>${game.region || 'Finals'} • ${game.round}</span>
        <span>${scoreLine}</span>
      </div>
      ${line(teamA, game.scoreA, winner === game.teamA)}
      ${line(teamB, game.scoreB, winner === game.teamB)}
    </article>`;
}

function renderBracket() {
  const bracket = document.getElementById('bracket');
  const byRound = new Map();
  state.games.forEach(game => {
    const key = game.round;
    if (!byRound.has(key)) byRound.set(key, []);
    byRound.get(key).push(game);
  });

  const roundOrder = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8'];
  const leftGames = roundOrder.map(round => byRound.get(round)?.filter(g => ['West', 'East'].includes(g.region)) || []);
  const rightGames = roundOrder.map(round => byRound.get(round)?.filter(g => ['Midwest', 'South'].includes(g.region)) || []);
  const finalFourGames = byRound.get('Final Four') || [];
  const championshipGames = byRound.get('Championship') || [];

  bracket.innerHTML = `
    <div class="bracket-grid">
      <div class="round-col">
        ${roundOrder.map((round, idx) => `
          <div class="round-header"><h3>${round}</h3><p>West + East</p></div>
          ${leftGames[idx].map(gameCard).join('')}
        `).join('')}
      </div>
      <div class="round-col">
        <div class="round-header"><h3>West + East</h3><p>Regional finals and path to Houston</p></div>
        ${state.games.filter(g => g.round === 'Elite 8' && ['West', 'East'].includes(g.region)).map(gameCard).join('')}
        ${finalFourGames.filter(g => ['West Winner', 'East Winner'].includes(g.regionPath)).map(gameCard).join('')}
      </div>
      <div class="center-stack">
        <div class="center-card">
          <div class="eyebrow">National stage</div>
          <h3>Final Four</h3>
          <p>Two semifinals, one title game, one office champion.</p>
        </div>
        ${finalFourGames.map(gameCard).join('')}
        ${championshipGames.map(gameCard).join('')}
      </div>
      <div class="round-col">
        <div class="round-header"><h3>Midwest + South</h3><p>Regional finals and path to Houston</p></div>
        ${state.games.filter(g => g.round === 'Elite 8' && ['Midwest', 'South'].includes(g.region)).map(gameCard).join('')}
        ${finalFourGames.filter(g => ['Midwest Winner', 'South Winner'].includes(g.regionPath)).map(gameCard).join('')}
      </div>
      <div class="round-col">
        ${roundOrder.map((round, idx) => `
          <div class="round-header"><h3>${round}</h3><p>Midwest + South</p></div>
          ${rightGames[idx].map(gameCard).join('')}
        `).join('')}
      </div>
    </div>`;

  document.getElementById('finalized-count').textContent = state.games.filter(g => !!g.winner).length;
  document.getElementById('last-updated').textContent = formatTime(state.updated_at);
}

function recalcAdvancement() {
  state.teams.forEach(team => { team.advanced_to = 0; team.eliminated = false; });
  const roundWeight = { 'Round of 64': 1, 'Round of 32': 2, 'Sweet 16': 3, 'Elite 8': 4, 'Final Four': 5, 'Championship': 6 };

  state.games.forEach(game => {
    if (game.winner) {
      const winnerTeam = state.teams.find(t => t.name === game.winner);
      const loserName = game.winner === game.teamA ? game.teamB : game.teamA;
      const loserTeam = state.teams.find(t => t.name === loserName);
      if (winnerTeam) winnerTeam.advanced_to = Math.max(winnerTeam.advanced_to || 0, roundWeight[game.round] || 0);
      if (loserTeam) loserTeam.eliminated = true;
    }
  });
}

function wireModal() {
  document.getElementById('open-entry-modal').addEventListener('click', () => entryModal.showModal());
  document.getElementById('close-entry-modal').addEventListener('click', () => entryModal.close());
  document.getElementById('cancel-entry').addEventListener('click', () => entryModal.close());

  entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const pick1 = teamOne.value;
    const pick2 = teamTwo.value;
    if (!name || !pick1 || !pick2) return;
    if (pick1 === pick2) {
      alert('Please choose 2 different teams.');
      return;
    }

    const row = { name, team_one: pick1, team_two: pick2 };
    if (supabaseReady) {
      const { error } = await supabase.from('mm_entries').insert(row);
      if (error) {
        alert(`Could not save entry: ${error.message}`);
        return;
      }
      await loadEntries();
    } else {
      const local = JSON.parse(localStorage.getItem('mm_entries') || '[]');
      local.push(row);
      localStorage.setItem('mm_entries', JSON.stringify(local));
      entries = local;
    }

    renderLeaderboard();
    renderMostPicked();
    entryForm.reset();
    entryModal.close();
  });
}

async function loadEntries() {
  if (supabaseReady) {
    const { data, error } = await supabase.from('mm_entries').select('*').order('created_at', { ascending: true });
    if (!error) entries = data || [];
  } else {
    entries = JSON.parse(localStorage.getItem('mm_entries') || '[]');
  }
}

async function loadState() {
  const res = await fetch('./data/bracket-state.json');
  state = await res.json();
  recalcAdvancement();
}

async function refreshLive() {
  const status = document.getElementById('live-status');
  status.textContent = 'Checking live games…';
  try {
    const res = await fetch('/api/scoreboard');
    if (!res.ok) throw new Error('No live feed available in this environment.');
    const live = await res.json();
    if (live.updatedGames?.length) {
      const byKey = new Map(state.games.map(g => [`${normalizeTeam(g.teamA)}__${normalizeTeam(g.teamB)}`, g]));
      for (const update of live.updatedGames) {
        const keys = [
          `${normalizeTeam(update.teamA)}__${normalizeTeam(update.teamB)}`,
          `${normalizeTeam(update.teamB)}__${normalizeTeam(update.teamA)}`,
        ];
        const target = byKey.get(keys[0]) || byKey.get(keys[1]);
        if (!target) continue;
        target.scoreA = normalizeTeam(target.teamA) === normalizeTeam(update.teamA) ? update.scoreA : update.scoreB;
        target.scoreB = normalizeTeam(target.teamB) === normalizeTeam(update.teamB) ? update.scoreB : update.scoreA;
        target.status = update.status;
        if (update.completed && update.winner) target.winner = normalizeTeam(target.teamA) === normalizeTeam(update.winner) ? target.teamA : target.teamB;
      }
      state.updated_at = new Date().toISOString();
      recalcAdvancement();
      renderBracket();
      renderLeaderboard();
      status.textContent = `Live sync complete • ${live.updatedGames.length} games checked`;
    } else {
      status.textContent = 'No in-progress tournament games found right now.';
    }
  } catch (err) {
    status.textContent = 'Live sync unavailable here. Deploy on Vercel to enable the API route.';
  }
}

function subscribeRealtime() {
  if (!supabaseReady) return;
  supabase.channel('mm_entries_channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mm_entries' }, async () => {
      await loadEntries();
      renderLeaderboard();
      renderMostPicked();
    })
    .subscribe();
}

async function init() {
  await loadState();
  buildTeamOptions(state.teams.filter(t => !t.play_in_only));
  await loadEntries();
  renderBracket();
  renderLeaderboard();
  renderMostPicked();
  wireModal();
  subscribeRealtime();
  document.getElementById('refresh-live').addEventListener('click', refreshLive);
  setInterval(refreshLive, 60000);
}

init();
