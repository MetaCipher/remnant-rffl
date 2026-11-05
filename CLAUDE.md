# CLAUDE.md — working on this repo

Stats widget for the Remnant Flag Football League (RFFL), the flag-football sibling of
`~/Projects/remnant-rsl` (softball). **The Remnant** entity (church) — no JH data.

Built on the RSL pattern: vanilla JS, no build step, no dependencies; Google Sheet backend
read keyless via the GViz endpoint; GitHub Pages hosting; embedded on theremnant.life.
Read remnant-rsl's `CLAUDE.md` and `docs/PLAN.md` before changing architecture.

Status (2026-11-04): widget + maintainer check page built and previewed against the live sheet; not yet
pushed/hosted. Leader boards + rate-stat minimums still pending a league decision (`docs/PLAN.md`).
Don't invent formulas (no NFL passer rating unless asked).

## Commands

```bash
node tests/compute.test.cjs   # must stay green
python3 -m http.server 8478   # preview (RSL uses 8477)
```

## Layout

- `assets/rffl-compute.js` — pure engine (standings, leaders, data checks), node-testable
- `assets/rffl-stats.js` — fetch/parse/render; also exports `RFFLStats.load` for `check.html`
- `config.js` — the only file needing edits normally (sheet ID, tab names, leader boards)
- `check.html` — maintainer-only sheet check, deliberately not linked from the widget
- Style matches remnant-rsl: ES5-flavoured JS, 2-space indent, CSS classes `rffl-*`, same palette

- Never commit real league data (player names; repo will be public). `sample/` is ignored.
