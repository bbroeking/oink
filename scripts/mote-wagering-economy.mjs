// Deterministic exact arithmetic + short-session depletion study for wager-v1.
const table = [
  ['loss', 5000, 0, 0], ['returned_stake', 2500, 1, 0],
  ['small', 1800, 2, 0], ['big', 600, 3, 1], ['jackpot', 100, 10, 5],
];
const totalWeight = table.reduce((n, x) => n + x[1], 0);
if (totalWeight !== 10_000) throw new Error(`weights sum to ${totalWeight}`);
const grossMotes = table.reduce((n, x) => n + x[1] * x[2], 0) / totalWeight;
const acorns = table.reduce((n, x) => n + x[1] * x[3], 0) / totalWeight;
const netVariance = table.reduce((n, x) => n + x[1] * ((x[2] - 1) - (grossMotes - 1)) ** 2, 0) / totalWeight;

let state = 0x23b5eeda;
function random() { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; }
function outcome() {
  const draw = Math.floor(random() * totalWeight); let cursor = 0;
  for (const row of table) { cursor += row[1]; if (draw < cursor) return row; }
  throw new Error('gap');
}
function percentile(sorted, q) { return sorted[Math.floor((sorted.length - 1) * q)]; }
function simulate(start, stake, sessions = 100_000, cap = 20) {
  const plays = [], balances = [], earnedAcorns = []; let depleted = 0;
  for (let s = 0; s < sessions; s++) {
    let balance = start, count = 0, nuts = 0;
    while (balance >= stake && count < cap) { const row = outcome(); balance += stake * (row[2] - 1); nuts += stake * row[3]; count++; }
    if (balance < stake) depleted++;
    plays.push(count); balances.push(balance); earnedAcorns.push(nuts);
  }
  plays.sort((a,b)=>a-b); balances.sort((a,b)=>a-b); earnedAcorns.sort((a,b)=>a-b);
  return {start,stake,sessions,cap,depletedPct:+(100*depleted/sessions).toFixed(3),
    plays:{p10:percentile(plays,.1),median:percentile(plays,.5),p90:percentile(plays,.9)},
    endingMotes:{p10:percentile(balances,.1),median:percentile(balances,.5),p90:percentile(balances,.9)},
    acorns:{p10:percentile(earnedAcorns,.1),median:percentile(earnedAcorns,.5),p90:percentile(earnedAcorns,.9)}};
}
const scenarios = [];
for (const start of [5, 10, 25]) for (const stake of [1, 3, 5]) if (start >= stake) scenarios.push(simulate(start, stake));
console.log(JSON.stringify({seed:'0x23b5eeda',rulesVersion:'wager-v1',exact:{totalWeight,grossMotesPerMote:grossMotes,
  netMotesPerMote:grossMotes-1,acornsPerMote:acorns,netVariancePerMote:netVariance,
  netStdDevPerMote:Math.sqrt(netVariance),revealExpectedAcorns:1*.5+2*.3+3*.15+5*.05},scenarios},null,2));
