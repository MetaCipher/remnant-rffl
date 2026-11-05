# RFFL stats — setup and weekly routine

Same delivery as remnant-rsl (read its `docs/SQUARESPACE-SETUP.md` and `docs/DEPLOYMENT.md` for the
long versions — every step carries over with `rsl` → `rffl`).

## Pages

| Page | Who | What |
|---|---|---|
| `index.html` | everyone (embedded on theremnant.life) | standings, results, Player of the Week, leaders, per-team tables |
| `check.html` | Blake (maintainer) | everything in the sheet that doesn't tie out — **not linked** from the widget |

`check.html` is unlinked, not secret: anyone who guesses the URL sees the same public sheet data.

## Blake's weekly routine

1. Type the week's numbers into the Google Sheet (Games, POW (O), POW (D), the four stat tabs).
2. Open the check page (bookmark: `https://metacipher.github.io/remnant-rffl/check.html`) and fix
   anything it lists. It checks, per team: completions = receptions, passing = receiving yards and
   TDs, points = TDs × 7; league-wide: sacks taken = sacks made, INTs thrown = INTs caught; plus blank
   cells, game dates off the usual weekday, and POW names that match nobody.
3. Nothing else — the stats page reads the sheet on every load. No deploy.

Sheet rules the widget relies on: keep tab names as in `config.js`; one row per player per tab
(a repeated row is added together); player names "First L." in stat tabs (POW may use full names).

## Hosting + embed (one-time)

1. Push this repo to `github.com/MetaCipher/remnant-rffl` (public) → Settings → Pages → `main` / root.
2. On the Squarespace page: Embed block → code →
   `<iframe src="https://metacipher.github.io/remnant-rffl/" width="700" height="1500" style="border:0"></iframe>`
   Squarespace sizes the box from the width/height **attributes** (see the RSL memory note) — tune the
   height to the longest view.

## Development

```bash
node tests/compute.test.cjs        # engine tests
python3 -m http.server 8478        # preview at http://127.0.0.1:8478 (live sheet via config.js)
```
Add `?view=leaders` or `?view=team:Pureforce` to open a specific view; `?sheet=<id>` to point at a
copy of the sheet.
