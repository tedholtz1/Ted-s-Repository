const SUPABASE_URL = "https://silwdxurvouhshwajnvd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pIH4GKokcTL8pVxIN0cbCQ_yBmxoqLi";

const supabaseReady =
  typeof window.supabase !== "undefined" &&
  !!SUPABASE_URL &&
  !!SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes("YOUR_PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

const supabase = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const LOCAL_STORAGE_KEY = "mm_entries";
const DB_TABLE = "entries";

let entries = [];
let state = {
  teams: [],
  games: [],
  updated_at: null,
};

const entryModal = document.getElementById("entry-modal");
const entryForm = document.getElementById("entry-form");
const nameInput = document.getElementById("employee-name");
const teamOne = document.getElementById("team-one");
const teamTwo = document.getElementById("team-two");
const leaderboardEl = document.getElementById("leaderboard");
const mostPickedEl = document.getElementById("most-picked");
const bracketEl = document.getElementById("bracket");
const liveStatusEl = document.getElementById("live-status");
const entryCountEl = document.getElementById("entry-count");
const finalizedCountEl = document.getElementById("finalized-count");
const lastUpdatedEl = document.getElementById("last-updated");
const refreshButton = document.getElementById("refresh-live");

function setStatus(text) {
  if (liveStatusEl) liveStatusEl.textContent = text;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function normalizeTeam(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[m];
  });
}

function getAllTeams() {
  return safeArray(state.teams);
}

function getAllGames() {
  return safeArray(state.games);
}

function buildTeamOptions() {
  const teams = getAllTeams();
  const opts = ['<option value="">Choose a team</option>'].concat(
    teams.map((team) => {
      const seed = team.seed ? `${team.seed}. ` : "";
      const region = team.region ? ` (${team.region})` : "";
      return `<option value="${escapeHtml(team.name)}">${escapeHtml(seed + team.name + region)}</option>`;
    })
  );
  teamOne.innerHTML = opts.join("");
  teamTwo.innerHTML = opts.join("");
}

function currentRoundForTeam(teamName) {
  const team = getAllTeams().find((t) => t.name === teamName);
  return team?.advanced_to || 0;
}

function scoreEntry(entry) {
  return [entry.team_one, entry.team_two].reduce((sum, teamName) => {
    const roundIndex = currentRoundForTeam(teamName);
    const points = [0, 1, 2, 4, 8, 16, 32][roundIndex] || 0;
    return sum + points;
  }, 0);
}

function renderLeaderboard() {
  const template = document.getElementById("leaderboard-row-template");
  const sorted = [...entries]
    .map((entry) => ({ ...entry, points: scoreEntry(entry) }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  entryCountEl.textContent = String(sorted.length);

  if (!sorted.length) {
    leaderboardEl.innerHTML = '<div class="empty-state">No one has entered picks yet.</div>';
    return;
  }

  leaderboardEl.innerHTML = "";
  sorted.forEach((entry, idx) => {
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector(".rank").textContent = idx + 1;
    row.querySelector(".entrant-name").textContent = entry.name;
    row.querySelector(".entrant-picks").textContent = `${entry.team_one} • ${entry.team_two}`;
    row.querySelector(".score").textContent = entry.points;
    leaderboardEl.appendChild(row);
  });
}

function renderMostPicked() {
  const counts = new Map();

  entries.forEach((entry) => {
    [entry.team_one, entry.team_two].forEach((team) => {
      if (!team) return;
      counts.set(team, (counts.get(team) || 0) + 1);
    });
  });

  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);

  if (!rows.length) {
    mostPickedEl.innerHTML =
      '<div class="empty-state">Most-picked teams will appear after entries come in.</div>';
    return;
  }

  mostPickedEl.innerHTML = rows
    .map(([team, count]) => `<div class="most-picked-item"><span>${escapeHtml(team)}</span><strong>${count}</strong></div>`)
    .join("");
}

function recalcAdvancement() {
  const teams = getAllTeams();
  const games = getAllGames();

  teams.forEach((team) => {
    team.advanced_to = 0;
    team.eliminated = false;
  });

  const roundWeight = {
    "Round of 64": 1,
    "Round of 32": 2,
    "Sweet 16": 3,
    "Elite 8": 4,
    "Final Four": 5,
    Championship: 6,
    Champion: 6,
  };

  games.forEach((game) => {
    if (!game.winner) return;

    const winnerTeam = teams.find((t) => t.name === game.winner);
    const loserName = game.winner === game.teamA ? game.teamB : game.teamA;
    const loserTeam = teams.find((t) => t.name === loserName);

    if (winnerTeam) {
      winnerTeam.advanced_to = Math.max(winnerTeam.advanced_to || 0, roundWeight[game.round] || 0);
    }
    if (loserTeam) loserTeam.eliminated = true;
  });
}

function gameCard(game) {
  return `
    <article class="game-card">
      <div class="game-top">
        <span>${escapeHtml(game.region || "Bracket")} • ${escapeHtml(game.round || "")}</span>
        <span>${escapeHtml(game.status || "")}</span>
      </div>
      <div class="team-line ${game.winner === game.teamA ? "winner" : ""}">
        <div class="seed"></div>
        <div class="team-name">${escapeHtml(game.teamA || "TBD")}</div>
        <div class="team-status">${game.scoreA ?? ""}</div>
      </div>
      <div class="team-line ${game.winner === game.teamB ? "winner" : ""}">
        <div class="seed"></div>
        <div class="team-name">${escapeHtml(game.teamB || "TBD")}</div>
        <div class="team-status">${game.scoreB ?? ""}</div>
      </div>
    </article>
  `;
}

function renderBracket() {
  const games = getAllGames();

  if (!games.length) {
    bracketEl.innerHTML = '<div class="empty-state">Bracket data is not available yet.</div>';
    finalizedCountEl.textContent = "0";
    lastUpdatedEl.textContent = formatTime(state.updated_at);
    return;
  }

  const rounds = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"];
  bracketEl.innerHTML = `
    <div class="bracket-grid">
      ${rounds.map((round) => {
        const roundGames = games.filter((g) => g.round === round);
        return `
          <div class="round-col">
            <div class="round-header"><h3>${escapeHtml(round)}</h3></div>
            ${roundGames.length ? roundGames.map(gameCard).join("") : '<div class="empty-state">No games yet.</div>'}
          </div>
        `;
      }).join("")}
    </div>
  `;

  finalizedCountEl.textContent = String(games.filter((g) => !!g.winner).length);
  lastUpdatedEl.textContent = formatTime(state.updated_at);
}

function openModal() {
  if (entryModal?.showModal) entryModal.showModal();
  else entryModal?.setAttribute("open", "open");
}

function closeModal() {
  if (entryModal?.close) entryModal.close();
  else entryModal?.removeAttribute("open");
}

function wireModal() {
  document.getElementById("open-entry-modal")?.addEventListener("click", openModal);
  document.getElementById("close-entry-modal")?.addEventListener("click", closeModal);
  document.getElementById("cancel-entry")?.addEventListener("click", closeModal);

  entryForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const pick1 = teamOne.value;
    const pick2 = teamTwo.value;

    if (!name || !pick1 || !pick2) {
      alert("Please enter your name and choose 2 teams.");
      return;
    }

    if (pick1 === pick2) {
      alert("Please choose 2 different teams.");
      return;
    }

    const row = { name, team_one: pick1, team_two: pick2 };

    try {
      if (supabaseReady) {
        const { error } = await supabase.from(DB_TABLE).insert(row);
        if (error) throw error;
        await loadEntries();
      } else {
        const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
        local.push(row);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
        entries = local;
      }

      renderLeaderboard();
      renderMostPicked();
      entryForm.reset();
      closeModal();
      setStatus("Entry saved.");
    } catch (err) {
      console.error(err);
      alert(`Could not save entry: ${err.message || "Unknown error"}`);
    }
  });
}

async function loadEntries() {
  if (supabaseReady) {
    const { data, error } = await supabase.from(DB_TABLE).select("*").order("created_at", { ascending: true });
    if (error) throw error;
    entries = data || [];
  } else {
    entries = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  }
}

async function loadState() {
  const res = await fetch("./data/bracket-state.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load bracket-state.json");

  const json = await res.json();
  state = {
    teams: safeArray(json.teams),
    games: safeArray(json.games),
    updated_at: json.updated_at || new Date().toISOString(),
  };

  recalcAdvancement();
}

async function refreshLive() {
  setStatus("Checking live games…");
  try {
    const res = await fetch("/api/scoreboard", { cache: "no-store" });
    if (!res.ok) throw new Error("Live feed unavailable");

    const live = await res.json();
    const games = getAllGames();

    const byKey = new Map(
      games.map((g) => [`${normalizeTeam(g.teamA)}__${normalizeTeam(g.teamB)}`, g])
    );

    for (const update of live.updatedGames || []) {
      const keys = [
        `${normalizeTeam(update.teamA)}__${normalizeTeam(update.teamB)}`,
        `${normalizeTeam(update.teamB)}__${normalizeTeam(update.teamA)}`,
      ];
      const target = byKey.get(keys[0]) || byKey.get(keys[1]);
      if (!target) continue;

      target.scoreA = update.scoreA;
      target.scoreB = update.scoreB;
      target.status = update.status;
      if (update.completed && update.winner) target.winner = update.winner;
    }

    state.updated_at = new Date().toISOString();
    recalcAdvancement();
    renderBracket();
    renderLeaderboard();
    setStatus("Live sync complete.");
  } catch (err) {
    console.error(err);
    setStatus("Live sync unavailable here.");
  }
}

function subscribeRealtime() {
  if (!supabaseReady) return;

  supabase
    .channel("entries_realtime_channel")
    .on("postgres_changes", { event: "*", schema: "public", table: DB_TABLE }, async () => {
      try {
        await loadEntries();
        renderLeaderboard();
        renderMostPicked();
      } catch (err) {
        console.error(err);
      }
    })
    .subscribe();
}

async function init() {
  setStatus("Loading bracket…");
  await loadState();
  buildTeamOptions();
  await loadEntries();
  renderBracket();
  renderLeaderboard();
  renderMostPicked();
  wireModal();
  subscribeRealtime();

  refreshButton?.addEventListener("click", refreshLive);

  setStatus(
    supabaseReady
      ? "Ready. Entries will sync for everyone."
      : "Ready in demo mode. Add Supabase keys for shared entries."
  );
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error("App failed to initialize:", err);
    setStatus("App setup error. Check app.js, bracket-state.json, and Supabase.");
  });
});
