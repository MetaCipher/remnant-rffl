/*
 * RFFL Stats — league configuration.
 * This is the ONLY file that needs editing for normal operation.
 */
window.RFFL_CONFIG = {
  // Google Sheet ID — the long string in the sheet's URL:
  // https://docs.google.com/spreadsheets/d/<THIS PART>/edit
  // The sheet must be shared as "Anyone with the link: Viewer".
  sheetId: "1JOcKS0DCF7JYgWid5-FCBdKTxKUlRu8XQUcpWFZu1As",

  // Tab (worksheet) names inside the Google Sheet.
  tabs: {
    games: "Games",
    powOffense: "POW (O)",
    powDefense: "POW (D)",
    passing: "Passing Stats",
    rushing: "Rushing Stats",
    receiving: "Receiving Stats",
    defense: "Defensive Stats"
  },

  leagueName: "RFFL",
  subtitle: "Remnant Flag Football League",

  // Every score so far is a multiple of 7: a touchdown is worth 7 and nothing
  // else scores. The check page compares points against TDs using this.
  pointsPerTD: 7,

  // How many players per league-leader board.
  leadersTopN: 5,

  // League-leader boards, in display order. `group` is the stat tab
  // (passing, rushing, receiving, defense); `key` is the column.
  leaders: [
    { label: "Passing Yards",    group: "passing",   key: "yds" },
    { label: "Passing TDs",      group: "passing",   key: "td" },
    { label: "Rushing Yards",    group: "rushing",   key: "yds" },
    { label: "Rushing TDs",      group: "rushing",   key: "td" },
    { label: "Receptions",       group: "receiving", key: "rec" },
    { label: "Receiving Yards",  group: "receiving", key: "yds" },
    { label: "Receiving TDs",    group: "receiving", key: "td" },
    { label: "Tackles",          group: "defense",   key: "tkl" },
    { label: "Interceptions",    group: "defense",   key: "int" },
    { label: "Pass Deflections", group: "defense",   key: "pd" },
    // Rate boards need a minimum so a 1-for-1 backup can't top them.
    // League (2026-11-05): 25 passing attempts, roughly one game's worth.
    { label: "Completion %",     group: "passing",   key: "pct", fmt: "pct", min: { key: "att", value: 25 } }
  ]
};
