import { ShieldAlert } from 'lucide-react'

export const DISCLAIMER = 'For educational use only, not for operational use.'

export function SiteFooter() {
  return (
    <footer className="border-t border-hud-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-6 text-[12px] leading-5 text-muted-foreground md:flex-row md:items-start md:justify-between md:px-8">
        <p className="hud-label flex items-center gap-2 text-foreground/80">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          {DISCLAIMER}
        </p>
        <p className="max-w-2xl">
          The simulation is simplified to teach principles. Technical values follow ICAO Annex 10 Volume I and RTCA
          DO-229 where stated and should be checked by a qualified GNSS/CNS engineer. The region, airports, stations and
          frequencies are made up for this fictional region.
        </p>
      </div>
    </footer>
  )
}
