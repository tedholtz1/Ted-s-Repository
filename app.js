const SUPABASE_URL = "https://silwdxurvouhshwajnvd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pIH4GKokcTL8pVxIN0cbCQ_yBmxoqLi";
const DB_TABLE = "entries";
const LOCAL_STORAGE_KEY = "mm_entries";

const FALLBACK_TEAMS = [
  { name: "Duke", seed: 1, region: "East" },
  { name: "Houston", seed: 1, region: "Midwest" },
  { name: "UConn", seed: 1, region: "West" },
  { name: "Purdue", seed: 1, region: "South" },
  { name: "Tennessee", seed: 2, region: "East" },
  { name: "Marquette", seed: 2, region: "West" },
  { name: "Arizona", seed: 2, region: "South" },
  { name: "Iowa State", seed: 2, region: "Midwest" },
  { name: "Illinois", seed: 3, region: "East" },
  { name: "Baylor", seed: 3, region: "West" },
  { name: "Creighton", seed: 3, region: "Midwest" },
  { name: "Kentucky", seed: 3, region: "South" },
  { name: "Alabama", seed: 4, region: "West" },
  { name: "Auburn", seed: 4, region: "East" },
  { name: "Kansas", seed: 4, region: "Midwest" },
  { name: "North Carolina", seed: 4, region: "South" }
];

let entries = [];
let state = {
  teams: [...FALLBACK_TEAMS],
  games: [],
  updated_at: new Date().toISOString()
};

const supabaseReady =
  typeof window.supabase !== "undefined" &&
  SUPABASE_URL &&
  SUPABASE_ANON_KEY;

const supabase = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

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

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[m];
  });
}

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function buildTeamOptions() {
  const teams = Array.isArray(state.teams) ? state.teams : [];
  const opts = ['<option value="">Choose a team</option>'].concat(
    teams.map((team) => {
      const label = `${team.seed ? team.seed + ". " : ""}${team.name}${team.region ? " (" + team.region + ")" : ""}`;
      return `<option value="${escapeHtml(team.name)}">${escapeHtml(label)}</option>`;
    })
  );
  if (teamOne) teamOne.innerHTML = opts.join("");
  if (teamTwo) teamTwo.innerHTML = opts.join("");
}

function scoreEntry() {
  return 0;
}

function renderLeaderboard() {
  if (!leaderboardEl) return;

  const sorted = [...entries]
    .map((entry) => ({ ...entry, points: scoreEntry(entry) }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  if (entryCountEl) entryCountEl.textContent = String(sorted.length);

  if (!sorted.length) {
    leaderboardEl.innerHTML = '<div class="empty-state">No one has entered picks yet.</div>';
    return;
  }

  leaderboardEl.innerHTML = sorted
    .map((entry, idx) => `
      <div class="leaderboard-row">
        <div class="rank">${idx + 1}</div>
        <div class="entrant-meta">
          <div class="entrant-name">${escapeHtml(entry.name)}</div>
          <div class="entrant-picks">${escapeHtml(entry.team_one)} • ${escapeHtml(entry.team_two)}</div>
        </div>
        <div class="score">${entry.points}</div>
      </div>
    `)
    .join("");
}

function renderMostPicked() {
  if (!mostPickedEl) return;

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
    .map(([team, count]) => `
      <div class="most-picked-item">
        <span>${escapeHtml(team)}</span>
        <strong>${count}</strong>
      </div>
    `)
    .join("");
}

function renderBracket() {
  if (!bracketEl) return;

  const games = Array.isArray(state.games) ? state.games : [];

  if (!games.length) {
    bracketEl.innerHTML = `
      <div class="empty-state">
        Bracket display is in fallback mode right now. Picks will still work while we finish the live bracket feed.
      </div>
    `;
    if (finalizedCountEl) finalizedCountEl.textContent = "0";
    if (lastUpdatedEl) lastUpdatedEl.textContent = formatTime(state.updated_at);
    return;
  }

  bracketEl.innerHTML = games
    .map((game) => `
      <article class="game-card">
        <div class="game-top">
          <span>${escapeHtml(game.region || "Bracket")} • ${escapeHtml(game.round || "")}</span>
          <span>${escapeHtml(game.status || "")}</span>
        </div>
        <div class="team-line ${game.winner === game.teamA ? "winner" : ""}">
          <div class="team-name">${escapeHtml(game.teamA || "TBD")}</div>
          <div class="team-status">${game.scoreA ?? ""}</div>
        </div>
        <div class="team-line ${game.winner === game.teamB ? "winner" : ""}">
          <div class="team-name">${escapeHtml(game.teamB || "TBD")}</div>
          <div class="team-status">${game.scoreB ?? ""}</div>
        </div>
      </article>
    `)
    .join("");

  if (finalizedCountEl) {
    finalizedCountEl.textContent = String(games.filter((g) => !!g.winner).length);
  }
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = formatTime(state.updated_at);
  }
}

function openModal() {
  if (!entryModal) return;
  if (typeof entryModal.showModal === "function") {
    entryModal.showModal();
  } else {
    entryModal.setAttribute("open", "open");
  }
}

function closeModal() {
  if (!entryModal) return;
  if (typeof entryModal.close === "function") {
    entryModal.close();
  } else {
    entryModal.removeAttribute("open");
  }
}

function wireButtons() {
  document.getElementById("open-entry-modal")?.addEventListener("click", openModal);
  document.getElementById("close-entry-modal")?.addEventListener("click", closeModal);
  document.getElementById("cancel-entry")?.addEventListener("click", closeModal);
  refreshButton?.addEventListener("click", refreshLive);

  entryForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput?.value.trim();
    const pick1 = teamOne?.value;
    const pick2 = teamTwo?.value;

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
  try {
    if (supabaseReady) {
      const { data, error } = await supabase
        .from(DB_TABLE)
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      entries = data || [];
    } else {
      entries = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
    }
  } catch (err) {
    console.error("loadEntries failed", err);
    entries = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  }
}

async function loadState() {
  try {
    const res = await fetch("./data/bracket-state.json", { cache: "no-store" });
    if (!res.ok) throw new Error("bracket-state.json missing");
    const json = await res.json();

    state = {
      teams: Array.isArray(json.teams) && json.teams.length ? json.teams : [...FALLBACK_TEAMS],
      games: Array.isArray(json.games) ? json.games : [],
      updated_at: json.updated_at || new Date().toISOString()
    };
  } catch (err) {
    console.error("loadState failed", err);
    state = {
      teams: [...FALLBACK_TEAMS],
      games: [],
      updated_at: new Date().toISOString()
    };
    setStatus("Fallback mode: picks are working, bracket feed still needs setup.");
  }
}

async function refreshLive() {
  setStatus("Checking live games…");

  try {
    const res = await fetch("/api/scoreboard", { cache: "no-store" });
    if (!res.ok) throw new Error("Live feed unavailable");
    const live = await res.json();

    if (!Array.isArray(live.updatedGames) || !live.updatedGames.length) {
      setStatus("No live updates found right now.");
      return;
    }

    state.games = live.updatedGames.map((g) => ({
      round: g.round || "Live",
      region: g.region || "Tournament",
      teamA: g.teamA,
      teamB: g.teamB,
      scoreA: g.scoreA,
      scoreB: g.scoreB,
      status: g.status,
      winner: g.completed ? g.winner : ""
    }));

    state.updated_at = new Date().toISOString();
    renderBracket();
    setStatus("Live sync complete.");
  } catch (err) {
    console.error(err);
    setStatus("Live sync unavailable here.");
  }
}

async function init() {
  wireButtons();
  buildTeamOptions();
  renderBracket();
  renderLeaderboard();
  renderMostPicked();
  setStatus("Starting app…");

  await loadState();
  buildTeamOptions();

  await loadEntries();
  renderBracket();
  renderLeaderboard();
  renderMostPicked();

  setStatus("Ready.");
}

init();
