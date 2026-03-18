
const STORAGE_KEY = 'pm-march-madness-bracket-state-v2';
const statusBar = document.getElementById('status-bar');
const trackerEl = document.getElementById('employee-tracker');
const bracketEl = document.getElementById('bracket-view');
const employeeCountEl = document.getElementById('employee-count');
const aliveCountEl = document.getElementById('alive-count');
const championNameEl = document.getElementById('champion-name');
const lastUpdatedEl = document.getElementById('last-updated');
const refreshBtn = document.getElementById('refresh-live');
const resetBtn = document.getElementById('reset-bracket');

let picks = [];
let baseState = null;
let state = null;

const ROUND_ORDER = ['Round of 64','Round of 32','Sweet 16','Elite 8','Final Four','Championship'];

function setStatus(text) { statusBar.textContent = text; }
function fmtTime(v){ if(!v) return '—'; try { return new Date(v).toLocaleString(); } catch { return '—'; } }
function normalizeTeam(name){ return String(name||'').toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

function saveLocalState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadLocalState(){ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }

function buildTeamMap(){
  const map = new Map();
  for(const team of state.teams){ map.set(team.name, team); }
  return map;
}

function computeAliveSet(){
  const alive = new Set(state.teams.map(t => t.name));
  for(const game of state.games){
    if(game.winner){
      const loser = game.winner === game.teamA ? game.teamB : game.teamA;
      if(loser) alive.delete(loser);
    }
  }
  return alive;
}

function computeChampion(){
  const final = state.games.find(g => g.round === 'Championship');
  return final?.winner || '';
}

function teamStatus(teamName, aliveSet, champion){
  if(!teamName) return 'out';
  if(champion && normalizeTeam(champion) === normalizeTeam(teamName)) return 'winner';
  return aliveSet.has(teamName) ? 'alive' : 'out';
}

function employeeStatus(entry, aliveSet, champion){
  const statuses = entry.teams.map(t => teamStatus(t, aliveSet, champion));
  if(statuses.includes('winner')) return 'winner';
  if(statuses.includes('alive')) return 'alive';
  return 'out';
}

function renderTracker(){
  const aliveSet = computeAliveSet();
  const champion = computeChampion();
  const enriched = picks.map(entry => ({ ...entry, status: employeeStatus(entry, aliveSet, champion) }));
  const order = { winner: 0, alive: 1, out: 2 };
  enriched.sort((a,b) => order[a.status]-order[b.status] || a.name.localeCompare(b.name));

  employeeCountEl.textContent = String(enriched.length);
  aliveCountEl.textContent = String(enriched.filter(e => e.status !== 'out').length);
  championNameEl.textContent = champion || '—';
  lastUpdatedEl.textContent = fmtTime(state.updated_at);

  trackerEl.innerHTML = enriched.map(entry => `
    <article class="employee-card">
      <div class="employee-top">
        <div class="employee-name">${entry.name}</div>
        <div class="status-pill status-${entry.status}">${entry.status}</div>
      </div>
      ${entry.teams.map(team => {
        const s = teamStatus(team, aliveSet, champion);
        return `<div class="team-row"><div>${team}</div><div class="team-tag ${s}">${s}</div></div>`;
      }).join('')}
    </article>
  `).join('');
}

function renderBracket(){
  const cols = ROUND_ORDER.map(round => {
    const games = state.games.filter(g => g.round === round);
    const body = games.length ? games.map(game => `
      <article class="game-card">
        <div class="game-meta"><span>${game.region || 'Bracket'}</span><span>${game.status || 'Scheduled'}</span></div>
        <div class="slot ${game.winner === game.teamA ? 'winner' : ''}">
          <div class="slot-name">${game.teamA || 'TBD'}</div>
          <div class="slot-score">${Number.isFinite(game.scoreA) ? game.scoreA : ''}</div>
        </div>
        <div class="slot ${game.winner === game.teamB ? 'winner' : ''}">
          <div class="slot-name">${game.teamB || 'TBD'}</div>
          <div class="slot-score">${Number.isFinite(game.scoreB) ? game.scoreB : ''}</div>
        </div>
      </article>
    `).join('') : '<div class="empty">No games in this round yet.</div>';
    return `<div class="round-col"><div class="round-title">${round}</div>${body}</div>`;
  }).join('');

  bracketEl.innerHTML = `<div class="round-grid">${cols}</div>`;
}

function syncWinnersForward(){
  const winByRound = new Map();
  for(const round of ROUND_ORDER){ winByRound.set(round, state.games.filter(g => g.round === round && g.winner)); }

  const nextMap = {
    'Round of 64': 'Round of 32',
    'Round of 32': 'Sweet 16',
    'Sweet 16': 'Elite 8',
    'Elite 8': 'Final Four',
    'Final Four': 'Championship'
  };

  for(const [round, nextRound] of Object.entries(nextMap)){
    const winners = state.games.filter(g => g.round === round && g.winner).map(g => g.winner);
    const nextGames = state.games.filter(g => g.round === nextRound);
    for(let i=0;i<nextGames.length;i++){
      nextGames[i].teamA = winners[i*2] || nextGames[i].teamA || '';
      nextGames[i].teamB = winners[i*2+1] || nextGames[i].teamB || '';
    }
  }
}

function applyLiveUpdates(liveGames){
  let matched = 0;
  for(const update of liveGames){
    const candidates = state.games.filter(g =>
      [normalizeTeam(g.teamA), normalizeTeam(g.teamB)].includes(normalizeTeam(update.teamA)) &&
      [normalizeTeam(g.teamA), normalizeTeam(g.teamB)].includes(normalizeTeam(update.teamB))
    );
    if(!candidates.length) continue;
    const target = candidates[0];
    const aMatches = normalizeTeam(target.teamA) === normalizeTeam(update.teamA);
    target.scoreA = aMatches ? update.scoreA : update.scoreB;
    target.scoreB = aMatches ? update.scoreB : update.scoreA;
    target.status = update.status || target.status;
    if(update.completed && update.winner){
      target.winner = normalizeTeam(target.teamA) === normalizeTeam(update.winner) ? target.teamA : target.teamB;
    }
    matched++;
  }
  syncWinnersForward();
  state.updated_at = new Date().toISOString();
  saveLocalState();
  renderAll();
  return matched;
}

function renderAll(){ renderTracker(); renderBracket(); }

async function fetchJson(path){ const res = await fetch(path,{cache:'no-store'}); if(!res.ok) throw new Error(`Failed to load ${path}`); return res.json(); }

async function init(){
  setStatus('Loading picks and bracket…');
  const [picksData, bracketData] = await Promise.all([
    fetchJson('./data/picks.json'),
    fetchJson('./data/bracket-state.json')
  ]);
  picks = picksData;
  baseState = bracketData;
  state = loadLocalState() || clone(baseState);
  syncWinnersForward();
  renderAll();
  setStatus('Ready. Use Refresh live results whenever games are on.');
}

refreshBtn.addEventListener('click', async () => {
  try{
    setStatus('Checking live results…');
    const payload = await fetchJson('/api/scoreboard');
    const matched = applyLiveUpdates(payload.updatedGames || []);
    setStatus(matched ? `Updated ${matched} game${matched===1?'':'s'}.` : 'No matching live tournament games found right now.');
  } catch(err){
    console.error(err);
    setStatus('Live refresh failed. Vercel or ESPN feed may be unavailable.');
  }
});

resetBtn.addEventListener('click', () => {
  if(!baseState) return;
  state = clone(baseState);
  localStorage.removeItem(STORAGE_KEY);
  syncWinnersForward();
  renderAll();
  setStatus('Bracket reset to the original starting state.');
});

init().catch(err => {
  console.error(err);
  setStatus('Startup failed. Check picks.json and bracket-state.json.');
  trackerEl.innerHTML = '<div class="empty">Could not load employee picks.</div>';
  bracketEl.innerHTML = '<div class="empty">Could not load bracket data.</div>';
});
