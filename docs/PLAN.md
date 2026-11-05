# RFFL stats — plan (draft, 2026-11-04)

Source sheet: `1JOcKS0DCF7JYgWid5-FCBdKTxKUlRu8XQUcpWFZu1As` (link-viewer; xlsx export and GViz both
readable keyless). A local copy lives in `sample/rffl.xlsx` (gitignored — it has player names).

## What the sheet is

Hand-entered **season totals**, no formulas, no per-game player rows. Same shape as RSL's
"season totals" mode, minus the GameChanger importer.

| Tab | Columns | Notes |
|---|---|---|
| Games | Date, Team1, Score1, Team2, Score2 | one row per game; 4 teams, 9 games so far |
| POW (O) / POW (D) | Date, Team, Player, Note | offensive / defensive player of the week; **full names** ("First Last") |
| Passing Stats | Team, Player, Completions, Attempts, Yards, TD's, Sacks, Interceptions | Sacks = sacks taken |
| Rushing Stats | Team, Player, Rushes, Yards, TDs | |
| Receiving Stats | Team, Player, Receptions, Yards, TDs | |
| Defensive Stats | Team, Player, Tackles, Sacks, Interceptions, Int. Yards, Int. TD's, Deflections | |

Stat tabs name players "First L." (two letters where needed to disambiguate). POW uses full names,
so POW → player matching needs first name + last initial, or the sheet switches to one format.
Header spellings vary (`TD's` / `TDs` / `Int. TD's`) — the parser should normalise, not the sheet.

## Facts the data confirms

- Every score is a multiple of 7, and points ÷ 7 equals passing + rushing + INT-return TDs for 3 of
  4 teams — a touchdown is worth 7, no other scoring. Standings can be derived from Games alone.
- Completions = receptions and passing TDs = receiving TDs for Iron Faith and Righteous Fury, so the
  tabs are meant to reconcile per team. That gives us a built-in data check.

## Data issues found (2026-11-04) — for the sheet maintainer

1. **Pureforce receiving is short** vs its passing: 102 receptions vs 119 completions, 1,663 vs
   1,927 yards, 30 vs 34 TDs. Likely a missing receiver row; one existing row also has a blank TDs cell.
2. **Pureforce points**: 266 points = 38 TDs, but stats show 39 (34 passing + 5 INT-return).
3. **Passing vs receiving yards** drift on every team (+14, +31, +90 and the Pureforce gap).
4. **Eternal Wave**: 111 receptions vs 112 completions.
5. **League totals**: 7 sacks taken by QBs vs 4 sacks credited on defense; 36 INTs thrown vs 38 caught.
6. **Date 2026-10-26 is a Monday** — the other game days are Sundays (10/18, 11/1). Typo for 10/25?

## Decisions (Tim, 2026-11-04)

- Sheet issues above: passed to the league.
- Maintainer: **Blake**, updates after each game day.
- Reconciliation warnings: **maintainer only** → unlinked `check.html` (see SETUP.md).
- Delivery: **same as RSL** — GitHub Pages + Squarespace Embed block.

## League answers (2026-11-05)

- Boards: the suggested set plus rushing TDs (already in). Completion % added with a
  **25-attempt minimum** ("roughly a game's worth"); adjust in `config.js` if needed.
- Sacks: a QB can be "sacked by time" with no defender credited, so the check only flags
  *more* defensive sacks than QB sacks.
- Points ≠ TDs × 7 can be legitimate (other scoring); the check stays, worded as "fine if…".
- Blake is checking issues 1, 3, the INT mismatch and the 10/26 date, and may switch the stat
  tabs to full names (POW matching already handles both formats).
