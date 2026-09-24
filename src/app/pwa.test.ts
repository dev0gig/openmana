// @vitest-environment node
/*
 * PWA basics: an installable web app manifest, the icons it names, the links
 * in index.html, and the temporary app icon exactly as taken over from Anvil
 * (assets/app-icon/PROVENANCE.md).
 */
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(import.meta.dirname, "../..")
const read = (file: string) => readFileSync(path.join(root, file))
const ANVIL_ICON_SHA256 = "6415e9ea97ee21fe8d53590c670d91b41dfe9efe9ad9fa16557c32421c4246e8"

interface ManifestIcon {
  src: string
  sizes: string
  type: string
  purpose: string
}

const manifest = JSON.parse(read("public/manifest.webmanifest").toString("utf8")) as Record<string, unknown> & { icons: ManifestIcon[] }
const indexHtml = read("index.html").toString("utf8")

/** Width and height from a PNG's IHDR chunk. */
function pngSize(data: Buffer): [number, number] {
  expect(data.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
  expect(data.subarray(12, 16).toString("ascii")).toBe("IHDR")
  return [data.readUInt32BE(16), data.readUInt32BE(20)]
}

describe("web app manifest", () => {
  it("has what Chrome needs to install the app", () => {
    expect(manifest).toMatchObject({ id: "/", name: "OpenMana", short_name: "OpenMana", start_url: "/", scope: "/", display: "standalone", lang: "de" })
    const sizes = new Set(manifest.icons.filter((icon) => icon.purpose === "any").map((icon) => icon.sizes))
    expect(sizes).toContain("192x192")
    expect(sizes).toContain("512x512")
    expect(manifest.icons.filter((icon) => icon.purpose === "maskable").map((icon) => icon.sizes)).toEqual(["192x192", "512x512"])
  })

  it("names icons that exist in the size it claims", () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png")
      const [width, height] = pngSize(read(path.join("public", icon.src)))
      expect(`${width}x${height}`, icon.src).toBe(icon.sizes)
    }
    expect(pngSize(read("public/apple-touch-icon.png"))).toEqual([180, 180])
  })

  it("uses the dark background of the design system as theme and splash colour", () => {
    expect(manifest["theme_color"]).toBe("#0d121b")
    expect(manifest["background_color"]).toBe("#0d121b")
    expect(indexHtml).toContain('<meta name="theme-color" content="#0d121b" />')
  })
})

describe("index.html", () => {
  it("links manifest and icons, speaks German, is dark", () => {
    expect(indexHtml).toContain('<html lang="de" class="dark">')
    expect(indexHtml).toContain('<meta name="color-scheme" content="dark" />')
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(indexHtml).toContain('<link rel="icon" href="/favicon.ico" sizes="48x48" />')
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
  })

  it("favicon.ico carries 16, 32 and 48 px", () => {
    const ico = read("public/favicon.ico")
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    const count = ico.readUInt16LE(4)
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256)
    expect(sizes).toEqual([16, 32, 48])
  })
})

describe("temporary app icon (from Anvil)", () => {
  it("is Anvil's icon byte for byte", () => {
    const icon = read("assets/app-icon/anvil-icon.png")
    expect(createHash("sha256").update(icon).digest("hex")).toBe(ANVIL_ICON_SHA256)
    expect(pngSize(icon)).toEqual([1254, 1254])
  })

  it("records where it comes from", () => {
    const provenance = read("assets/app-icon/PROVENANCE.md").toString("utf8")
    expect(provenance).toContain(ANVIL_ICON_SHA256)
    expect(provenance).toContain("dev0gig/anvil")
    expect(provenance).toContain("7c97fbb0161ad26ddfbb31bf4e723925fc917d24")
    expect(read("scripts/gen-app-icons.py").toString("utf8")).toContain(ANVIL_ICON_SHA256)
  })
})
