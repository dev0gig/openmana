import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router/dom"
import { createAppRouter } from "./app/router"
import "./index.css"

const container = document.getElementById("root")
if (!container) throw new Error("index.html has no #root element")

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={createAppRouter()} />
  </StrictMode>,
)
