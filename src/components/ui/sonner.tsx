import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// OpenMana is dark-only (docs/DESIGN_SYSTEM.md), so the toaster needs no
// theme provider (shadcn's default reads next-themes here).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          // OpenMana (menu style "Reich", prompt 58): a toast is a small panel - the table's panel tone, the gold hairline.
          "--normal-bg": "var(--panel)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--gold-line)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // Edge to edge (viewport-fit=cover): toasts keep clear of a front camera (sonner's own distances plus the insets).
      offset={{ top: "calc(24px + env(safe-area-inset-top))", right: "calc(24px + env(safe-area-inset-right))", bottom: "calc(24px + env(safe-area-inset-bottom))", left: "calc(24px + env(safe-area-inset-left))" }}
      mobileOffset={{ top: "calc(16px + env(safe-area-inset-top))", right: "calc(16px + env(safe-area-inset-right))", bottom: "calc(16px + env(safe-area-inset-bottom))", left: "calc(16px + env(safe-area-inset-left))" }}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
