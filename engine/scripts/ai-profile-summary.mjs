// Summary of the AI profile study (prompt 12, engine/scripts/ai-profile-study.sh).
//
//   node engine/scripts/ai-profile-summary.mjs plan.json games.jsonl summary.json > summary.md
//
// Win rates: every non-default profile against Default over all its games
// (both seat orders, all decks), with a 95 % Wilson interval. Because both
// seat orders of a seed start from the same shuffles, a seed is also a pair:
// a sign test counts the seeds where the profile won both games against those
// where it lost both (split seeds - each seat won once - say nothing about
// the profile). Behaviour: what each seat did per game and per own turn, from
// Forge's structured game events (no texts). Default against Default is the
// control: its win rate by seat order shows how much the seat decides.
import fs from "node:fs"

const [planFile, gamesFile, summaryFile] = process.argv.slice(2)
if (!planFile || !gamesFile || !summaryFile) {
  console.error("usage: ai-profile-summary.mjs plan.json games.jsonl summary.json")
  process.exit(2)
}
const plan = JSON.parse(fs.readFileSync(planFile, "utf8"))
const games = fs
  .readFileSync(gamesFile, "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => JSON.parse(line))

const failures = games.filter((g) => g.failure !== undefined)
const played = games.filter((g) => g.failure === undefined)
const withErrors = played.filter((g) => g.errors.length > 0)

/** 95 % Wilson score interval of k successes in n trials. */
function wilson(k, n) {
  if (n === 0) return [0, 1]
  const z = 1.959964
  const p = k / n
  const d = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / d
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.max(0, center - half), Math.min(1, center + half)]
}

function logChoose(n, k) {
  let s = 0
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i)
  return s
}

/** Two-sided exact binomial test of k successes in n trials against p = 0.5. */
function signTest(k, n) {
  if (n === 0) return 1
  const probability = (i) => Math.exp(logChoose(n, i) - n * Math.LN2)
  const observed = probability(k)
  let p = 0
  for (let i = 0; i <= n; i++) {
    const q = probability(i)
    if (q <= observed * (1 + 1e-9)) p += q
  }
  return Math.min(1, p)
}

const METRICS = [
  "ownTurns",
  "mulligans",
  "attackTurns",
  "attackers",
  "attackersFaced",
  "blockers",
  "blockedAttackers",
  "spells",
  "counterspells",
  "spellsInOpponentsTurn",
  "lands",
  "damageTaken",
  "combatDamageTaken",
]

function emptyTotals() {
  return { games: 0, wins: 0, draws: 0, turns: 0, life: 0, ...Object.fromEntries(METRICS.map((m) => [m, 0])) }
}

function addSeat(totals, game, seat) {
  totals.games++
  if (seat.won) totals.wins++
  if (game.draw) totals.draws++
  totals.turns += game.turns
  totals.life += seat.life
  for (const m of METRICS) totals[m] += seat[m]
}

/** Per game / per own turn / per attacker faced, as the tables show them. */
function rates(t) {
  const perGame = (v) => (t.games === 0 ? 0 : v / t.games)
  return {
    games: t.games,
    winRate: t.games === 0 ? 0 : t.wins / t.games,
    turnsPerGame: perGame(t.turns),
    mulligansPerGame: perGame(t.mulligans),
    attackTurnShare: t.ownTurns === 0 ? 0 : t.attackTurns / t.ownTurns,
    attackersPerOwnTurn: t.ownTurns === 0 ? 0 : t.attackers / t.ownTurns,
    blockersPerAttackerFaced: t.attackersFaced === 0 ? 0 : t.blockers / t.attackersFaced,
    blockedShare: t.attackersFaced === 0 ? 0 : t.blockedAttackers / t.attackersFaced,
    spellsPerGame: perGame(t.spells),
    counterspellsPerGame: perGame(t.counterspells),
    spellsInOpponentsTurnPerGame: perGame(t.spellsInOpponentsTurn),
    landsPerGame: perGame(t.lands),
    damageTakenPerGame: perGame(t.damageTaken),
    combatDamageTakenPerGame: perGame(t.combatDamageTaken),
    lifeAtEnd: perGame(t.life),
  }
}

const key = (pairing) => `${pairing[0]} vs ${pairing[1]}`
const summary = {
  plan: { decks: plan.decks, pairings: plan.pairings, seeds: plan.seeds },
  games: games.length,
  failures: failures.map((g) => ({ deck: g.deck, pairing: g.pairing, seed: g.seed, failure: g.failure })),
  gamesWithForgeErrors: withErrors.length,
  engine: null,
  pairings: [],
}

for (const [a, b] of plan.pairings) {
  const challenger = a
  const same = a === b
  const inPairing = played.filter((g) => [...g.pairing].sort().join() === [a, b].sort().join())
  const result = { pairing: key([a, b]), challenger, opponent: b, decks: {} }
  const overall = { challenger: emptyTotals(), opponent: emptyTotals(), seat0: emptyTotals() }
  const pairs = { challengerBoth: 0, challengerNone: 0, split: 0, incomplete: 0 }
  for (const deck of plan.decks) {
    const ofDeck = inPairing.filter((g) => g.deck === deck)
    const totals = { challenger: emptyTotals(), opponent: emptyTotals(), seat0: emptyTotals() }
    for (const g of ofDeck) {
      for (const seat of g.players) {
        // Same profile on both seats (control): seat 0 counts as the challenger.
        const isChallenger = same ? seat.seat === 0 : seat.profile === challenger
        addSeat(isChallenger ? totals.challenger : totals.opponent, g, seat)
        addSeat(isChallenger ? overall.challenger : overall.opponent, g, seat)
        if (seat.seat === 0) {
          addSeat(totals.seat0, g, seat)
          addSeat(overall.seat0, g, seat)
        }
      }
    }
    if (!same) {
      const bySeed = new Map()
      for (const g of ofDeck) {
        const won = g.players.find((p) => p.profile === challenger).won
        bySeed.set(g.seed, [...(bySeed.get(g.seed) ?? []), won])
      }
      for (const outcomes of bySeed.values()) {
        if (outcomes.length !== 2) pairs.incomplete++
        else if (outcomes[0] && outcomes[1]) pairs.challengerBoth++
        else if (!outcomes[0] && !outcomes[1]) pairs.challengerNone++
        else pairs.split++
      }
    }
    result.decks[deck] = {
      challenger: rates(totals.challenger),
      opponent: rates(totals.opponent),
      challengerWinInterval: wilson(totals.challenger.wins, totals.challenger.games),
      seat0WinRate: rates(totals.seat0).winRate,
    }
  }
  result.overall = {
    challenger: rates(overall.challenger),
    opponent: rates(overall.opponent),
    challengerWinInterval: wilson(overall.challenger.wins, overall.challenger.games),
    seat0WinRate: rates(overall.seat0).winRate,
    seat0WinInterval: wilson(overall.seat0.wins, overall.seat0.games),
  }
  if (!same) {
    result.pairs = { ...pairs, signTestP: signTest(pairs.challengerBoth, pairs.challengerBoth + pairs.challengerNone) }
  }
  summary.pairings.push(result)
}

fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2) + "\n")

// Markdown for docs/research/AI_PROFILES.md.
const pct = (x) => `${(100 * x).toFixed(1)} %`
const num = (x, digits = 2) => x.toFixed(digits)
const lines = []
lines.push(`Spiele: ${games.length} (${failures.length} gescheitert, ${withErrors.length} mit Forge-Fehlermeldungen)`, "")
lines.push("| Paarung | Partien | Siegquote Herausforderer | 95-%-Intervall | Seeds: beide gewonnen / beide verloren / geteilt | Vorzeichentest p | Sitz 1 gewinnt |")
lines.push("|---|---:|---:|---|---|---:|---:|")
for (const r of summary.pairings) {
  const o = r.overall
  const p = r.pairs
  lines.push(
    `| ${r.pairing} | ${o.challenger.games} | ${pct(o.challenger.winRate)} | ${pct(o.challengerWinInterval[0])} – ${pct(o.challengerWinInterval[1])} | ${p ? `${p.challengerBoth} / ${p.challengerNone} / ${p.split}` : "–"} | ${p ? num(p.signTestP, 4) : "–"} | ${pct(o.seat0WinRate)} |`,
  )
}
lines.push("", "Siegquote des Herausforderers je Deck:", "")
lines.push(`| Paarung | ${plan.decks.join(" | ")} |`)
lines.push(`|---|${plan.decks.map(() => "---:").join("|")}|`)
for (const r of summary.pairings) {
  lines.push(`| ${r.pairing} | ${plan.decks.map((d) => `${pct(r.decks[d].challenger.winRate)} (${r.decks[d].challenger.games})`).join(" | ")} |`)
}
const behaviour = [
  ["attackersPerOwnTurn", "Angreifer je eigenem Zug", 2],
  ["attackTurnShare", "Anteil Züge mit Angriff", "pct"],
  ["blockersPerAttackerFaced", "Blocker je gegnerischem Angreifer", 2],
  ["blockedShare", "Anteil geblockter Angreifer", "pct"],
  ["spellsPerGame", "Zauber je Partie", 2],
  ["counterspellsPerGame", "Konterzauber je Partie", 2],
  ["spellsInOpponentsTurnPerGame", "Zauber im gegnerischen Zug je Partie", 2],
  ["mulligansPerGame", "Mulligans je Partie", 3],
  ["damageTakenPerGame", "erlittener Schaden je Partie", 1],
  ["turnsPerGame", "Züge je Partie", 1],
]
for (const deck of plan.decks) {
  lines.push("", `Verhalten mit ${deck} (Herausforderer / Default in denselben Partien):`, "")
  lines.push(`| Kennzahl | ${summary.pairings.map((r) => r.pairing).join(" | ")} |`)
  lines.push(`|---|${summary.pairings.map(() => "---").join("|")}|`)
  for (const [field, label, digits] of behaviour) {
    const cell = (r) => {
      const c = r.decks[deck].challenger[field]
      const o = r.decks[deck].opponent[field]
      return digits === "pct" ? `${pct(c)} / ${pct(o)}` : `${num(c, digits)} / ${num(o, digits)}`
    }
    lines.push(`| ${label} | ${summary.pairings.map(cell).join(" | ")} |`)
  }
}
console.log(lines.join("\n"))
