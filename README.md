# Gridline

Mobile-first NFL live tracker: home spotlight, live scores and game situation, win probability, odds, weather, play-by-play by drive, player and team stats, lineups, injuries, schedule, standings with form and streaks, team pages and search.

- **Front end:** React + Vite. No logos: teams show as abbreviations on their colours.
- **Server:** a small API (`server/api.ts`), run as a Vercel serverless function or as a Node server (`server/index.ts`). It calls the data providers, caches responses so your API quota lasts, and serves the built site. **API keys stay on the server and never reach the browser.**
- **Data:** SportsDataIO for scores, plays, stats, standings, injuries and betting lines. Built-in fictional sample data when no key is set.

---

## Launch it today (no installs needed)

Vercel builds the site in the cloud, so you don't need Node.js or anything else on your computer. All you need is a web browser.

### 1. Put the code on GitHub

1. Right-click `gridline.zip` → **Extract All**.
2. Create a free account at **github.com** → **New repository** → name it `gridline` → **Private** → **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. Open the extracted `gridline` folder (the one containing `package.json`), select **everything inside it**, and drag it onto the GitHub page. Folders upload too.
   - Make sure `package.json`, `vercel.json`, `index.html` and the `src`, `server`, `scripts` and `public` folders are listed.
   - Never upload a `.env` file. The zip doesn't include one.
5. Click **Commit changes**.

### 2. Deploy on Vercel

1. Sign in at **vercel.com** with **Continue with GitHub**.
2. **Add New → Project** → find `gridline` → **Import**. If it isn't listed, click **Adjust GitHub App Permissions** and allow the repository.
3. Leave Framework Preset as **Other** and leave the build settings alone (they come from `vercel.json`).
4. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATA_PROVIDER` | `sportsdataio` |
   | `SPORTSDATAIO_API_KEY` | your key |
   | `SPORTSDATAIO_SEASON_TYPE` | `REG` |

   Skip these three for a first deploy on sample data.
5. Click **Deploy**. After 1–2 minutes you get a URL like `https://gridline-yourname.vercel.app`.

### 3. Check it's working

- `https://<your-url>/api/health`: should show `"provider":"sportsdataio"` and `"sportsdataioKey":true`.
- `https://<your-url>/api/check`: tests which SportsDataIO feeds your key can use. `200` = working, `401`/`403` = not in your plan or wrong key, `404` = the feed has a different name on your plan. It shows status codes only, never data or your key. `"oddsInScores": true` means odds will show.
- Then open the site itself.

If you add or change an environment variable later, go to **Deployments → ⋯ → Redeploy** so it takes effect. To change code, upload the changed files to GitHub and Vercel redeploys automatically. Custom domain: **Project → Settings → Domains**.

**How it runs on Vercel:** the site is served from Vercel's CDN, and `/api/*` runs as one serverless function (`server/vercel.ts`, bundled by `scripts/build-vercel.mjs`). API responses carry `s-maxage` headers, so Vercel's CDN answers repeat requests and SportsDataIO is called at most once every few seconds per endpoint, however many people are watching. Vercel's free Hobby plan is for personal, non-commercial use; a commercial launch needs Pro.

**Prefer Render?** The same code runs there unchanged: Web Service, build `npm install && npm run build`, start `npm start`, same environment variables.

## Before you call it a public launch

- **Trial keys:** SportsDataIO trial data is usually *scrambled* (scores and stats are deliberately altered), and trial terms usually don't allow public or commercial display. Use the trial to build and test. Get a production licence that covers public website display (and odds, if you show them) before you announce the site.
- **Odds:** shown from the line in SportsDataIO's scores. If your plan doesn't include odds, the odds boxes say "No line". `ODDS_PROVIDER=theoddsapi` switches to the-odds-api.com; other odds services need their own connector in `server/providers/`.
- **The Odds API quota (only if you use it):** each refresh costs `markets × regions` credits. The defaults (`h2h,spreads`, `us`, every 180 minutes, only when someone is on the site) keep a 500-credit monthly plan within its limit. The server stops calling below `ODDS_MIN_REMAINING` and keeps the last odds. `/api/health` shows credits remaining.
- **SportsDataIO rate limits:** live scores are cached 5 seconds and play-by-play 8 seconds on the server, whatever the number of visitors. Raise those in `server/providers/sportsdataio.ts` if your plan needs it.
- Endpoints and field names in the SportsDataIO adapter are marked `// VERIFY`. Run `npm run check:sdio` and compare.

## Developing (optional, needs Node.js 22+)

`npm run build && npm start` serves the full site on http://localhost:8787 (put keys in a `.env` file copied from `.env.example`). `npm run check:sdio` saves real SportsDataIO responses to `sdio-samples/` for checking field names.


```powershell
npm run dev:api     # API server on :8787 (terminal 1)
npm run dev         # site on :5173 with hot reload (terminal 2)
npm run dev:sample  # site only, sample data in the browser, no server
npm run typecheck
```

## Pages

Home `#home` · Games `#games` · Game `#game-<id>` (pre-game, live, halftime and final layouts) · Plays `#plays-<id>` · Schedule `#schedule` · Standings `#standings` · Team `#team-KC` · Search `#search`. Hash routes need no server rewrite rules. When the connection drops, pages keep the last data, show an offline bar and hide win probability and odds until they reconnect.

## How things are calculated

- **Win probability** (`src/shared/winprob.ts`): a transparent baseline model combining score margin, time left, field position and the pre-game spread (which fades as the game goes on). The UI only needs a number from 0 to 1, so you can swap in a trained model later.
- **Odds** (`server/providers/theoddsapi.ts`): the median line across bookmakers, or one bookmaker if you set `ODDS_BOOKMAKER`. When present, it replaces SportsDataIO's line and feeds the pre-game win probability.
- **Game summary** (`src/shared/summary.ts`): template-based from the score and play-by-play, so it never invents facts.
- **Drives** (`src/shared/drives.ts`): plays grouped by possession.
- **Playoff seeds:** division leaders, then best records. NFL tiebreakers are not applied, and the page says so.

## Licensing checklist (not legal advice)

- [ ] Your SportsDataIO licence allows public, commercial display on a website.
- [ ] The Odds API terms allow your use; show odds "for information only", check local rules on betting content, and add responsible-gambling messaging where required.
- [ ] No NFL or team logos, no NFL shield, no "NFL" in the product name. Team names as plain text are fine.
- [ ] Keep "Not affiliated with the NFL" and any attribution your providers require.
- [ ] No video, streams or copied articles.

## Project layout

```
src/
  shared/   types, teams, win probability, drives, stats, summary, team detail, sample data
  data/     data source switch, polling and offline hooks, hash router
  ui/       shared components (badges, cards, field, win-probability chart, nav, game rows)
  pages/    Home, Games, Game, Plays, Schedule, Standings, Team, Search
server/
  api.ts          the JSON API, /api/health
  index.ts        Node server (local, Render): API + built site
  vercel.ts       Vercel function entry
scripts/
  build-vercel.mjs  builds .vercel/output (static site + function)
  providers/      sportsdataio.ts, theoddsapi.ts
  check-sdio.ts   checks your key and saves real responses
```
