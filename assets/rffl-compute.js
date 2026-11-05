/*
 * RFFL Stats — pure stats engine (no DOM). Loaded in the browser as
 * window.RFFLCompute and in node via require() for tests.
 *
 * Input rows are already adapted (see rffl-stats.js): one row per player per
 * stat tab, season totals typed into the sheet by the league. Nothing here is
 * per-game — the sheet has no per-player games played.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RFFLCompute = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function div(n, d) { return d > 0 ? n / d : 0; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function lc(s) { return String(s || '').toLowerCase(); }

  /* Counting fields per stat tab (canonical keys the adapter produces). */
  var GROUPS = {
    passing: ['cmp', 'att', 'yds', 'td', 'sk', 'int'],
    rushing: ['car', 'yds', 'td'],
    receiving: ['rec', 'yds', 'td'],
    defense: ['tkl', 'sk', 'int', 'intyds', 'inttd', 'pd']
  };

  /* Standard rate stats — shown in team tables; leader boards for them need a
     league minimum (config `min`) so a 1-for-1 backup can't top the list. */
  function derive(group, p) {
    if (group === 'passing') { p.pct = div(p.cmp, p.att); p.ypa = div(p.yds, p.att); }
    if (group === 'rushing') p.ypc = div(p.yds, p.car);
    if (group === 'receiving') p.ypr = div(p.yds, p.rec);
    return p;
  }

  /* Sums duplicate team+player rows (a player typed twice) and derives rates. */
  function players(group, rows) {
    var fields = GROUPS[group], byKey = {}, order = [];
    (rows || []).forEach(function (r) {
      if (!r.team || !r.player) return;
      var key = lc(r.team) + '|' + lc(r.player);
      if (!byKey[key]) {
        byKey[key] = { team: r.team, player: r.player };
        fields.forEach(function (f) { byKey[key][f] = 0; });
        order.push(key);
      }
      fields.forEach(function (f) { byKey[key][f] += num(r[f]); });
    });
    return order.map(function (k) { return derive(group, byKey[k]); });
  }

  function chronoSort(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq; }

  /* Standings from the Games tab (same rules as remnant-rsl: ties count half,
     tiebreak on point differential per game). */
  function standings(games) {
    var teams = {};
    function get(name) {
      var key = lc(name);
      if (!teams[key]) teams[key] = { team: name, gp: 0, w: 0, l: 0, t: 0, pf: 0, pa: 0, results: [] };
      return teams[key];
    }
    (games || []).forEach(function (g, i) {
      if (!g.team1 || !g.team2) return;
      var s1 = num(g.score1), s2 = num(g.score2), a = get(g.team1), b = get(g.team2);
      var ra = s1 > s2 ? 'W' : s1 < s2 ? 'L' : 'T', rb = s1 > s2 ? 'L' : s1 < s2 ? 'W' : 'T';
      a.gp++; b.gp++; a.pf += s1; a.pa += s2; b.pf += s2; b.pa += s1;
      a[lc(ra)]++; b[lc(rb)]++;
      a.results.push({ date: g.date || '', seq: i, r: ra });
      b.results.push({ date: g.date || '', seq: i, r: rb });
    });
    var list = Object.keys(teams).map(function (k) {
      var t = teams[k], cur = 0, curType = '';
      t.results.sort(chronoSort).forEach(function (res) {
        if (res.r === curType) cur++; else { curType = res.r; cur = 1; }
      });
      t.strk = t.results.length ? cur + curType : '-';
      t.pct = div(t.w + 0.5 * t.t, t.gp);
      t.diff = t.pf - t.pa;
      t.dpg = div(t.diff, t.gp);
      delete t.results;
      return t;
    });
    list.sort(function (a, b) { return (b.pct - a.pct) || (b.dpg - a.dpg) || a.team.localeCompare(b.team); });
    if (list.length) {
      var lead = list[0];
      list.forEach(function (t) { t.gb = ((lead.w - t.w) + (t.l - lead.l)) / 2; });
    }
    return list;
  }

  /* Leader boards. Each board: { label, group, key, min: {key, value} | absent }.
     Players with 0 are left off; equal values share a rank. */
  function leaders(groups, boards, topN) {
    return (boards || []).map(function (b) {
      var pool = (groups[b.group] || []).filter(function (p) {
        if (!(p[b.key] > 0)) return false;
        return !b.min || p[b.min.key] >= b.min.value;
      });
      pool.sort(function (x, y) { return (y[b.key] - x[b.key]) || x.player.localeCompare(y.player); });
      var top = [], prev = null, rank = 0;
      pool.forEach(function (p, i) {
        if (p[b.key] !== prev) { rank = i + 1; prev = p[b.key]; }
        if (rank <= (topN || 5)) top.push({ rank: rank, p: p });
      });
      return { label: b.label, key: b.key, fmt: b.fmt, min: b.min, top: top };
    }).filter(function (b) { return b.top.length; });
  }

  /* The newest POW row (one per week going forward). */
  function currentPow(rows) {
    var best = null;
    (rows || []).forEach(function (r) { if (!best || r.date > best.date) best = r; });
    return best;
  }

  /* POW rows use full names ("Sam Rivers"); stat tabs use "Sam R." / "Jo Sm.".
     True when some stat row on the same team is first name + a prefix of the last name. */
  function powMatches(pow, statPlayers) {
    var parts = String(pow.player || '').trim().split(/\s+/);
    var first = lc(parts[0]), last = lc(parts.slice(1).join(' '));
    return statPlayers.some(function (p) {
      if (lc(p.team) !== lc(pow.team)) return false;
      var sp = String(p.player).trim().split(/\s+/);
      var sl = lc(sp.slice(1).join(' ')).replace(/\./g, '');
      return lc(sp[0]) === first && (sl === '' || last.indexOf(sl) === 0 || lc(p.player) === lc(pow.player));
    });
  }

  function sum(rows, team, key) {
    return rows.reduce(function (s, r) { return lc(r.team) === lc(team) ? s + num(r[key]) : s; }, 0);
  }
  function total(rows, key) { return rows.reduce(function (s, r) { return s + num(r[key]); }, 0); }

  /* Data checks for the maintainer page. Each finding: { team, msg }.
     The tabs are meant to tie out: every completion is a reception, every
     passing TD a receiving TD, and points = TDs × pointsPerTD. */
  function checks(d, cfg) {
    cfg = cfg || {};
    var out = [], g = d.groups, ppt = cfg.pointsPerTD;
    var st = standings(d.games);
    var teams = {};
    st.forEach(function (t) { teams[lc(t.team)] = t.team; });
    Object.keys(g).forEach(function (k) {
      g[k].forEach(function (p) {
        if (!teams[lc(p.team)]) { teams[lc(p.team)] = p.team; out.push({ team: p.team, msg: 'Team appears in ' + k + ' stats but has no games on the Games tab — spelling?' }); }
      });
    });
    function pair(team, a, aLabel, b, bLabel) {
      if (a !== b) out.push({ team: team, msg: aLabel + ' (' + a + ') ≠ ' + bLabel + ' (' + b + ')' });
    }
    Object.keys(teams).forEach(function (k) {
      var t = teams[k];
      pair(t, sum(g.passing, t, 'cmp'), 'Completions', sum(g.receiving, t, 'rec'), 'receptions');
      pair(t, sum(g.passing, t, 'yds'), 'Passing yards', sum(g.receiving, t, 'yds'), 'receiving yards');
      pair(t, sum(g.passing, t, 'td'), 'Passing TDs', sum(g.receiving, t, 'td'), 'receiving TDs');
      var rec = st.filter(function (s) { return lc(s.team) === k; })[0];
      if (ppt && rec) {
        var tds = sum(g.passing, t, 'td') + sum(g.rushing, t, 'td') + sum(g.defense, t, 'inttd');
        if (tds * ppt !== rec.pf) {
          out.push({ team: t, msg: rec.pf + ' points on the Games tab = ' + (rec.pf / ppt) + ' TDs, but the stats show ' +
            tds + ' (passing + rushing + INT returns). Fine if there was other scoring that game.' });
        }
      }
    });
    // A QB can be "sacked by time" with no defender credited, so only more
    // defensive sacks than QB sacks is a real mismatch.
    var skTaken = total(g.passing, 'sk'), skMade = total(g.defense, 'sk');
    if (skMade > skTaken) out.push({ team: 'League', msg: 'Sacks credited on defense (' + skMade + ') > sacks taken by QBs (' + skTaken + ')' });
    pair('League', total(g.passing, 'int'), 'Interceptions thrown', total(g.defense, 'int'), 'interceptions caught');
    (d.blanks || []).forEach(function (b) {
      out.push({ team: b.team, msg: b.tab + ': ' + b.player + ' has a blank ' + b.field + ' cell' });
    });
    // a game date on a different weekday than most games is usually a typo
    var days = {}, best = null;
    (d.games || []).forEach(function (gm) { var w = weekday(gm.date); if (w !== null) days[w] = (days[w] || 0) + 1; });
    Object.keys(days).forEach(function (w) { if (best === null || days[w] > days[best]) best = w; });
    var odd = {};
    (d.games || []).forEach(function (gm) {
      var w = weekday(gm.date);
      if (w !== null && String(w) !== String(best)) (odd[gm.date] = odd[gm.date] || []).push(gm.team1 + ' vs ' + gm.team2);
    });
    Object.keys(odd).forEach(function (date) {
      out.push({ team: 'Games', msg: date + ' is a ' + DAYS[weekday(date)] + '; most games are on ' + DAYS[best] +
        's — typo? (' + odd[date].join(', ') + ')' });
    });
    var all = [].concat(g.passing, g.rushing, g.receiving, g.defense);
    ['o', 'd'].forEach(function (side) {
      (d.pow[side] || []).forEach(function (p) {
        if (!powMatches(p, all)) out.push({ team: p.team, msg: 'Player of the Week "' + p.player + '" (' + p.date + ') doesn’t match anyone on ' + p.team + '’s stat rows' });
      });
    });
    return out;
  }

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function weekday(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() : null;
  }

  return {
    GROUPS: GROUPS, players: players, standings: standings, leaders: leaders,
    currentPow: currentPow, powMatches: powMatches, checks: checks
  };
});
