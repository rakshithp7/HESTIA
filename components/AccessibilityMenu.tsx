import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { useAccessibility } from "@/components/providers/accessibility-provider"
import { PersonStandingIcon } from "lucide-react"

export function AccessibilityMenu() {
  const {
    highContrast,
    setHighContrast,
    dyslexicFont,
    setDyslexicFont,
    textScale,
    setTextScale,
  } = useAccessibility()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Accessibility Settings"
          className="data-[state=open]:bg-primary data-[state=open]:text-white dark:data-[state=open]:text-black"
        >
          <PersonStandingIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px] p-4">
        <DropdownMenuLabel className="mb-2 text-md text-center font-serif">
          Accessibility Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mb-4" />

        <div className="space-y-6">
          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <span className="text-base font-medium">High Contrast</span>
            <Switch
              checked={highContrast}
              onCheckedChange={setHighContrast}
            />
          </div>

          {/* Dyslexic Font */}
          <div className="flex items-center justify-between">
            <span className="text-base font-medium">Dyslexic Font</span>
            <Switch
              checked={dyslexicFont}
              onCheckedChange={setDyslexicFont}
            />
          </div>

          {/* Text Scale */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium">Text Scale</span>
              <span className="text-sm text-muted-foreground">{Math.round(textScale * 100)}%</span>
            </div>
            <div className="flex items-center gap-2 justify-between bg-muted/50 p-1 rounded-md">
              <Button
                variant="ghost"
                className="flex-1 h-8"
                onClick={() => setTextScale(Math.max(0.8, textScale - 0.1))}
                disabled={textScale <= 0.8}
              >
                <span className="text-sm">A-</span>
              </Button>
              <div className="h-4 w-[1px] bg-border" />
              <Button
                variant="ghost"
                className="flex-1 h-8"
                onClick={() => setTextScale(Math.min(1.5, textScale + 0.1))}
                disabled={textScale >= 1.5}
              >
                <span className="text-lg">A+</span>
              </Button>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
