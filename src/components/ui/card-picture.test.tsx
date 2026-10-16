/*
 * A card picture lets a lazily sized image go (prompt 45): Chrome keeps an
 * `<img loading="lazy" sizes="auto">` - and the elements around it - alive
 * after it left the page, so CardPicture takes `sizes` away while the image is
 * still in the page, and gives it back when React's development mode puts the
 * same element in again. Measured in real Chrome by the readiness games'
 * --table-memory (event listeners and nodes stay level over a game).
 */
import { act, fireEvent, render } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
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

/*
 * A failed picture tries again (the project owner, 2026-10-16: "die
 * Kartenbilder laden nicht zuverlässig"): one dropped request must not leave
 * the card's text for good.
 */
describe("CardPicture tries a failed picture again", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const frameOf = (container: HTMLElement) => container.querySelector('[data-slot="card-picture"]')!

  it("shows the text, asks again after a pause and shows the picture once it loaded", () => {
    vi.useFakeTimers()
    const states: string[] = []
    const { container, getByText, queryByRole } = render(<CardPicture src={SRC} alt="Wald" fallback="Wald (Text)" onStateChange={(state) => states.push(state)} />)
    const first = container.querySelector("img")!
    fireEvent.error(first)
    expect(frameOf(container)).toHaveAttribute("data-state", "failed")
    expect(getByText("Wald (Text)")).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()

    act(() => vi.advanceTimersByTime(1_000))
    // A new image asks again, invisible and hidden from screen readers; the text stays.
    const second = container.querySelector("img")!
    expect(second).not.toBe(first)
    expect(second.getAttribute("src")).toBe(SRC)
    expect(second).toHaveAttribute("aria-hidden", "true")
    expect(second).toHaveClass("opacity-0")
    expect(frameOf(container)).toHaveAttribute("data-state", "failed")
    expect(getByText("Wald (Text)")).toBeInTheDocument()
    expect(queryByRole("img", { name: "Wald" })).toBeNull()

    fireEvent.load(second)
    expect(frameOf(container)).toHaveAttribute("data-state", "loaded")
    expect(container.querySelector('[data-slot="card-picture-fallback"]')).toBeNull()
    const shown = container.querySelector("img")!
    expect(shown).toBe(second)
    expect(shown).not.toHaveAttribute("aria-hidden")
    expect(shown).not.toHaveClass("opacity-0")
    expect(queryByRole("img", { name: "Wald" })).toBe(shown)
    expect(states).toEqual(["failed", "loaded"])
  })

  it("waits longer each time, gives up after the last pause and tries again when the browser is back online", () => {
    vi.useFakeTimers()
    const states: string[] = []
    const { container } = render(<CardPicture src={SRC} alt="Wald" fallback="Wald (Text)" onStateChange={(state) => states.push(state)} />)
    fireEvent.error(container.querySelector("img")!)
    for (const delay of [1_000, 4_000, 15_000]) {
      act(() => vi.advanceTimersByTime(delay - 1))
      expect(container.querySelector("img")).toBeNull()
      act(() => vi.advanceTimersByTime(1))
      fireEvent.error(container.querySelector("img")!)
    }
    act(() => vi.advanceTimersByTime(10 * 60_000))
    expect(container.querySelector("img")).toBeNull()
    expect(states).toEqual(["failed"])

    act(() => {
      window.dispatchEvent(new Event("online"))
    })
    fireEvent.load(container.querySelector("img")!)
    expect(frameOf(container)).toHaveAttribute("data-state", "loaded")
    expect(states).toEqual(["failed", "loaded"])
  })

  it("starts anew for another picture and stops asking once it left the page", () => {
    vi.useFakeTimers()
    const { container, rerender, unmount } = render(<CardPicture src={SRC} alt="Wald" fallback="Wald (Text)" />)
    fireEvent.error(container.querySelector("img")!)
    const other = "https://cards.scryfall.io/grid/front/c/d/cd.webp"
    rerender(<CardPicture src={other} alt="Insel" fallback="Insel (Text)" />)
    expect(frameOf(container)).toHaveAttribute("data-state", "loading")
    expect(container.querySelector("img")!.getAttribute("src")).toBe(other)
    fireEvent.error(container.querySelector("img")!)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
