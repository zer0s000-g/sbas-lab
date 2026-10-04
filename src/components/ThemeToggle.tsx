import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePrefs, type ThemeChoice } from '@/stores/prefs'

const MOTION = { system: null, reduce: true, full: false } as const

/**
 * Theme and motion preferences. (Sound and its captions join this menu when the page
 * plays sound: src/lib/audio.ts is not wired in yet, and a switch that does nothing
 * would mislead.)
 */
export function ThemeToggle() {
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  const motion = usePrefs((s) => s.reducedMotionOverride)
  const setMotion = usePrefs((s) => s.setReducedMotion)
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Display and motion settings">
          <Icon className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden /> Same as device
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Motion</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={motion === null ? 'system' : motion ? 'reduce' : 'full'}
          onValueChange={(v) => setMotion(MOTION[v as keyof typeof MOTION])}
        >
          <DropdownMenuRadioItem value="system">Same as device</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="reduce">Reduce motion</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="full">Full motion</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
