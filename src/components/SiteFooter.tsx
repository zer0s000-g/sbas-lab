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
          DO-229 where stated and should be checked by a qualified GNSS/CNS engineer. Indonesia has no operational SBAS
          today: the SBAS service, its ground sites and the LPV procedure shown are hypothetical. QZS-3 and QZS-6 are real
          Japanese Michibiki satellites, shown here for illustration; MSAS, the SBAS they carry, serves Japan.
        </p>
      </div>
    </footer>
  )
}
