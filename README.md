# PM Music March Madness 2026 Tracker

This version removes all employee entry forms.

## What it does
- Reads employee/team assignments from `data/picks.json`
- Reads the tournament bracket from `data/bracket-state.json`
- Tracks each employee as `alive`, `out`, or `winner`
- Tries to update scores and winners from `/api/scoreboard`
- Saves bracket progress in browser local storage so the current state stays visible on that device

## Files you edit
- `data/picks.json` → employee picks
- `data/bracket-state.json` → starting bracket structure

## Deploy
1. Put this folder in GitHub
2. Import the repo into Vercel
3. Deploy

No Supabase is required for this version.
