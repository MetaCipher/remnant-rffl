/*
 * RFFL Stats widget — reads the league's public Google Sheet and renders
 * standings, league leaders, and per-team passing/rushing/receiving/defense
 * tables. No dependencies. Requires rffl-compute.js loaded first.
 *
 * Usage: <div id="rffl-stats"></div> + window.RFFL_CONFIG (see config.js).
 * The sheet must be shared "Anyone with the link: Viewer" — data is read via
 * Google's GViz endpoint, no API key needed. Ported from remnant-rsl.
 */
(function () {
  'use strict';
  var C = window.RFFLCompute;

  /* ---------------- Google Sheets (GViz) fetch + parse ---------------- */

  function gvizUrl(sheetId, tab) {
    return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) +
      '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(tab);
  }

  function parseGviz(text) {
    var start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start < 0 || end < 0) throw new Error('Unexpected response from Google Sheets');
    var json = JSON.parse(text.slice(start, end + 1));
    if (json.status === 'error') {
      throw new Error((json.errors && json.errors[0] && json.errors[0].detail) || 'Sheet error');
    }
    var cols = (json.table.cols || []).map(function (c) { return normKey(c.label || c.id || ''); });
    return (json.table.rows || []).map(function (row) {
      var obj = {};
      cols.forEach(function (k, i) { obj[k] = cellValue((row.c || [])[i]); });
      return obj;
    });
  }

  function cellValue(cell) {
    if (!cell) return null;
    var v = cell.v;
    if (typeof v === 'string') {
      var m = /^Date\((\d+),(\d+),(\d+)/.exec(v);
      if (m) return isoDate(+m[1], +m[2] + 1, +m[3]);
      return v.trim();
    }
    return v;
  }

  function normKey(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function fetchTab(sheetId, tab) {
    return fetch(gvizUrl(sheetId, tab)).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' loading tab "' + tab + '"');
      return res.text();
    }).then(parseGviz);
  }

  /* ---------------- field aliases -> canonical rows ---------------- */

  function pick(obj, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var v = obj[aliases[i]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  }

  function isoDate(y, m, d) {
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function normDate(v) {
    if (v === null || v === undefined) return '';
    var s = String(v).trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return isoDate(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
    if (m) return isoDate(m[3].length === 2 ? 2000 + (+m[3]) : +m[3], +m[1], +m[2]);
    return s;
  }

  function shortDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? (+m[2]) + '/' + (+m[3]) : iso;
  }

  /* Header spellings vary between tabs ("TD's", "TDs", "Int. TD's") —
     normKey strips punctuation, so each alias list covers them. */
  var FIELDS = {
    passing: { cmp: ['completions', 'cmp', 'comp'], att: ['attempts', 'att'], yds: ['yards', 'yds'],
               td: ['tds', 'td', 'touchdowns'], sk: ['sacks', 'sk'], int: ['interceptions', 'ints', 'int'] },
    rushing: { car: ['rushes', 'carries', 'att', 'car'], yds: ['yards', 'yds'], td: ['tds', 'td', 'touchdowns'] },
    receiving: { rec: ['receptions', 'rec', 'catches'], yds: ['yards', 'yds'], td: ['tds', 'td', 'touchdowns'] },
    defense: { tkl: ['tackles', 'tkl'], sk: ['sacks', 'sk'], int: ['interceptions', 'ints', 'int'],
               intyds: ['intyards', 'intyds'], inttd: ['inttds', 'inttd'], pd: ['deflections', 'pd', 'passdeflections'] }
  };

  var LABELS = { cmp: 'Completions', att: 'Attempts', yds: 'Yards', td: 'TDs', sk: 'Sacks', int: 'Interceptions',
    car: 'Rushes', rec: 'Receptions', tkl: 'Tackles', intyds: 'Int. Yards', inttd: "Int. TD's", pd: 'Deflections' };

  /* Returns adapted rows; records blank stat cells into `blanks` for the check page. */
  function adaptGroup(group, rows, tab, blanks) {
    var map = FIELDS[group];
    return rows.map(function (r) {
      var out = { team: pick(r, ['team', 'teamname']) || '', player: pick(r, ['player', 'name']) || '' };
      Object.keys(map).forEach(function (f) {
        var v = pick(r, map[f]);
        if (v === null && out.team && out.player) blanks.push({ tab: tab, team: out.team, player: out.player, field: LABELS[f] });
        out[f] = v;
      });
      return out;
    }).filter(function (r) { return r.team && r.player; });
  }

  function adaptGames(rows) {
    return rows.map(function (r) {
      return {
        date: normDate(pick(r, ['date', 'week'])),
        team1: pick(r, ['team1', 'home', 'teama']) || '',
        score1: pick(r, ['score1', 'homescore', 'scorea']),
        team2: pick(r, ['team2', 'away', 'teamb']) || '',
        score2: pick(r, ['score2', 'awayscore', 'scoreb'])
      };
    }).filter(function (g) { return g.team1 && g.team2 && g.score1 !== null && g.score2 !== null; });
  }

  function adaptPow(rows) {
    return rows.map(function (r) {
      return {
        date: normDate(pick(r, ['date', 'week'])),
        team: pick(r, ['team']) || '',
        player: pick(r, ['player', 'name']) || '',
        note: pick(r, ['note', 'notes']) || ''
      };
    }).filter(function (r) { return r.player; });
  }

  /* Loads every tab. POW tabs are optional; stat tabs and Games must exist. */
  function load(cfg) {
    var id = new URLSearchParams(window.location.search).get('sheet') || cfg.sheetId;
    var t = cfg.tabs || {};
    function opt(tab) { return fetchTab(id, tab).catch(function () { return []; }); }
    return Promise.all([
      fetchTab(id, t.games || 'Games'), opt(t.powOffense || 'POW (O)'), opt(t.powDefense || 'POW (D)'),
      fetchTab(id, t.passing || 'Passing Stats'), fetchTab(id, t.rushing || 'Rushing Stats'),
      fetchTab(id, t.receiving || 'Receiving Stats'), fetchTab(id, t.defense || 'Defensive Stats')
    ]).then(function (res) {
      var blanks = [];
      var raw = {
        passing: adaptGroup('passing', res[3], t.passing || 'Passing Stats', blanks),
        rushing: adaptGroup('rushing', res[4], t.rushing || 'Rushing Stats', blanks),
        receiving: adaptGroup('receiving', res[5], t.receiving || 'Receiving Stats', blanks),
        defense: adaptGroup('defense', res[6], t.defense || 'Defensive Stats', blanks)
      };
      var groups = {};
      Object.keys(raw).forEach(function (g) { groups[g] = C.players(g, raw[g]); });
      return { games: adaptGames(res[0]), pow: { o: adaptPow(res[1]), d: adaptPow(res[2]) }, groups: groups, blanks: blanks };
    });
  }

  /* ---------------- formatting ---------------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(v, kind) {
    if (v === null || v === undefined) return '';
    switch (kind) {
      case 'pct': return (v * 100).toFixed(1) + '%';
      case 'dec1': return v.toFixed(1);
      case 'avg3': return v.toFixed(3).replace(/^0\./, '.');
      case 'sint': return (v > 0 ? '+' : '') + Math.round(v);
      case 'gb': return v <= 0 ? '—' : v.toFixed(1);
      default: return String(Math.round(v));
    }
  }

  /* ---------------- column definitions ---------------- */

  var P = { key: 'player', label: 'Player', title: 'Player', text: true };
  var COLS = {
    passing: [P,
      { key: 'cmp', label: 'CMP', title: 'Completions' },
      { key: 'att', label: 'ATT', title: 'Attempts' },
      { key: 'pct', label: 'PCT', title: 'Completion %: CMP / ATT', fmt: 'pct' },
      { key: 'yds', label: 'YDS', title: 'Passing yards' },
      { key: 'ypa', label: 'Y/A', title: 'Yards per attempt', fmt: 'dec1' },
      { key: 'td', label: 'TD', title: 'Passing touchdowns' },
      { key: 'int', label: 'INT', title: 'Interceptions thrown' },
      { key: 'sk', label: 'SK', title: 'Times sacked' }],
    rushing: [P,
      { key: 'car', label: 'CAR', title: 'Rushes' },
      { key: 'yds', label: 'YDS', title: 'Rushing yards' },
      { key: 'ypc', label: 'Y/C', title: 'Yards per carry', fmt: 'dec1' },
      { key: 'td', label: 'TD', title: 'Rushing touchdowns' }],
    receiving: [P,
      { key: 'rec', label: 'REC', title: 'Receptions' },
      { key: 'yds', label: 'YDS', title: 'Receiving yards' },
      { key: 'ypr', label: 'Y/R', title: 'Yards per reception', fmt: 'dec1' },
      { key: 'td', label: 'TD', title: 'Receiving touchdowns' }],
    defense: [P,
      { key: 'tkl', label: 'TKL', title: 'Tackles (flag pulls)' },
      { key: 'sk', label: 'SK', title: 'Sacks' },
      { key: 'int', label: 'INT', title: 'Interceptions' },
      { key: 'intyds', label: 'INT YDS', title: 'Interception return yards' },
      { key: 'inttd', label: 'INT TD', title: 'Interceptions returned for a TD' },
      { key: 'pd', label: 'PD', title: 'Pass deflections' }]
  };
  var GROUP_TITLES = { passing: 'Passing', rushing: 'Rushing', receiving: 'Receiving', defense: 'Defense' };
  var DEFAULT_SORT = { passing: 'yds', rushing: 'yds', receiving: 'yds', defense: 'tkl' };

  var STANDINGS_COLS = [
    { key: 'team', label: 'Team', title: 'Team', text: true },
    { key: 'w', label: 'W', title: 'Wins' },
    { key: 'l', label: 'L', title: 'Losses' },
    { key: 't', label: 'T', title: 'Ties' },
    { key: 'pct', label: 'PCT', title: 'Win % (ties count half)', fmt: 'avg3' },
    { key: 'pf', label: 'PF', title: 'Points for' },
    { key: 'pa', label: 'PA', title: 'Points against' },
    { key: 'diff', label: 'DIFF', title: 'Point differential', fmt: 'sint' },
    { key: 'gb', label: 'GB', title: 'Games back', fmt: 'gb' },
    { key: 'strk', label: 'STRK', title: 'Current streak', text: true }
  ];

  /* ---------------- widget ---------------- */

  function init(container, config) {
    var cfg = config || window.RFFL_CONFIG || {};
    var state = { el: container, cfg: cfg, view: null, sort: {}, data: null };
    Object.keys(DEFAULT_SORT).forEach(function (g) { state.sort[g] = { key: DEFAULT_SORT[g], dir: -1 }; });
    container.innerHTML = '<div class="rffl"><div class="rffl-loading"><div class="rffl-spin"></div>Loading stats…</div></div>';

    load(cfg).then(function (d) {
      var standings = C.standings(d.games);
      var names = {};
      standings.forEach(function (s) { names[s.team.toLowerCase()] = s.team; });
      Object.keys(d.groups).forEach(function (g) {
        d.groups[g].forEach(function (p) { if (!names[p.team.toLowerCase()]) names[p.team.toLowerCase()] = p.team; });
      });
      var through = '';
      d.games.forEach(function (g) { if (g.date > through) through = g.date; });
      state.data = {
        groups: d.groups, games: d.games, pow: d.pow, standings: standings, through: through,
        teams: Object.keys(names).map(function (k) { return names[k]; }).sort(function (a, b) { return a.localeCompare(b); })
      };
      var v = new URLSearchParams(window.location.search).get('view');
      state.view = validView(state, v) ? v : (standings.length ? 'standings' : 'leaders');
      render(state);
    }).catch(function (err) {
      container.innerHTML = '<div class="rffl"><div class="rffl-error"><strong>Couldn&#39;t load stats.</strong><br>' +
        esc(err.message || err) + '<br><span>Check that the Google Sheet is shared as &quot;Anyone with the link: Viewer&quot; ' +
        'and the tab names match the config.</span></div></div>';
    });
  }

  function validView(state, v) {
    if (v === 'standings') return state.data.standings.length > 0;
    if (v === 'leaders') return true;
    if (v && v.indexOf('team:') === 0) {
      var name = v.slice(5).toLowerCase();
      return state.data.teams.some(function (t) { return t.toLowerCase() === name; });
    }
    return false;
  }

  function yearOf(iso) { var m = /^(\d{4})-/.exec(iso); return m ? m[1] : ''; }

  /* Shell (masthead + tabs) renders once; tab/sort changes only redraw the
     body, so the tab strip's horizontal scroll survives a click. */
  function render(state) {
    var d = state.data, cfg = state.cfg;
    var html = '<div class="rffl"><header class="rffl-masthead"><div>' +
      '<h2 class="rffl-league">' + esc(cfg.leagueName || 'League Stats') + '</h2>' +
      (cfg.subtitle ? '<div class="rffl-season">' + esc(cfg.subtitle) + '</div>' : '') + '</div>';
    if (d.through) {
      html += '<div class="rffl-updated">Stats through <strong>' + esc(shortDate(d.through)) + '</strong>' +
        '<div class="rffl-year">' + yearOf(d.through) + '</div></div>';
    }
    html += '</header><nav class="rffl-tabs" role="tablist">';
    if (d.standings.length) html += tabBtn(state, 'standings', 'Standings');
    html += tabBtn(state, 'leaders', 'Leaders');
    d.teams.forEach(function (t) { html += tabBtn(state, 'team:' + t, t); });
    html += '</nav><main class="rffl-body"></main></div>';
    state.el.innerHTML = html;

    state.el.querySelectorAll('.rffl-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.view = btn.getAttribute('data-view');
        state.el.querySelectorAll('.rffl-tab').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-selected', b === btn);
        });
        renderBody(state);
      });
    });
    renderBody(state);
  }

  function renderBody(state) {
    var body = state.el.querySelector('.rffl-body');
    var doc = document.scrollingElement || document.documentElement, keepY = doc.scrollTop;
    if (state.view === 'standings') body.innerHTML = renderStandings(state);
    else if (state.view === 'leaders') body.innerHTML = renderLeaders(state);
    else body.innerHTML = renderTeam(state, state.view.slice(5));
    doc.scrollTop = keepY;
    body.querySelectorAll('[data-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var g = btn.getAttribute('data-group'), key = btn.getAttribute('data-sort');
        if (!g) return; // standings keep rank order
        var s = state.sort[g];
        if (s.key === key) s.dir *= -1; else state.sort[g] = { key: key, dir: key === 'player' ? 1 : -1 };
        renderBody(state);
      });
    });
  }

  function tabBtn(state, view, label) {
    var active = state.view.toLowerCase() === view.toLowerCase();
    return '<button type="button" role="tab" data-view="' + esc(view) + '" class="rffl-tab' +
      (active ? ' is-active' : '') + '" aria-selected="' + active + '">' + esc(label) + '</button>';
  }

  function table(cols, rows, sort, group, rankCol) {
    var html = '<div class="rffl-tablewrap"><table class="rffl-table"><thead><tr>';
    if (rankCol) html += '<th class="rffl-rank" aria-label="Rank"></th>';
    cols.forEach(function (c) {
      var is = sort && sort.key === c.key;
      html += '<th' + (c.text ? ' class="rffl-textcol"' : '') + '><button type="button" data-sort="' + c.key + '"' +
        (group ? ' data-group="' + group + '"' : '') + ' title="' + esc(c.title) + '"' + (is ? ' class="is-sorted"' : '') + '>' +
        esc(c.label) + (is ? '<span class="rffl-caret">' + (sort.dir < 0 ? '▾' : '▴') + '</span>' : '') + '</button></th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row, i) {
      html += '<tr>' + (rankCol ? '<td class="rffl-rank">' + (i + 1) + '</td>' : '');
      cols.forEach(function (c) {
        var v = row[c.key];
        html += c.text ? '<td class="rffl-textcol">' + esc(v == null ? '' : v) + '</td>' : '<td>' + fmt(v, c.fmt) + '</td>';
      });
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  function sortRows(rows, sort) {
    return rows.slice().sort(function (a, b) {
      var av = a[sort.key], bv = b[sort.key];
      var cmp = typeof av === 'string' ? String(av).localeCompare(String(bv)) : (av || 0) - (bv || 0);
      return (cmp * sort.dir) || a.player.localeCompare(b.player);
    });
  }

  function powCard(p, kicker) {
    if (!p) return '';
    return '<div class="rffl-pow"><span class="rffl-pow-star">★</span><div>' +
      '<div class="rffl-pow-kicker">' + kicker + (p.date ? ' · ' + esc(shortDate(p.date)) : '') + '</div>' +
      '<div class="rffl-pow-name">' + esc(p.player) + (p.team ? ' <em>' + esc(p.team) + '</em>' : '') + '</div>' +
      (p.note ? '<div class="rffl-pow-note">' + esc(p.note) + '</div>' : '') + '</div></div>';
  }

  function renderPows(state) {
    var o = C.currentPow(state.data.pow.o), d = C.currentPow(state.data.pow.d);
    if (!o && !d) return '';
    return '<div class="rffl-pows">' + powCard(o, 'Offensive Player of the Week') +
      powCard(d, 'Defensive Player of the Week') + '</div>';
  }

  function renderStandings(state) {
    var d = state.data;
    var html = renderPows(state) + '<h3 class="rffl-viewtitle">Team Standings</h3>' +
      table(STANDINGS_COLS, d.standings, null, null, true);
    var games = d.games.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    if (games.length) {
      html += '<h3 class="rffl-viewtitle">Results</h3><ul class="rffl-results">';
      games.forEach(function (g) {
        var w1 = +g.score1 > +g.score2, w2 = +g.score2 > +g.score1;
        html += '<li><span class="rffl-rdate">' + esc(shortDate(g.date)) + '</span>' +
          '<span' + (w1 ? ' class="is-win"' : '') + '>' + esc(g.team1) + ' <b>' + esc(g.score1) + '</b></span>' +
          '<span class="rffl-rsep">–</span>' +
          '<span' + (w2 ? ' class="is-win"' : '') + '><b>' + esc(g.score2) + '</b> ' + esc(g.team2) + '</span></li>';
      });
      html += '</ul>';
    }
    return html;
  }

  function renderLeaders(state) {
    var boards = C.leaders(state.data.groups, state.cfg.leaders, state.cfg.leadersTopN || 5);
    var html = renderPows(state);
    if (!boards.length) return html + '<p class="rffl-empty">No stats yet — check back after the first games!</p>';
    html += '<h3 class="rffl-viewtitle">League Leaders</h3><div class="rffl-boards">';
    boards.forEach(function (b) {
      html += '<section class="rffl-board"><h4>' + esc(b.label) +
        (b.min ? '<span class="rffl-qual">min ' + b.min.value + ' ' + esc(b.min.key.toUpperCase()) + '</span>' : '') + '</h4><ol>';
      b.top.forEach(function (row) {
        html += '<li><span class="rffl-lrank">' + row.rank + '</span><span class="rffl-lname">' + esc(row.p.player) +
          ' <em>' + esc(row.p.team) + '</em></span><span class="rffl-lval">' + fmt(row.p[b.key], b.fmt) + '</span></li>';
      });
      html += '</ol></section>';
    });
    return html + '</div>';
  }

  function teamTop(rows, key) {
    var best = null;
    rows.forEach(function (p) { if (p[key] > 0 && (!best || p[key] > best[key])) best = p; });
    return best;
  }

  function renderTeam(state, teamName) {
    var d = state.data, k = teamName.toLowerCase();
    var team = d.teams.filter(function (t) { return t.toLowerCase() === k; })[0] || teamName;
    var rec = d.standings.filter(function (s) { return s.team.toLowerCase() === k; })[0];
    var mine = {};
    Object.keys(d.groups).forEach(function (g) {
      mine[g] = d.groups[g].filter(function (p) { return p.team.toLowerCase() === k; });
    });

    var html = '<div class="rffl-teamhead"><h3 class="rffl-viewtitle">' + esc(team) + '</h3>' +
      (rec ? '<div class="rffl-record">' + rec.w + '–' + rec.l + (rec.t ? '–' + rec.t : '') +
        ' <span>' + rec.pf + ' PF · ' + rec.pa + ' PA</span></div>' : '') + '</div>';

    var strip = [['Passing yds', mine.passing, 'yds'], ['Rushing yds', mine.rushing, 'yds'],
      ['Receiving yds', mine.receiving, 'yds'], ['Tackles', mine.defense, 'tkl'], ['Interceptions', mine.defense, 'int']];
    var cards = strip.map(function (s) {
      var p = teamTop(s[1], s[2]);
      return p ? '<div class="rffl-card"><div class="rffl-card-stat">' + s[0] + '</div><div class="rffl-card-val">' +
        fmt(p[s[2]]) + '</div><div class="rffl-card-name">' + esc(p.player) + '</div></div>' : '';
    }).join('');
    if (cards) html += '<div class="rffl-cards">' + cards + '</div>';

    var any = false;
    Object.keys(COLS).forEach(function (g) {
      if (!mine[g].length) return;
      any = true;
      html += '<h4 class="rffl-grouptitle">' + GROUP_TITLES[g] + '</h4>' + table(COLS[g], sortRows(mine[g], state.sort[g]), state.sort[g], g);
    });
    if (!any) html += '<p class="rffl-empty">No player stats for ' + esc(team) + ' yet.</p>';
    return html;
  }

  /* ---------------- bootstrap ---------------- */

  window.RFFLStats = { init: init, load: load, esc: esc };

  function autoInit() {
    var el = document.getElementById('rffl-stats');
    if (el) init(el, window.RFFL_CONFIG);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInit);
  else autoInit();
})();
