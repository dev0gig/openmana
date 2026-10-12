/*
 * Real keyword forms for the tests of the German keyword texts (prompt 47):
 * what the bridge sends (VisibleCard.keywords) for every keyword of every
 * card in Forge's card database, one sample per distinct form.
 *
 * Source: the JVM build's KeywordSurvey (engine/bridge/.../bridge/KeywordSurvey.java),
 * which makes every card of Forge's database a game card and runs its
 * keywords through StateBuilder.keywords - the same code that writes the
 * protocol. Nothing is edited; a form is the keyword with its title, amount
 * and cost written as placeholders, and how OpenMana says it (a German form,
 * or German name and explanation beside Forge's words). Each sample is the
 * first card (by name) of its form, with the number of keywords of that form.
 *
 *   node scripts/record-keyword-forms.ts [--build <engine build dir>] [--out <file>]
 *
 * The build dir needs jvm/openmana-engine-jvm.jar, resources/forge-res.bin
 * and dist/engine-manifest.json (engine/scripts/build.sh). Java is the
 * pinned GraalVM of engine/scripts/lib.sh (JAVA_HOME, else java on PATH).
 * Output: src/test/fixtures/keyword-forms.json.
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { CardKeyword } from "../engine/protocol/src/index.ts"
import { keywordBox } from "../src/game/keyword-texts.ts"

const root = path.resolve(import.meta.dirname, "..")

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback
}

const build = path.resolve(option("--build", path.join(root, "engine/build")))
const outFile = path.resolve(option("--out", path.join(root, "src/test/fixtures/keyword-forms.json")))
const jar = path.join(build, "jvm/openmana-engine-jvm.jar")
const bundle = path.join(build, "resources/forge-res.bin")
const manifest = JSON.parse(fs.readFileSync(path.join(build, "dist/engine-manifest.json"), "utf8")) as { builtAt: string; forge: { commit: string }; protocol: { version: number } }
for (const file of [jar, bundle]) if (!fs.existsSync(file)) throw new Error(`${file} is missing: run engine/scripts/build.sh first`)

const java = process.env["JAVA_HOME"] ? path.join(process.env["JAVA_HOME"], "bin/java") : "java"
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "openmana-keywords-"))
const lines = path.join(scratch, "keywords.jsonl")
try {
  const said = execFileSync(java, ["-Xmx2g", "-cp", jar, "org.openmana.engine.bridge.KeywordSurvey", bundle, lines], { encoding: "utf8", maxBuffer: 1 << 26 })
  const summary = /OPENMANA-KEYWORDS: (.*)/.exec(said)?.[1]
  if (summary === undefined) throw new Error(`KeywordSurvey said nothing:\n${said}`)

  type Row = CardKeyword & { readonly card: string }
  const rows = fs.readFileSync(lines, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Row)
  const forms = new Map<string, { sample: Row; count: number }>()
  for (const row of rows) {
    let shape = row.title
    if (row.cost !== undefined) shape = shape.replace(row.cost, "{cost}")
    if (row.amount !== undefined) shape = shape.replace(` ${row.amount}`, " {amount}")
    const box = keywordBox(row)
    const key = `${row.keyword}\u0000${shape}\u0000${row.detail ?? ""}\u0000${box.forgeForm === undefined ? "form" : "general"}`
    const known = forms.get(key)
    if (known === undefined) forms.set(key, { sample: row, count: 1 })
    else known.count++
  }
  const samples = [...forms.values()]
    .sort((a, b) => a.sample.keyword.localeCompare(b.sample.keyword) || a.sample.title.localeCompare(b.sample.title) || a.sample.card.localeCompare(b.sample.card))
    .map(({ sample, count }) => ({ ...sample, count }))
  const out = {
    source: "scripts/record-keyword-forms.ts: KeywordSurvey over Forge's card database (JVM build), one sample per form",
    engine: { builtAt: manifest.builtAt, forgeCommit: manifest.forge.commit, protocol: manifest.protocol.version },
    survey: summary,
    keywords: rows.length,
    forms: samples,
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + "\n")
  console.log(`${path.relative(root, outFile)}: ${samples.length} forms of ${rows.length} keywords (${summary})`)
} finally {
  fs.rmSync(scratch, { recursive: true, force: true })
}
