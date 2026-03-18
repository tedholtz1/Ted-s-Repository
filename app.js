const SUPABASE_URL =
  window.SUPABASE_URL ||
  window.SUPABASE_URL_ENV ||
  "https://YOUR_PROJECT.supabase.co";

const SUPABASE_ANON_KEY =
  window.SUPABASE_ANON_KEY ||
  window.SUPABASE_ANON_KEY_ENV ||
  "YOUR_SUPABASE_ANON_KEY";

const supabaseReady =
  typeof window.supabase !== "undefined" &&
  !SUPABASE_URL.includes("YOUR_PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

const supabase = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const LOCAL_STORAGE_KEY = "mm_entries";
const DB_TABLE = "entries";

let entries = [];
let state = null;

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function setStatus(message) {
  if (liveStatusEl) liveStatusEl.textContent = message;
}

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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

function getAllTeams() {
  return Array.isArray(state?.teams) ? state.teams : [];
}

function getAllGames() {
  return Array.isArray(state?.games) ? state.games : [];
}

function buildTeamOptions(teams) {
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
    leaderboardEl.innerHTML =
      '<div class="empty-state">No one has entered picks yet.</div>';
    return;
  }

  leaderboardEl.innerHTML = "";

  sorted.forEach((entry, idx) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".rank").textContent = idx + 1;
    node.querySelector(".entrant-name").textContent = entry.name;
    node.querySelector(".entrant-picks").textContent =
      `${entry.team_one} • ${entry.team_two}`;
    node.querySelector(".score").textContent = entry.points;
    leaderboardEl.appendChild(node);
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
    .map(([team, count]) => {
      const teamMeta = getAllTeams().find((t) => t.name === team);
      return `
        <div class="most-picked-item">
          <div>
            <strong>${escapeHtml(team)}</strong>
            <span>${escapeHtml(teamMeta?.region || "")}</span>
          </div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function gameCard(game) {
  const teamA = getAllTeams().find((t) => t.name === game.teamA);
  const teamB = getAllTeams().find((t) => t.name === game.teamB);
  const winner = game.winner;
  const status = game.status || "Scheduled";
  const scoreLine =
    [game.scoreA, game.scoreB].every((v) => typeof v === "number")
      ? `${game.scoreA}-${game.scoreB}`
      : status;

  const line = (team, score, isWinner) => `
    <div class="team-line ${winner ? (isWinner ? "winner" : "loser") : ""}">
      <div class="seed">${escapeHtml(team?.seed ?? "")}</div>
      <div class="team-name">${escapeHtml(team?.name || "TBD")}</div>
      <div class="team-status">${escapeHtml(score ?? "")}</div>
    </div>`;

  return `
    <article class="game-card">
      <div class="game-top">
        <span>${escapeHtml(game.region || "Finals")} • ${escapeHtml(game.round || "")}</span>
        <span>${escapeHtml(scoreLine)}</span>
      </div>
      ${line(teamA, game.scoreA, winner === game.teamA)}
      ${line(teamB, game.scoreB, winner === game.teamB)}
    </article>
  `;
}

function renderBracket() {
  const games = getAllGames();

  if (!games.length) {
    bracketEl.innerHTML =
      '<div class="empty-state">Bracket data is not available yet.</div>';
    finalizedCountEl.textContent = "0";
    lastUpdatedEl.textContent = "—";
    return;
  }

  const byRound = new Map();
  games.forEach((game) => {
    const key = game.round || "Unknown";
    if (!byRound.has(key)) byRound.set(key, []);
    byRound.get(key).push(game);
  });

  const roundOrder = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8"];
  const leftGames = roundOrder.map(
    (round) => byRound.get(round)?.filter((g) => ["West", "East"].includes(g.region)) || []
  );
  const rightGames = roundOrder.map(
    (round) => byRound.get(round)?.filter((g) => ["Midwest", "South"].includes(g.region)) || []
  );
  const finalFourGames = byRound.get("Final Four") || [];
  const championshipGames =
    byRound.get("Championship") || byRound.get("Champion") || [];

  bracketEl.innerHTML = `
    <div class="bracket-grid">
      <div class="round-col">
        ${roundOrder
          .map(
            (round, idx) => `
            <div class="round-header"><h3>${escapeHtml(round)}</h3><p>West + East</p></div>
            ${leftGames[idx].map(gameCard).join("")}
          `
          )
          .join("")}
      </div>

      <div class="round-col">
        <div class="round-header"><h3>West + East</h3><p>Regional path</p></div>
        ${(games.filter(
          (g) => g.round === "Elite 8" && ["West", "East"].includes(g.region)
        ) || [])
          .map(gameCard)
          .join("")}
        ${(finalFourGames.filter((g) =>
          ["West Winner", "East Winner"].includes(g.regionPath)
        ) || [])
          .map(gameCard)
          .join("")}
      </div>

      <div class="center-stack">
        <div class="center-card">
          <div class="eyebrow">National stage</div>
          <h3>Final Four</h3>
          <p>Two semifinals, one title game, one office champion.</p>
        </div>
        ${finalFourGames.map(gameCard).join("")}
        ${championshipGames.map(gameCard).join("")}
      </div>

      <div class="round-col">
        <div class="round-header"><h3>Midwest + South</h3><p>Regional path</p></div>
        ${(games.filter(
          (g) => g.round === "Elite 8" && ["Midwest", "South"].includes(g.region)
        ) || [])
          .map(gameCard)
          .join("")}
        ${(finalFourGames.filter((g) =>
          ["Midwest Winner", "South Winner"].includes(g.regionPath)
        ) || [])
          .map(gameCard)
          .join("")}
      </div>

      <div class="round-col">
        ${roundOrder
          .map(
            (round, idx) => `
            <div class="round-header"><h3>${escapeHtml(round)}</h3><p>Midwest + South</p></div>
            ${rightGames[idx].map(gameCard).join("")}
          `
          )
          .join("")}
      </div>
    </div>
  `;

  finalizedCountEl.textContent = String(games.filter((g) => !!g.winner).length);
  lastUpdatedEl.textContent = formatTime(state?.updated_at);
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
      winnerTeam.advanced_to = Math.max(
        winnerTeam.advanced_to || 0,
        roundWeight[game.round] || 0
      );
    }

    if (loserTeam) loserTeam.eliminated = true;
  });
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
      console.error("Save entry failed:", err);
      alert(`Could not save entry: ${err.message || "Unknown error"}`);
    }
  });
}

async function loadEntries() {
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
}

async function loadState() {
  const res = await fetch("./data/bracket-state.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Could not load bracket-state.json");
  }

  const json = await res.json();

  state = {
    teams: Array.isArray(json.teams) ? json.teams : [],
    games: Array.isArray(json.games) ? json.games : [],
    updated_at: json.updated_at || new Date().toISOString(),
  };

  recalcAdvancement();
}

async function refreshLive() {
  setStatus("Checking live games…");

  try {
    const res = await fetch("/api/scoreboard", { cache: "no-store" });
    if (!res.ok) throw new Error("Live feed unavailable.");

    const live = await res.json();

    if (!live.updatedGames?.length) {
      setStatus("No in-progress tournament games found right now.");
      return;
    }

    const byKey = new Map(
      getAllGames().map((g) => [
        `${normalizeTeam(g.teamA)}__${normalizeTeam(g.teamB)}`,
        g,
      ])
    );

    for (const update of live.updatedGames) {
      const keys = [
        `${normalizeTeam(update.teamA)}__${normalizeTeam(update.teamB)}`,
        `${normalizeTeam(update.teamB)}__${normalizeTeam(update.teamA)}`,
      ];

      const target = byKey.get(keys[0]) || byKey.get(keys[1]);
      if (!target) continue;

      const targetTeamANormalized = normalizeTeam(target.teamA);
      const targetTeamBNormalized = normalizeTeam(target.teamB);
      const updateTeamANormalized = normalizeTeam(update.teamA);
      const updateWinnerNormalized = normalizeTeam(update.winner);

      target.scoreA =
        targetTeamANormalized === updateTeamANormalized
          ? update.scoreA
          : update.scoreB;

      target.scoreB =
        targetTeamBNormalized === normalizeTeam(update.teamB)
          ? update.scoreB
          : update.scoreA;

      target.status = update.status;

      if (update.completed && update.winner) {
        target.winner =
          targetTeamANormalized === updateWinnerNormalized
            ? target.teamA
            : target.teamB;
      }
    }

    state.updated_at = new Date().toISOString();
    recalcAdvancement();
    renderBracket();
    renderLeaderboard();
    setStatus(`Live sync complete • ${live.updatedGames.length} games checked`);
  } catch (err) {
    console.error("Live refresh failed:", err);
    setStatus("Live sync unavailable here.");
  }
}

function subscribeRealtime() {
  if (!supabaseReady) return;

  supabase
    .channel("entries_realtime_channel")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: DB_TABLE },
      async () => {
        try {
          await loadEntries();
          renderLeaderboard();
          renderMostPicked();
        } catch (err) {
          console.error("Realtime reload failed:", err);
        }
      }
    )
    .subscribe();
}

async function init() {
  setStatus("Loading bracket…");
  await loadState();
  buildTeamOptions(getAllTeams().filter((t) => !t.play_in_only));
  await loadEntries();
  renderBracket();
  renderLeaderboard();
  renderMostPicked();
  wireModal();
  subscribeRealtime();

  refreshButton?.addEventListener("click", refreshLive);

  if (typeof window !== "undefined") {
    window.setInterval(refreshLive, 60000);
  }

  setStatus(
    supabaseReady
      ? "Ready. Entries will sync for everyone."
      : "Ready in demo mode. Add Supabase keys for shared entries."
  );
}

init().catch((err) => {
  console.error("App failed to initialize:", err);
  setStatus("App setup error. Check bracket data and Supabase config.");

  leaderboardEl.innerHTML =
    '<div class="empty-state">The app could not start. Check app.js, Supabase setup, and bracket-state.json.</div>';
  mostPickedEl.innerHTML =
    '<div class="empty-state">Unavailable until startup succeeds.</div>';
  bracketEl.innerHTML =
    '<div class="empty-state">Bracket could not be loaded.</div>';
});
