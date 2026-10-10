/*
 * The game table's layout classes in the real browser (prompt 36; read by the
 * end-to-end test, scripts/e2e/run.ts section 12): what useTableLayout()
 * answers, and which of the CSS variants hoch:, quadrat: and breit: the
 * compiled stylesheet applies (order 1, 2 or 3). The test resizes the window
 * and compares both with the layout docs/design/SPIELTISCH.md gives the size.
 *
 * Not part of the app - only the test's dev server serves it,
 * /scripts/e2e/table-layout-probe.html.
 */
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@/index.css"
import { useTableLayout } from "@/game/table/use-table-layout"

function Probe() {
  const layout = useTableLayout()
  return (
    <main>
      <p data-harness="table-layout" data-layout={layout} className="hoch:order-1 quadrat:order-2 breit:order-3">
        {layout}
      </p>
    </main>
  )
}

const container = document.getElementById("root")
if (!container) throw new Error("the probe page has no #root element")
createRoot(container).render(
  <StrictMode>
    <Probe />
  </StrictMode>,
)
