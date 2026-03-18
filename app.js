const SUPABASE_URL = "https://silwdxurvouhshwajnvd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pIH4GKokcTL8pVxIN0cbCQ_yBmxoqLi";
const DB_TABLE = "entries";

const FALLBACK_TEAMS = [
  "Arizona","Duke","Houston","Florida","Purdue","UConn","Illinois","Alabama",
  "Kansas","Michigan St.","Tennessee","North Carolina","Gonzaga","Wisconsin",
  "Michigan","Louisville"
];

const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const modal = document.getElementById("entry-modal");
const form = document.getElementById("entry-form");
const nameInput = document.getElementById("employee-name");
const teamOne = document.getElementById("team-one");
const teamTwo = document.getElementById("team-two");
const leaderboard = document.getElementById("leaderboard");
const mostPicked = document.getElementById("most-picked");
const bracket = document.getElementById("bracket");
const liveStatus = document.getElementById("live-status");
const entryCount = document.getElementById("entry-count");
const finalizedCount = document.getElementById("finalized-count");
const lastUpdated = document.getElementById("last-updated");

let entries = [];
let games = [];

function setStatus(text) {
  liveStatus.textContent = text;
}

function openModal() {
  modal.style.display = "flex";
}

function closeModal() {
  modal.style.display = "none";
}

function renderTeamOptions() {
  const options = ['<option value="">Choose a team</option>']
    .concat(FALLBACK_TEAMS.map(t => `<option value="${t}">${t}</option>`))
    .join("");
  teamOne.innerHTML = options;
  teamTwo.innerHTML = options;
}

function renderLeaderboard() {
  entryCount.textContent = entries.length;
  if (!entries.length) {
    leaderboard.innerHTML = '<div class="list-item">No entries yet.</div>';
    return;
  }
  leaderboard.innerHTML = entries.map((e, i) =>
    `<div class="list-item"><strong>#${i + 1} ${e.name}</strong><br>${e.team_one} • ${e.team_two}</div>`
  ).join("");
}

function renderMostPicked() {
  const counts = {};
  for (const e of entries) {
    counts[e.team_one] = (counts[e.team_one] || 0) + 1;
    counts[e.team_two] = (counts[e.team_two] || 0) + 1;
  }
  const rows = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10);
  if (!rows.length) {
    mostPicked.innerHTML = '<div class="list-item">No picks yet.</div>';
    return;
  }
  mostPicked.innerHTML = rows.map(([team,count]) =>
    `<div class="list-item">${team} <strong>${count}</strong></div>`
  ).join("");
}

function renderBracket() {
  finalizedCount.textContent = games.filter(g => g.completed).length;
  if (!games.length) {
    bracket.innerHTML = '<div class="list-item">Bracket feed connected. No mapped live games yet.</div>';
    return;
  }
  bracket.innerHTML = games.map(g =>
    `<div class="list-item"><strong>${g.teamA}</strong> vs <strong>${g.teamB}</strong><br>${g.status}</div>`
  ).join("");
}

async function loadEntries() {
  const { data, error } = await supabase.from(DB_TABLE).select("*").order("created_at", { ascending: true });
  if (error) throw error;
  entries = data || [];
}

async function refreshLive() {
  try {
    setStatus("Refreshing live scores…");
    const res = await fetch("/api/scoreboard", { cache: "no-store" });
    const data = await res.json();
    games = Array.isArray(data.updatedGames) ? data.updatedGames : [];
    lastUpdated.textContent = new Date().toLocaleString();
    renderBracket();
    setStatus("Live scores refreshed.");
  } catch (e) {
    console.error(e);
    setStatus("Live refresh failed.");
  }
}

async function saveEntry(e) {
  e.preventDefault();
  const name = nameInput.value.trim();
  const pick1 = teamOne.value;
  const pick2 = teamTwo.value;

  if (!name || !pick1 || !pick2) {
    alert("Please fill out all fields.");
    return;
  }
  if (pick1 === pick2) {
    alert("Choose 2 different teams.");
    return;
  }

  const { error } = await supabase.from(DB_TABLE).insert({
    name,
    team_one: pick1,
    team_two: pick2
  });

  if (error) {
    alert("Save failed: " + error.message);
    return;
  }

  form.reset();
  closeModal();
  await loadEntries();
  renderLeaderboard();
  renderMostPicked();
  setStatus("Entry saved.");
}

function wire() {
  document.getElementById("open-entry-modal").onclick = openModal;
  document.getElementById("cancel-entry").onclick = closeModal;
  document.getElementById("refresh-live").onclick = refreshLive;
  form.onsubmit = saveEntry;
}

async function init() {
  renderTeamOptions();
  wire();
  await loadEntries();
  renderLeaderboard();
  renderMostPicked();
  await refreshLive();
  setStatus("Ready.");
}

init().catch((e) => {
  console.error(e);
  setStatus("Startup failed: " + (e.message || "unknown error"));
});
