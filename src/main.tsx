import { StrictMode, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router/dom"
import { createAppRouter } from "./app/router"
import { CloudProvider } from "./cloud/cloud-context"
import { createAppCloud, type CloudSync } from "./cloud/cloud-sync"
import "./index.css"

const container = document.getElementById("root")
if (!container) throw new Error("index.html has no #root element")
const root = container

/**
 * The ORYX cloud first (src/cloud/cloud-sync.ts): it may finish connecting
 * (the address is cleaned before the router reads it) or leave for ORYX's
 * consent page ("redirecting": then nothing renders). Off OpenMana's real
 * address it is inactive and answers at once. Local first: should it fail to
 * start at all, OpenMana starts without it rather than not at all.
 */
async function startCloud(): Promise<CloudSync | "redirecting" | null> {
  try {
    const cloud = createAppCloud()
    return (await cloud.start()) === "redirecting" ? "redirecting" : cloud
  } catch (error) {
    console.error("[openmana] the ORYX cloud could not start; OpenMana runs without it", error)
    return null
  }
}

async function boot(): Promise<void> {
  const cloud = await startCloud()
  if (cloud === "redirecting") return
  const app: ReactNode = <RouterProvider router={createAppRouter()} />
  createRoot(root).render(<StrictMode>{cloud === null ? app : <CloudProvider cloud={cloud}>{app}</CloudProvider>}</StrictMode>)
}

void boot()
