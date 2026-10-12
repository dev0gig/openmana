// @vitest-environment node
/*
 * The rule that keeps the German keyword texts true (prompt 47,
 * src/game/keyword-texts.ts): one entry for every constant of Forge's
 * Keyword enum at the pinned commit, each translating Forge's English text as
 * it is there - a Forge update that adds a keyword or changes a text fails
 * here until the German text was looked at again. Reads the pinned Forge
 * sources (the engine/forge submodule), which src/ never does
 * (src/app/boundary.test.ts).
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { KEYWORD_TEXTS, keywordBox } from "../src/game/keyword-texts.ts"

const KEYWORD_JAVA = path.resolve(import.meta.dirname, "../engine/forge/forge-game/src/main/java/forge/game/keyword/Keyword.java")

/** Forge's Keyword enum: constant, display name and reminder text, as Java has them. */
function forgeKeywords(): { readonly constant: string; readonly name: string; readonly reminder: string }[] {
  if (!fs.existsSync(KEYWORD_JAVA)) throw new Error(`${KEYWORD_JAVA} is missing: the pinned Forge sources are needed (git submodule update --init engine/forge)`)
  const java = fs.readFileSync(KEYWORD_JAVA, "utf8")
  const unescape = (text: string) => text.replace(/\\(["\\])/g, "$1")
  return [...java.matchAll(/^\s+([A-Z_]+)\("((?:[^"\\]|\\.)*)", \w+\.class, (?:true|false), "((?:[^"\\]|\\.)*)"\)/gm)].map((m) => ({ constant: m[1]!, name: unescape(m[2]!), reminder: unescape(m[3]!) }))
}

describe("one German entry per Forge keyword", () => {
  const forge = forgeKeywords()

  it("covers exactly Forge's Keyword enum (without UNDEFINED) - a new keyword fails until it has German words", () => {
    expect(forge.length).toBeGreaterThan(150)
    const constants = forge.map((k) => k.constant).filter((c) => c !== "UNDEFINED")
    expect(Object.keys(KEYWORD_TEXTS).sort()).toEqual([...constants].sort())
  })

  it("translates Forge's text as it is at the pinned commit - a changed text fails until the German one was looked at again", () => {
    for (const keyword of forge) {
      if (keyword.constant === "UNDEFINED") continue
      expect(KEYWORD_TEXTS[keyword.constant]!.forge, keyword.constant).toBe(keyword.reminder)
    }
  })

  it("every entry says where its German comes from and has a name and an explanation for every form", () => {
    for (const [constant, entry] of Object.entries(KEYWORD_TEXTS)) {
      expect(["druck", "openmana"], constant).toContain(entry.source)
      expect(entry.name.trim(), constant).not.toBe("")
      expect(entry.general.trim(), constant).not.toBe("")
      // German, not Forge's English text copied.
      expect(entry.general, constant).not.toBe(entry.forge)
    }
  })

  it("a simple keyword's German form is found by Forge's own name of it", () => {
    for (const keyword of forge) {
      const entry = KEYWORD_TEXTS[keyword.constant]
      if (entry === undefined || entry.forms.length === 0) continue
      const simple = entry.forms.find((form) => form.title({ reminder: "" }) === keyword.name)
      if (simple === undefined) continue
      expect(keywordBox({ keyword: keyword.constant, title: keyword.name, reminder: keyword.reminder }).lang, keyword.constant).toBe("de")
    }
  })
})

