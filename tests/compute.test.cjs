/*
 * RFFL compute engine tests. Run: node tests/compute.test.cjs
 * Standings use the real 2026 Games tab (team names + scores only); every
 * other fixture is synthetic so no player names land in this public repo.
 */
const assert = require('assert');
const C = require('../assets/rffl-compute.js');

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('  ok - ' + name); }

const GAMES = [
  ['2026-10-18', 'Iron Faith', 63, 'Righteous Fury', 49],
  ['2026-10-18', 'Eternal Wave', 49, 'Iron Faith', 63],
  ['2026-10-18', 'Pureforce', 91, 'Eternal Wave', 28],
  ['2026-10-26', 'Righteous Fury', 77, 'Pureforce', 49],
  ['2026-10-26', 'Iron Faith', 63, 'Pureforce', 49],
  ['2026-10-26', 'Eternal Wave', 49, 'Righteous Fury', 77],
  ['2026-11-01', 'Righteous Fury', 77, 'Iron Faith', 70],
  ['2026-11-01', 'Iron Faith', 98, 'Eternal Wave', 35],
  ['2026-11-01', 'Eternal Wave', 70, 'Pureforce', 77],
].map(([date, team1, score1, team2, score2]) => ({ date, team1, score1, team2, score2 }));

console.log('standings (real 2026 games):');
check('records, points and order', () => {
  const s = C.standings(GAMES).map(t => [t.team, t.w, t.l, t.pf, t.pa]);
  assert.deepStrictEqual(s, [
    ['Iron Faith', 4, 1, 357, 259],
    ['Righteous Fury', 3, 1, 280, 231],
    ['Pureforce', 2, 2, 266, 238],
    ['Eternal Wave', 0, 5, 231, 406],
  ]);
});
check('games back and streaks', () => {
  const s = C.standings(GAMES);
  assert.deepStrictEqual(s.map(t => t.gb), [0, 0.5, 1.5, 4]);
  assert.strictEqual(s[0].strk, '1W'); // lost 11/1 early game, won the late one
  assert.strictEqual(s[3].strk, '5L');
});

console.log('players + rates:');
check('duplicate rows sum, rates derive', () => {
  const p = C.players('passing', [
    { team: 'A', player: 'Q1', cmp: 6, att: 10, yds: 80, td: 1, sk: 0, int: 0 },
    { team: 'a', player: 'q1', cmp: 4, att: 10, yds: 70, td: 1, sk: 1, int: 1 },
  ]);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].cmp, 10);
  assert.strictEqual(p[0].pct, 0.5);
  assert.strictEqual(p[0].ypa, 7.5);
});
check('zero attempts never divides by zero', () => {
  assert.strictEqual(C.players('rushing', [{ team: 'A', player: 'R', car: 0, yds: 0, td: 0 }])[0].ypc, 0);
});

console.log('leaders:');
const REC = C.players('receiving', [
  { team: 'A', player: 'W1', rec: 10, yds: 100, td: 2 },
  { team: 'A', player: 'W2', rec: 8, yds: 100, td: 1 },
  { team: 'B', player: 'W3', rec: 1, yds: 60, td: 0 },
  { team: 'B', player: 'W4', rec: 0, yds: 0, td: 0 },
]);
check('ties share a rank; zeros are left off', () => {
  const [b] = C.leaders({ receiving: REC }, [{ label: 'Yds', group: 'receiving', key: 'yds' }], 5);
  assert.deepStrictEqual(b.top.map(r => [r.rank, r.p.player]), [[1, 'W1'], [1, 'W2'], [3, 'W3']]);
});
check('min qualifier keeps the 1-catch guy off a rate board', () => {
  const [b] = C.leaders({ receiving: REC }, [{ label: 'Y/R', group: 'receiving', key: 'ypr', min: { key: 'rec', value: 5 } }], 5);
  assert.deepStrictEqual(b.top.map(r => r.p.player), ['W2', 'W1']);
});
check('topN cuts by rank, keeping ties at the line', () => {
  const [b] = C.leaders({ receiving: REC }, [{ label: 'Yds', group: 'receiving', key: 'yds' }], 1);
  assert.strictEqual(b.top.length, 2);
});

console.log('POW name matching:');
const ROSTER = [{ team: 'A', player: 'Sam R.' }, { team: 'A', player: 'Jo Sm.' }, { team: 'B', player: 'Pat' }];
check('full name matches "First L." on the same team', () => {
  assert.ok(C.powMatches({ team: 'A', player: 'Sam Rivers' }, ROSTER));
  assert.ok(C.powMatches({ team: 'A', player: 'Jo Smith' }, ROSTER));
  assert.ok(C.powMatches({ team: 'B', player: 'Pat Jones' }, ROSTER));
});
check('wrong team or wrong initial does not match', () => {
  assert.ok(!C.powMatches({ team: 'B', player: 'Sam Rivers' }, ROSTER));
  assert.ok(!C.powMatches({ team: 'A', player: 'Sam Brown' }, ROSTER));
});

console.log('checks:');
function clean() {
  return {
    games: [{ date: '2026-10-18', team1: 'A', score1: 14, team2: 'B', score2: 7 }],
    pow: { o: [{ date: '2026-10-18', team: 'A', player: 'Quinn Q' }], d: [] },
    blanks: [],
    groups: {
      passing: C.players('passing', [{ team: 'A', player: 'Quinn Q.', cmp: 3, att: 4, yds: 40, td: 1, sk: 1, int: 0 },
                                      { team: 'B', player: 'Bo B.', cmp: 2, att: 3, yds: 20, td: 1, sk: 0, int: 1 }]),
      rushing: C.players('rushing', [{ team: 'A', player: 'Quinn Q.', car: 2, yds: 10, td: 1 }]),
      receiving: C.players('receiving', [{ team: 'A', player: 'Ray R.', rec: 3, yds: 40, td: 1 },
                                          { team: 'B', player: 'Cy C.', rec: 2, yds: 20, td: 1 }]),
      defense: C.players('defense', [{ team: 'A', player: 'Dee D.', tkl: 3, sk: 0, int: 1, intyds: 5, inttd: 0, pd: 1 },
                                      { team: 'B', player: 'Eli E.', tkl: 2, sk: 1, int: 0, intyds: 0, inttd: 0, pd: 0 }]),
    },
  };
}
check('a sheet that ties out has no findings', () => {
  assert.deepStrictEqual(C.checks(clean(), { pointsPerTD: 7 }), []);
});
check('each kind of problem is reported', () => {
  const d = clean();
  d.groups.receiving[0].rec = 2;          // completions ≠ receptions
  d.groups.defense[1].sk = 2;             // more sacks credited than taken
  d.games.push({ date: '2026-10-19', team1: 'A', score1: 0, team2: 'B', score2: 0 }); // a Monday
  d.blanks.push({ tab: 'Receiving Stats', team: 'A', player: 'Ray R.', field: 'TDs' });
  d.pow.d.push({ date: '2026-10-18', team: 'B', player: 'Nobody Here' });
  const msgs = C.checks(d, { pointsPerTD: 7 }).map(f => f.msg).join('\n');
  for (const want of ['Completions (3) ≠ receptions (2)', 'Sacks credited on defense (2) > sacks taken by QBs (1)',
    'is a Monday', 'blank TDs cell', '"Nobody Here"']) {
    assert.ok(msgs.includes(want), 'missing: ' + want + '\n' + msgs);
  }
});
check('a sack by time (QB sacked, no defender credited) is not flagged', () => {
  const d = clean();
  d.groups.passing[0].sk = 3;
  assert.deepStrictEqual(C.checks(d, { pointsPerTD: 7 }), []);
});
check('points vs TDs uses pointsPerTD', () => {
  const d = clean();
  d.games[0].score1 = 21; // 3 TDs on the scoreboard, 2 in the stats
  const f = C.checks(d, { pointsPerTD: 7 });
  assert.strictEqual(f.length, 1);
  assert.ok(f[0].msg.startsWith('21 points'));
});

console.log(`\n${passed} passed`);
