/*
 * A card picture lets a lazily sized image go (prompt 45): Chrome keeps an
 * `<img loading="lazy" sizes="auto">` - and the elements around it - alive
 * after it left the page, so CardPicture takes `sizes` away while the image is
 * still in the page, and gives it back when React's development mode puts the
 * same element in again. Measured in real Chrome by the readiness games'
 * --table-memory (event listeners and nodes stay level over a game).
 */
import { render } from "@testing-library/react"
import { StrictMode } from "react"
import { describe, expect, it } from "vitest"
import { CardPicture } from "./card-picture"

const SRC = "https://cards.scryfall.io/grid/front/a/b/ab.webp"
const SRC_SET = "https://cards.scryfall.io/thumb/front/a/b/ab.webp 146w, https://cards.scryfall.io/grid/front/a/b/ab.webp 488w"

describe("CardPicture lets a lazily sized picture go", () => {
  it("keeps sizes=auto while shown - also through the development mode's second attach", () => {
    const { container } = render(
      <StrictMode>
        <CardPicture src={SRC} srcSet={SRC_SET} sizes="auto" alt="Wald" fallback="Wald" />
      </StrictMode>,
    )
    const image = container.querySelector("img")!
    expect(image.getAttribute("sizes")).toBe("auto")
    expect(image.getAttribute("loading")).toBe("lazy")
  })

  it("takes sizes away before the picture leaves the page", () => {
    const { container, unmount } = render(<CardPicture src={SRC} srcSet={SRC_SET} sizes="auto" alt="Wald" fallback="Wald" />)
    const image = container.querySelector("img")!
    // Where the image was when sizes went: still in the page (taking it away afterwards does not let Chrome's listener go).
    const removedWhileConnected: boolean[] = []
    const remove = image.removeAttribute.bind(image)
    image.removeAttribute = (name: string) => {
      if (name === "sizes") removedWhileConnected.push(image.isConnected)
      remove(name)
    }
    unmount()
    expect(image.hasAttribute("sizes")).toBe(false)
    expect(removedWhileConnected).toEqual([true])
    // Only sizes goes: srcset and src stay as they were.
    expect(image.getAttribute("srcset")).toBe(SRC_SET)
    expect(image.getAttribute("src")).toBe(SRC)
  })

  it("leaves other sizes alone", () => {
    const { container, unmount } = render(<CardPicture src={SRC} srcSet={SRC_SET} sizes="(min-width: 640px) 11rem, 8rem" alt="Wald" fallback="Wald" />)
    const image = container.querySelector("img")!
    unmount()
    expect(image.getAttribute("sizes")).toBe("(min-width: 640px) 11rem, 8rem")
  })
})
