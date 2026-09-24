/* Navigation on tablets and desktops (collapsible to icons). Phones use the tab bar. */
import { NavLink, useLocation } from "react-router"
import { Brand } from "@/components/brand"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { isActive, MAIN_DESTINATIONS, MORE_DESTINATIONS, type Destination } from "@/app/navigation"

function DestinationMenu({ destinations, pathname }: { destinations: readonly Destination[]; pathname: string }) {
  return (
    <SidebarMenu>
      {destinations.map((destination) => (
        <SidebarMenuItem key={destination.path}>
          <SidebarMenuButton asChild isActive={isActive(destination, pathname)} tooltip={destination.label}>
            <NavLink to={destination.path} end={destination.path === "/"}>
              <destination.icon aria-hidden />
              <span>{destination.label}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { pathname } = useLocation()
  return (
    <Sidebar collapsible="icon" role="navigation" aria-label="Navigation">
      <SidebarHeader>
        <NavLink to="/" aria-label="OpenMana – Start" className="rounded-lg p-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 group-data-[collapsible=icon]:p-0">
          <Brand />
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <DestinationMenu destinations={MAIN_DESTINATIONS} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DestinationMenu destinations={MORE_DESTINATIONS} pathname={pathname} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
