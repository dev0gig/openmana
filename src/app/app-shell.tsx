/*
 * Frame of every surface: sidebar (md and up) or top bar + tab bar (phones),
 * the engine session shared by all pages, tooltips and toasts.
 */
import { Settings } from "lucide-react"
import { NavLink, Outlet, ScrollRestoration, useLocation } from "react-router"
import { AppSidebar } from "@/components/app-sidebar"
import { Brand } from "@/components/brand"
import { BottomNav, BottomNavItem } from "@/components/ui/bottom-nav"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { EngineSessionProvider } from "@/engine/engine-session-context"
import { isActive, MAIN_DESTINATIONS } from "./navigation"

export function AppShell() {
  const { pathname } = useLocation()
  return (
    <EngineSessionProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:h-12 md:border-b-0">
              <SidebarTrigger className="hidden md:inline-flex" />
              <NavLink to="/" aria-label="OpenMana – Start" className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden">
                <Brand />
              </NavLink>
              <Button asChild variant="ghost" size="icon-lg" className="ml-auto md:hidden">
                <NavLink to="/settings" aria-label="Einstellungen">
                  <Settings aria-hidden />
                </NavLink>
              </Button>
            </header>
            <div className="flex-1">
              <Outlet />
            </div>
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
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
      <ScrollRestoration />
    </EngineSessionProvider>
  )
}
