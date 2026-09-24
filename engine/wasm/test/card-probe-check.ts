/*
 * Judges card probe results (diagnostics.cards, bridge CardProbe): one probe
 * on its own, a Wasm probe against the JVM reference of the same card loading
 * mode, and the JVM probes against each other (lazy against eager, English
 * against German). What must be equal and why:
 * docs/implementation/04-forge-resources-card-scripts.md.
 */
import type { CardProbeResult } from "../../protocol/src/index.ts";

export const PROBE_SECTIONS = ["namedCreation", "representative", "tokens", "newestEditions", "database"] as const;
export type ProbeSection = (typeof PROBE_SECTIONS)[number];

/** Everything wrong with one probe by itself. */
export function probeProblems(probe: CardProbeResult): string[] {
  const problems = [...probe.failures];
  for (const c of probe.namedCreation) {
    if (!c.ok) problems.push(`named creation ${c.id}: ${c.problem ?? "not ok"}`);
  }
  for (const r of probe.representative) {
    if (!r.found) problems.push(`representative card not found: ${r.request}`);
  }
  if (probe.tokens.loaded !== probe.tokens.scripts || probe.tokens.scripts === 0) {
    problems.push(`tokens: ${probe.tokens.loaded} of ${probe.tokens.scripts} scripts loaded`);
  }
  for (const pass of [probe.database.cards, probe.database.variantCards]) {
    if (pass.instantiated !== pass.unique || pass.unique === 0) {
      problems.push(`database: ${pass.instantiated} of ${pass.unique} cards became game cards`);
    }
  }
  if (probe.newestEditions.length === 0 || probe.newestEditions.some((e) => e.loaded === 0)) {
    problems.push(`newest editions: ${probe.newestEditions.map((e) => `${e.code} ${e.loaded}/${e.distinctCards}`).join(", ") || "none"}`);
  }
  return problems;
}

/** The differences between two probes in the given sections, with enough detail to start looking. */
export function probeDifferences(expected: CardProbeResult, actual: CardProbeResult, sections: readonly ProbeSection[] = PROBE_SECTIONS): string[] {
  const diffs: string[] = [];
  if (expected.cardLoading !== actual.cardLoading) {
    diffs.push(`card loading ${actual.cardLoading} != ${expected.cardLoading}`);
  }
  for (const section of sections) {
    if (expected.sections[section] === actual.sections[section]) continue;
    diffs.push(`${section}: ${actual.sections[section]} != ${expected.sections[section]}${detail(section, expected, actual)}`);
  }
  return diffs;
}

function detail(section: ProbeSection, expected: CardProbeResult, actual: CardProbeResult): string {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const differing: string[] = [];
  switch (section) {
    case "namedCreation":
      expected.namedCreation.forEach((c, i) => same(c, actual.namedCreation[i]) || differing.push(`${c.id}: ${JSON.stringify(actual.namedCreation[i])}`));
      break;
    case "representative":
      expected.representative.forEach((c, i) => same(c, actual.representative[i]) || differing.push(c.request));
      break;
    case "newestEditions":
      expected.newestEditions.forEach((e, i) => same(e, actual.newestEditions[i]) || differing.push(`${e.code} (${actual.newestEditions[i]?.loaded}/${e.loaded} loaded)`));
      break;
    case "tokens":
      differing.push(`loaded ${actual.tokens.loaded}/${expected.tokens.loaded}, abilities ${actual.tokens.abilities}/${expected.tokens.abilities}`);
      break;
    case "database":
      for (const pass of ["cards", "variantCards"] as const) {
        const e = expected.database[pass];
        const a = actual.database[pass];
        for (const key of ["unique", "printings", "instantiated", "abilities", "rulesSha256", "gameCardsSha256"] as const) {
          if (e[key] !== a[key]) differing.push(`${pass}.${key} ${a[key]} != ${e[key]}`);
        }
      }
      if (!same(expected.database.scriptWarnings, actual.database.scriptWarnings)) differing.push("scriptWarnings");
      if (!same(expected.database.problems, actual.database.problems)) differing.push(`problems ${JSON.stringify(actual.database.problems.slice(0, 5))}`);
      break;
  }
  return differing.length > 0 ? ` (${differing.slice(0, 12).join("; ")})` : "";
}
