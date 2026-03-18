# March Madness Office Challenge App

This is a polished static web app you can deploy in a few minutes and share with your coworkers.

## What it does
- Real bracket-style UI
- Everyone can enter their name and 2 teams
- Shared leaderboard for all employees
- Most-picked teams panel
- Live game refresh through a Vercel API route that reads the ESPN college basketball scoreboard feed
- Auto-scoring by round advanced

## What you need to make it shared and live
1. A free Supabase project for shared entries
2. A free Vercel project for deployment and the `/api/scoreboard` route

## Deploy steps
### 1) Create a Supabase project
- Create a new project in Supabase
- Open the SQL editor
- Paste in `supabase-schema.sql` and run it
- Copy your project URL and anon key

### 2) Add your Supabase values
Open `app.js` and replace:
- `https://YOUR_PROJECT.supabase.co`
- `YOUR_SUPABASE_ANON_KEY`

### 3) Deploy to Vercel
- Put this folder into a GitHub repo or upload it directly in Vercel
- Vercel will serve `index.html` and the `api/scoreboard.js` endpoint automatically
- Share the Vercel URL with coworkers

## Local demo mode
If you do not configure Supabase, the app still works in local demo mode using browser local storage.
That is good for previewing the look and feel, but entries will not be shared across coworkers until Supabase is connected.

## Notes
- The ESPN scoreboard endpoint is unofficial and can change. The app is structured so that you can swap in another feed later if needed.
- The current bracket data in `data/bracket-state.json` is seeded from your 2026 printable bracket PDF.
