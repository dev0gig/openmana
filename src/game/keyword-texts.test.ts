// @vitest-environment node
/*
 * The German keyword texts (prompt 47): a concrete form in German only where
 * it is exactly Forge's; Forge's words, marked, where OpenMana has none -
 * never an empty box. Checked on the real forms of every keyword in Forge's
 * card database (src/test/fixtures/keyword-forms.json,
 * scripts/record-keyword-forms.ts). That every keyword of Forge's enum has
 * an entry translating Forge's current text is checked against Forge's
 * sources in scripts/keyword-texts.test.ts (src/ never reads them).
 */
import { describe, expect, it } from "vitest"
import recorded from "@/test/fixtures/keyword-forms.json"
import { KEYWORD_TEXTS, keywordBox, keywordBoxes, type CardKeyword } from "./keyword-texts"

describe("the concrete form", () => {
  const box = (keyword: CardKeyword) => keywordBox(keyword)

  it("a keyword without parts: its German name and explanation", () => {
    expect(box({ keyword: "FLYING", title: "Flying", reminder: "This creature can't be blocked except by creatures with flying or reach." })).toEqual({
      key: JSON.stringify(["FLYING", "Flying", "This creature can't be blocked except by creatures with flying or reach."]),
      name: "Fliegend",
      text: "Diese Kreatur kann nur von fliegenden Kreaturen und Kreaturen mit Reichweite geblockt werden. (Ältere deutsche Karten nennen das „Flugfähigkeit“.)",
      lang: "de",
    })
  })

  it("parts in Forge's form: a cost, a number, a colour", () => {
    expect(box({ keyword: "KICKER", title: "Kicker {2}{R}", reminder: "You may pay an additional {2}{R} as you cast this spell.", cost: "{2}{R}" })).toMatchObject({ name: "Bonus {2}{R}", text: "Du kannst zusätzlich {2}{R} bezahlen, sowie du diesen Zauberspruch wirkst.", lang: "de" })
    expect(box({ keyword: "ANNIHILATOR", title: "Annihilator 2", reminder: "Whenever this creature attacks, defending player sacrifices two permanents.", amount: "2" })).toMatchObject({ name: "Vernichter 2", text: "Immer wenn diese Kreatur angreift, opfert der verteidigende Spieler zwei Permanente." })
    expect(box({ keyword: "ANNIHILATOR", title: "Annihilator 1", reminder: "", amount: "1" }).text).toContain("ein Permanent.")
    expect(box({ keyword: "WARD", title: "Ward {2}", reminder: "Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.", cost: "{2}" })).toMatchObject({ name: "Abwehr {2}" })
    // Forge reads "Protection from red" of a card script as the detail "from red" (and titles it so): both are Rot.
    expect(box({ keyword: "PROTECTION", title: "Protection from from red", reminder: "", detail: "from red" })).toMatchObject({ name: "Schutz vor Rot", lang: "de" })
    expect(box({ keyword: "PROTECTION", title: "Protection from red", reminder: "", detail: "red" })).toMatchObject({ name: "Schutz vor Rot", lang: "de" })
    expect(box({ keyword: "SUSPEND", title: "Suspend 4—{1}{U}", reminder: "", amount: "4", cost: "{1}{U}" }).name).toBe("Aussetzen 4 — {1}{U}")
    expect(box({ keyword: "BLOODTHIRST", title: "Bloodthirst 1", reminder: "", amount: "1" }).text).toContain("mit einer +1/+1-Marke ins Spiel")
    expect(box({ keyword: "BLOODTHIRST", title: "Bloodthirst X", reminder: "", amount: "X" }).text).toContain("mit X +1/+1-Marken ins Spiel")
  })

  it("a form OpenMana cannot say keeps the German name and explanation, with Forge's form in English beside it", () => {
    expect(box({ keyword: "WARD", title: "Ward—Pay 2 life.", reminder: "Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays 2 life." })).toEqual({
      key: JSON.stringify(["WARD", "Ward—Pay 2 life.", "Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays 2 life."]),
      name: "Abwehr",
      text: KEYWORD_TEXTS["WARD"]!.general,
      lang: "de",
      forgeForm: "Ward—Pay 2 life.",
    })
    // Two kicker costs: the title names only the first - Forge's reminder tells the forms apart.
    expect(box({ keyword: "KICKER", title: "Kicker {1}{U}", reminder: "You may pay an additional {1}{U} and/or {B} as you cast this spell.", cost: "{1}{U}" })).toMatchObject({ name: "Bonus", forgeForm: "Kicker {1}{U}" })
    expect(box({ keyword: "PROTECTION", title: "Protection from Archon", reminder: "", detail: "Archon" })).toMatchObject({ name: "Schutz", forgeForm: "Protection from Archon" })
  })

  it("a keyword OpenMana does not know shows Forge's words, marked English - never an empty box", () => {
    expect(box({ keyword: "BRAND_NEW", title: "Brand new 2", reminder: "Something new." })).toEqual({ key: JSON.stringify(["BRAND_NEW", "Brand new 2", "Something new."]), name: "Brand new 2", text: "Something new.", lang: "en" })
    expect(box({ keyword: "BRAND_NEW", title: "Brand new", reminder: " " }).text).toBe("Forge sendet zu diesem Schlüsselwort keinen Erklärungstext.")
  })

  it("boxes: in Forge's order, each explanation once, none without keywords", () => {
    expect(keywordBoxes(undefined)).toEqual([])
    expect(keywordBoxes([])).toEqual([])
    const flying = { keyword: "FLYING", title: "Flying", reminder: "" }
    const boxes = keywordBoxes([flying, { keyword: "VIGILANCE", title: "Vigilance", reminder: "" }, flying])
    expect(boxes.map((b) => b.name)).toEqual(["Fliegend", "Wachsamkeit"])
  })

  it("distinct Forge forms with the same title keep distinct view identities", () => {
    const forms = keywordBoxes([
      { keyword: "KICKER", title: "Kicker {1}{U}", reminder: "You may pay an additional {1}{U} as you cast this spell.", cost: "{1}{U}" },
      { keyword: "KICKER", title: "Kicker {1}{U}", reminder: "You may pay an additional {1}{U} and/or {B} as you cast this spell.", cost: "{1}{U}" },
    ])
    expect(forms.map((form) => form.name)).toEqual(["Bonus {1}{U}", "Bonus"])
    expect(new Set(forms.map((form) => form.key)).size).toBe(2)
  })
})

describe("every keyword form of Forge's card database (recorded)", () => {
  const forms = recorded.forms as readonly (CardKeyword & { readonly card: string; readonly count: number })[]

  it("is recorded from the pinned Forge with the current protocol", () => {
    expect(recorded.engine.forgeCommit).toBe("ed0333fecb1fea0671b3e50cadc1da4f71db5798")
    expect(recorded.engine.protocol).toBe(9)
    expect(forms.length).toBeGreaterThan(300)
    expect(forms.reduce((sum, form) => sum + form.count, 0)).toBe(recorded.keywords)
  })

  it("every form gets German words: a German form for nearly all, else German name and explanation with Forge's form", () => {
    let german = 0
    for (const form of forms) {
      const result = keywordBox(form)
      expect(result.lang, `${form.keyword} ${form.title} (${form.card})`).toBe("de")
      expect(result.text.trim(), form.title).not.toBe("")
      if (result.forgeForm === undefined) german += form.count
      else expect(result.forgeForm).toBe(form.title)
    }
    // Measured 2026-10-12: 16 503 of 16 965 keywords of Forge's cards (97.3 %) in a German form.
    expect(german / recorded.keywords).toBeGreaterThan(0.97)
  })

  it("a German form carries the parts of Forge's form (number, cost)", () => {
    for (const form of forms) {
      const result = keywordBox(form)
      if (result.forgeForm !== undefined) continue
      if (form.amount !== undefined && /\d|X/.test(form.title)) expect(result.name, form.title).toContain(form.amount)
      if (form.cost !== undefined && form.title.includes(form.cost)) expect(result.name, form.title).toContain(form.cost)
    }
  })
})
