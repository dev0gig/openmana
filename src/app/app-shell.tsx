/*
 * Frame of every surface: sidebar (md and up) or top bar + tab bar (phones),
 * the local database (linked to the ORYX cloud when main.tsx provides one),
 * the card catalog, the engine session and the player's
 * preferences shared by all pages, tooltips and toasts. A page may take the
 * whole screen (the running game, src/app/immersive.tsx): then the frame
 * steps aside and the page fills the screen without scrolling.
 *
 * The menu style (series openmana-menuestil, prompt 57): the bars in the
 * game table's look (AppHeader, BottomNav, the sidebar), the emblem and the
 * gold wordmark (Brand), and behind the content the one background shimmer
 * (AppSurface) - not while a game or a replay takes the screen.
 */
import { Settings } from "lucide-react"
import { NavLink, Outlet, ScrollRestoration, useLocation } from "react-router"
import { AppSidebar } from "@/components/app-sidebar"
import { Brand } from "@/components/brand"
import { CardCatalogProvider } from "@/cards/card-catalog-context"
import { CloudReturnNotice, CloudStorageLink } from "@/cloud/cloud-context"
import { AppHeader, appHeaderButtonVariants } from "@/components/ui/app-header"
import { AppSurface } from "@/components/ui/app-surface"
import { BottomNav, BottomNavItem } from "@/components/ui/bottom-nav"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { EngineSessionProvider } from "@/engine/engine-session-context"
import { StorageProvider } from "@/storage/storage-context"
import { ImmersiveProvider, useIsImmersive } from "./immersive"
import { isActive, MAIN_DESTINATIONS } from "./navigation"
import { PreferencesProvider } from "./preferences"

export function AppShell() {
  return (
    <StorageProvider>
      <CloudStorageLink />
      <CloudReturnNotice />
      <CardCatalogProvider>
        <EngineSessionProvider>
          <PreferencesProvider>
            <TooltipProvider>
              <ImmersiveProvider>
                <Frame />
              </ImmersiveProvider>
              <Toaster />
            </TooltipProvider>
          </PreferencesProvider>
          <ScrollRestoration />
        </EngineSessionProvider>
      </CardCatalogProvider>
    </StorageProvider>
  )
}

function Frame() {
  const { pathname } = useLocation()
  const immersive = useIsImmersive()
  return (
    <SidebarProvider>
      {immersive ? null : <AppSidebar />}
      <SidebarInset>
        {immersive ? null : <AppSurface />}
        {immersive ? null : (
          <AppHeader>
            <SidebarTrigger className={appHeaderButtonVariants({ className: "hidden md:inline-flex" })} />
            <NavLink to="/" aria-label="OpenMana – Start" className="inline-flex min-h-11 items-center rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden">
              <Brand />
            </NavLink>
            <Button asChild variant="ghost" size="icon-lg" className={appHeaderButtonVariants({ className: "ml-auto md:hidden" })}>
              <NavLink to="/settings" aria-label="Einstellungen">
                <Settings aria-hidden />
              </NavLink>
            </Button>
          </AppHeader>
        )}
        {/* relative: the content lies above the background shimmer (both positioned, the content later). */}
        <div className={immersive ? "flex h-dvh flex-col overflow-hidden" : "relative flex flex-1 flex-col"}>
          <Outlet />
        </div>
        {immersive ? null : (
          <BottomNav aria-label="Hauptnavigation">
            {MAIN_DESTINATIONS.map((destination) => (
              <BottomNavItem key={destination.path} asChild isActive={isActive(destination, pathname)}>
                <NavLink to={destination.path} end={destination.path === "/"}>
                  <destination.icon aria-hidden />
                  <span>{destination.label}</span>
                </NavLink>
              </BottomNavItem>
            ))}
          </BottomNav>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
