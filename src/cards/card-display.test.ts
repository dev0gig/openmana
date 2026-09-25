// @vitest-environment node
/*
 * What is shown for a card: German where Scryfall has it, English where
 * not - field by field and marked - and the right picture and side.
 */
import { describe, expect, it } from "vitest"
import type { PrintRecord } from "@/storage/generated/records"
import { buildFixtureCatalog, fixtureCard } from "@/test/catalog-fixtures"
import { cardDisplay } from "./card-display"
import { describeMatch } from "./card-lookup"

const catalog = buildFixtureCatalog()
const card = (name: string) => fixtureCard(name, catalog)

describe("German first", () => {
  it("German picture and German text where both exist", () => {
    const display = cardDisplay(card("Lightning Bolt"))
    expect(display.name).toEqual({ text: "Blitzschlag", lang: "de" })
    expect(display.faces[0]).toMatchObject({ typeLine: { text: "Spontanzauber", lang: "de" }, manaCost: "{R}", englishName: "Lightning Bolt" })
    expect(display.picture).toMatchObject({ source: "german", lang: "de", set: "tle", side: "front", lowQuality: false })
    expect(display.picture?.urls.grid).toMatch(/^https:\/\/cards\.scryfall\.io\/grid\/front\/.+\.webp\?\d+$/)
    expect(display.language).toEqual({ preferred: "de", picture: "de", text: "de", germanTextExists: true, germanPictureExists: true })
  })

  it("German text on an English picture when Scryfall has no German picture", () => {
    const display = cardDisplay(card("Ballroom Brawlers"))
    expect(display.name).toEqual({ text: "Streitlustiges Tanzpaar", lang: "de" })
    expect(display.picture).toMatchObject({ source: "fallback", lang: "en" })
    expect(display.language).toMatchObject({ picture: "en", germanPictureExists: false, germanTextExists: true })
  })

  it("English, marked, when there is no German printing at all", () => {
    const display = cardDisplay(card("Akki Lavarunner // Tok-Tok, Volcano Born"))
    expect(display.name).toEqual({ text: "Akki Lavarunner // Tok-Tok, Volcano Born", lang: "en" })
    expect(display.faces.map((face) => face.text?.lang)).toEqual(["en", "en"])
    expect(display.language).toEqual({ preferred: "de", picture: "en", text: "en", germanTextExists: false, germanPictureExists: false })
  })

  it("field by field: an untranslated field stays English and says so", () => {
    const display = cardDisplay(card("Valki, God of Lies // Tibalt, Cosmic Impostor"))
    const valki = display.faces[0]!
    expect(valki.name).toEqual({ text: "Valki, Gott der Lügen", lang: "de" })
    expect(valki.text?.lang).toBe("de")
    expect(display.language.text === "de" || display.language.text === "mixed").toBe(true)
  })

  it("a card only printed in Japanese shows that picture as 'other'", () => {
    const display = cardDisplay(card("Tornellan Protector"))
    expect(display.picture?.lang).toBe("ja")
    expect(display.language.picture).toBe("other")
    expect(display.name).toEqual({ text: "Tornellan Protector", lang: "en" })
  })
})

describe("the English card language (prompt 12)", () => {
  it("English name, texts and picture although Scryfall has German ones", () => {
    const display = cardDisplay(card("Lightning Bolt"), { language: "en" })
    expect(display.name).toEqual({ text: "Lightning Bolt", lang: "en" })
    expect(display.faces[0]).toMatchObject({ typeLine: { lang: "en" }, text: { lang: "en" }, manaCost: "{R}" })
    expect(display.picture).toMatchObject({ source: "fallback", lang: "en" })
    // The facts about German stay what they are; the display says what it was made for.
    expect(display.language).toEqual({ preferred: "en", picture: "en", text: "en", germanTextExists: true, germanPictureExists: true })
  })

  it("both faces English; a requested printing still wins", () => {
    const delver = card("Delver of Secrets // Insectile Aberration")
    expect(cardDisplay(delver, { language: "en" }).name).toEqual({ text: "Delver of Secrets // Insectile Aberration", lang: "en" })
    const german = delver.prints.de
    expect(german).not.toBeNull()
    const requested = cardDisplay(delver, { language: "en", print: german as unknown as PrintRecord })
    expect(requested.picture?.source).toBe("requested-print")
  })

  it("a card only printed in Japanese keeps that picture", () => {
    expect(cardDisplay(card("Tornellan Protector"), { language: "en" }).language.picture).toBe("other")
  })
})

describe("faces and sides", () => {
  it("the whole card by default, one face when asked or found by it", () => {
    const delver = card("Delver of Secrets // Insectile Aberration")
    expect(cardDisplay(delver).name).toEqual({ text: "Geheimnisstöberer // Insekten-Scheußlichkeit", lang: "de" })
    const back = cardDisplay(delver, { match: describeMatch(delver, "Insectile Aberration") })
    expect(back.face).toBe(1)
    expect(back.name).toEqual({ text: "Insekten-Scheußlichkeit", lang: "de" })
    expect(back.picture?.side).toBe("back")
    expect(back.picture?.urls.display).toContain("/display/back/")
    const front = cardDisplay(delver, { face: 0 })
    expect(front.picture?.side).toBe("front")
  })

  it("split and adventure cards have one picture for both halves", () => {
    const giant = card("Bonecrusher Giant // Stomp")
    const stomp = cardDisplay(giant, { match: describeMatch(giant, "Stomp") })
    expect(stomp.name).toEqual({ text: "Stampfen", lang: "de" })
    expect(stomp.picture?.side).toBe("front")
    expect(cardDisplay(giant, { match: describeMatch(giant, "Bonecrusher Giant") }).name.text).toBe("Knochenmalmer-Riese")
    expect(cardDisplay(card("Fire // Ice")).picture?.side).toBe("front")
  })

  it("a face index out of range is clamped", () => {
    expect(cardDisplay(card("Lightning Bolt"), { face: 3 }).face).toBe(0)
  })
})

describe("which printing", () => {
  it("an alias shows the printing that carries it, under its own name", () => {
    const hansk = card("Hansk, Slayer Zealot")
    const alias = hansk.aliases![0]!
    const display = cardDisplay(hansk, { match: { card: hansk, kind: "alias", face: null, alias } })
    expect(display.name).toEqual({ text: "Daryl, Hunter of Walkers", lang: "en" })
    expect(display.picture).toMatchObject({ source: "alias", set: "sld", collectorNumber: "144" })
  })

  it("a requested printing wins if it has a picture", () => {
    const bolt = card("Lightning Bolt")
    const m11: PrintRecord = {
      id: "7673784e-db4b-43a1-8d55-1bb9fc1e284f",
      oracleId: bolt.oracleId,
      name: "Lightning Bolt",
      set: "m11",
      collectorNumber: "149",
      lang: "en",
      releasedAt: "2010-07-16",
      imageStatus: "highres_scan",
      imageSides: 1,
      imageVersion: "1",
      fetchedAt: "2026-09-25T00:00:00.000Z",
    }
    expect(cardDisplay(bolt, { print: m11 }).picture).toMatchObject({ source: "requested-print", set: "m11", lang: "en" })
    expect(cardDisplay(bolt, { print: { ...m11, imageSides: 0 } }).picture?.source).toBe("german")
  })

  it("no picture at all is null, never a stand-in", () => {
    const bolt = card("Lightning Bolt")
    const bare = { ...bolt, prints: { de: null, fallback: null } }
    const display = cardDisplay(bare)
    expect(display.picture).toBeNull()
    expect(display.language.picture).toBeNull()
    expect(display.name.text).toBe("Blitzschlag")
  })
})
