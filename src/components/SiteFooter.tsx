import { ShieldAlert } from 'lucide-react'
import { SCENARIO } from '@/scenarios/active'
import { ACTIVE_VIEW } from '@/page/view'

const SYSTEMS_FOOTER =
  'A summary for civil aviation from public documents; statuses and dates change with each provider’s notices. The page is not published or endorsed by any SBAS provider, ICAO or EUROCONTROL.'

export const DISCLAIMER = 'For educational use only, not for operational use.'

export function SiteFooter() {
  return (
    <footer className="border-t border-hud-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-6 text-[12px] leading-5 text-muted-foreground md:flex-row md:items-start md:justify-between md:px-8">
        <p className="hud-label flex items-center gap-2 text-foreground/80">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          {DISCLAIMER}
        </p>
        <p className="max-w-2xl">{ACTIVE_VIEW === 'systems' ? SYSTEMS_FOOTER : SCENARIO.texts.footer}</p>
      </div>
    </footer>
  )
}
