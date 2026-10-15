/*
 * The menu style's building blocks (series openmana-menuestil, prompt 58):
 * the ornaments are decoration only (hidden from screen readers, no room, no
 * pointer), Card is a panel with two corners (or plain without them), and the
 * shadcn components carry the panel-and-gold look only under menu: - so the
 * same components inside the game table's board keep the look the table's own
 * stylesheet builds on (Design System §10).
 */
import fs from "node:fs"
import path from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PageHeader } from "@/components/page-header"
import { Badge } from "./badge"
import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Checkbox } from "./checkbox"
import { Empty, EmptyMedia, EmptyTitle } from "./empty"
import { Input } from "./input"
import { Item, ItemMedia } from "./item"
import { OrnamentCorner, OrnamentDivider } from "./ornament"
import { RadioGroup, RadioGroupItem } from "./radio-group"
import { Switch } from "./switch"
import { Textarea } from "./textarea"
import { Toggle } from "./toggle"

describe("OrnamentCorner", () => {
  it("is decoration: aria-hidden, not focusable, no pointer, absolutely placed (no room)", () => {
    const { container } = render(<OrnamentCorner />)
    const svg = container.querySelector("svg")!
    expect(svg).toHaveAttribute("data-slot", "ornament-corner")
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(svg).toHaveAttribute("focusable", "false")
    expect(svg).toHaveAttribute("viewBox", "0 0 28 28")
    expect(svg).toHaveClass("absolute", "pointer-events-none", "text-primary")
  })

  it("sits top left (start) or bottom right, turned half round (end)", () => {
    const { container } = render(
      <>
        <OrnamentCorner corner="start" />
        <OrnamentCorner corner="end" />
      </>,
    )
    const [start, end] = [...container.querySelectorAll("svg")]
    expect(start).toHaveAttribute("data-corner", "start")
    expect(end).toHaveAttribute("data-corner", "end")
    expect(start!.getAttribute("class")).toMatch(/data-\[corner=start\]:top-1\.25 data-\[corner=start\]:left-1\.25/)
    expect(end!.getAttribute("class")).toMatch(/data-\[corner=end\]:right-1\.25 data-\[corner=end\]:bottom-1\.25 data-\[corner=end\]:rotate-180/)
    // The table's shape (table.css .table-panel::before): two strokes, two dots, the point - in currentColor.
    expect(start!.querySelectorAll("path")).toHaveLength(3)
    expect(start!.querySelectorAll("circle")).toHaveLength(2)
  })
})

describe("OrnamentDivider", () => {
  it("is a decorative gold line with a diamond, hidden from screen readers", () => {
    const { container } = render(<OrnamentDivider />)
    const divider = container.querySelector("[data-slot='ornament-divider']")!
    expect(divider).toHaveAttribute("aria-hidden", "true")
    expect(divider).toHaveClass("pointer-events-none", "before:to-primary", "after:to-primary")
    expect(divider.querySelector("span")).toHaveClass("rotate-45", "bg-primary", "shadow-gold-glow")
    expect(divider.textContent).toBe("")
  })
})

describe("Card as the table's panel", () => {
  it("draws its two corners after its content (the registry's first-child rules hold), only outside the board", () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>So geht es los</CardTitle>
        </CardHeader>
        <CardContent>Inhalt</CardContent>
      </Card>,
    )
    const card = container.querySelector("[data-slot='card']")!
    expect(card).toHaveAttribute("data-variant", "default")
    const children = [...card.children]
    expect(children.map((child) => child.getAttribute("data-slot"))).toEqual(["card-header", "card-content", "ornament-corner", "ornament-corner"])
    for (const corner of children.slice(2)) expect(corner).toHaveClass("hidden", "menu:block")
    expect(card).toHaveClass("menu:relative", "menu:bg-linear-to-b", "menu:from-panel/94", "menu:to-panel-shade/94", "menu:shadow-panel", "menu:ring-gold-line")
    // The registry's look stays the base (a card inside the board looks as before).
    expect(card).toHaveClass("bg-card", "ring-1", "ring-foreground/10")
    expect(screen.getByText("So geht es los")).toHaveClass("font-heading", "menu:text-gold-light")
  })

  it("variant plain: the same panel without corners and drop shadow, for dense or nested use", () => {
    const { container } = render(<Card variant="plain">Inhalt</Card>)
    const card = container.querySelector("[data-slot='card']")!
    expect(card).toHaveAttribute("data-variant", "plain")
    expect(card.querySelector("[data-slot='ornament-corner']")).toBeNull()
    expect(card).toHaveClass("menu:data-[variant=plain]:shadow-panel-flat")
  })
})

describe("Button in the menu style", () => {
  it("default is the golden main button (gradient, gold rim, gloss, Cinzel capitals) outside the board", () => {
    render(<Button>Spielen</Button>)
    const button = screen.getByRole("button", { name: "Spielen" })
    expect(button).toHaveClass(
      "menu:bg-linear-to-b",
      "menu:from-gold-light",
      "menu:via-primary",
      "menu:to-gold-deep",
      "menu:border-gold-light",
      "menu:shadow-gold-button",
      "menu:font-heading",
      "menu:uppercase",
    )
    // The registry's base stays (the table's stylesheet builds its buttons on it) and the text stays on gold.
    expect(button).toHaveClass("bg-primary", "text-primary-foreground")
  })

  it.each(["outline", "secondary"] as const)("%s is a pill on the panel tone with the gold hairline", (variant) => {
    render(<Button variant={variant}>Decks</Button>)
    expect(screen.getByRole("button", { name: "Decks" })).toHaveClass("rounded-4xl", "menu:border-gold-line")
  })

  it("keeps the focus ring and restates the focus border under menu: (the variant outweighs the base)", () => {
    render(<Button variant="outline">Decks</Button>)
    expect(screen.getByRole("button", { name: "Decks" })).toHaveClass("focus-visible:ring-[3px]", "menu:focus-visible:border-ring", "menu:aria-invalid:border-destructive")
  })
})

describe("PageHeader", () => {
  it("the title in Cinzel gold, the ornament line under it hidden from screen readers", () => {
    const { container } = render(<PageHeader title="Decks" description="Deine Decks" />)
    const heading = screen.getByRole("heading", { level: 1, name: "Decks" })
    expect(heading).toHaveClass("font-heading", "text-gold-light")
    const divider = container.querySelector("[data-slot='ornament-divider']")!
    expect(heading.nextElementSibling).toBe(divider)
    expect(divider).toHaveAttribute("aria-hidden", "true")
  })
})

/*
 * The guard of the menu style's scope: a component placed inline (which can stand inside the game table's board)
 * names the menu style's tokens only under menu:. Overlays (Dialog, Sheet, menus, tooltips) are portalled out of the
 * board and use them directly; the app's bars (AppHeader, the sidebar, the tab bar) are never on the board.
 */
describe("the menu style stays off the game table's board", () => {
  const MENU_TOKENS = /(?:^|[:-])(?:gold-(?:light|line|edge|deep|glow)|panel(?:-shade|-well)?|shadow-panel(?:-flat)?|shadow-gold-button)(?:\/\d+)?$/

  function looseClasses(element: Element): string[] {
    const classes = (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)
    return classes.filter((name) => MENU_TOKENS.test(name) && !name.split(":").includes("menu"))
  }

  it.each([
    ["Button default", <Button key="b">x</Button>],
    ["Button outline", <Button key="b" variant="outline">x</Button>],
    ["Button secondary", <Button key="b" variant="secondary">x</Button>],
    ["Button ghost", <Button key="b" variant="ghost">x</Button>],
    ["Badge secondary", <Badge key="b" variant="secondary">x</Badge>],
    ["Badge outline", <Badge key="b" variant="outline">x</Badge>],
    ["Input", <Input key="i" aria-label="x" />],
    ["Textarea", <Textarea key="t" aria-label="x" />],
    ["Card", <Card key="c">x</Card>],
    ["Item outline", <Item key="i" variant="outline"><ItemMedia variant="icon">x</ItemMedia></Item>],
    ["Item muted", <Item key="i" variant="muted">x</Item>],
    ["Toggle outline", <Toggle key="t" variant="outline" aria-label="x" />],
    ["Checkbox", <Checkbox key="c" aria-label="x" />],
    ["RadioGroupItem", <RadioGroup key="r" aria-label="x"><RadioGroupItem value="a" aria-label="a" /></RadioGroup>],
    ["Switch", <Switch key="s" aria-label="x" />],
    ["Empty", <Empty key="e"><EmptyMedia variant="icon">x</EmptyMedia><EmptyTitle>x</EmptyTitle></Empty>],
  ])("%s names the menu style's tokens only under menu:", (_, element) => {
    const { container } = render(element)
    const loose = [...container.querySelectorAll("*")].flatMap((node) => looseClasses(node).map((name) => `${node.getAttribute("data-slot")}: ${name}`))
    expect(loose).toEqual([])
  })

  it("menu: means: not inside the game table's board", () => {
    const css = fs.readFileSync(path.resolve(import.meta.dirname, "../../index.css"), "utf8")
    expect(css).toContain('@custom-variant menu (&:not([data-slot="game-board"] *));')
  })
})
