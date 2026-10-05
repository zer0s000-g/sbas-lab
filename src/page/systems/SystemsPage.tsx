import { useEffect, useMemo, useState } from 'react'
import { SiteHeader } from '@/components/SiteHeader'
import { ScenarioBar } from '@/components/ScenarioBar'
import { HudPanel, TitleBlock } from '@/hud/HudFrame'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { decodeRings } from '@/views/geo/coast'
import { world } from '@/views/geo/world.data'
import { SBAS_STUDIES, SBAS_SYSTEMS, STATUS_TEXT, type SbasSystem, type SystemStatus } from '@/content/sbasSystems'
import { SourcesButton, SourcesSheet } from '../sources/SourcesSheet'
import { useSources } from '../sources/store'
import { SbasChain } from './SbasChain'

/** The world map: equirectangular, 180°W–180°E, 60°S–80°N. */
const MAP = { lon0: -180, lon1: 180, lat0: -60, lat1: 80 }
const W = 720
const H = Math.round((W * (MAP.lat1 - MAP.lat0)) / (MAP.lon1 - MAP.lon0))
const X = (lon: number) => ((lon - MAP.lon0) / (MAP.lon1 - MAP.lon0)) * W
const Y = (lat: number) => ((MAP.lat1 - lat) / (MAP.lat1 - MAP.lat0)) * H
const LAND = decodeRings(world)
  .map((r) => {
    let d = ''
    for (let i = 0; i < r.length; i += 2) d += `${i ? 'L' : 'M'}${X(r[i]).toFixed(1)} ${Y(Math.max(MAP.lat0, Math.min(MAP.lat1, r[i + 1]))).toFixed(1)}`
    return `${d}Z`
  })
  .join('')
const areaPath = (s: SbasSystem) => (s.area ? `${s.area.map(([lon, lat], i) => `${i ? 'L' : 'M'}${X(lon).toFixed(1)} ${Y(lat).toFixed(1)}`).join('')}Z` : '')

/** GEO PRNs, with the ones not yet operational marked. */
const prnList = (s: SbasSystem) =>
  s.geos
    .filter((g) => g.prn)
    .map((g) => (g.role === 'operational' || g.role === 'not stated' ? String(g.prn) : `${g.prn} ${g.role === 'open service' ? 'open service' : g.role}`))
    .join(', ') || '–'
const servicesText = (s: SbasSystem) => (s.services.length ? s.services.map((v) => `${v.level}${v.year ? ` (${v.planned ? 'planned ' : ''}${v.year})` : ''}`).join('; ') : 'None declared')

const STATUS_TONE: Readonly<Record<SystemStatus, string>> = { operational: 'text-success', development: 'text-brass', test: 'text-muted-foreground' }

function StatusTag({ status }: { status: SystemStatus }) {
  return (
    <span className={cn('hud-label inline-flex items-center gap-1.5', STATUS_TONE[status])}>
      <span className={cn('inline-block size-1.5', status === 'operational' ? 'bg-success' : status === 'development' ? 'rotate-45 bg-brass' : 'border border-muted-foreground')} aria-hidden />
      {STATUS_TEXT[status]}
    </span>
  )
}

/** The world map: every service area as a hairline, the chosen one filled, its GEOs on the equator. */
function WorldMap({ chosen, onChoose }: { chosen: SbasSystem; onChoose: (id: string) => void }) {
  const geos = chosen.geos.filter((g) => g.lonDeg !== null)
  return (
    <div className="rounded-[4px] border border-hud-line bg-sim-water">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={`World map of SBAS service areas for civil aviation. ${chosen.name} highlighted: ${chosen.areaNote}${geos.length ? ` GEO satellites over the equator at ${geos.map((g) => `${Math.abs(g.lonDeg!)}°${g.lonDeg! < 0 ? 'W' : 'E'}`).join(', ')}.` : ''} Areas are approximate.`}
      >
        <path d={LAND} className="fill-sim-land stroke-sim-grid-strong" strokeWidth={0.4} fillRule="evenodd" />
        <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} className="stroke-sim-grid-strong" strokeDasharray="3 4" strokeWidth={0.6} />
        {SBAS_SYSTEMS.filter((s) => s.area && s.id !== chosen.id).map((s) => (
          <path key={s.id} d={areaPath(s)} className="cursor-pointer fill-transparent stroke-sim-ink/45 hover:stroke-sim-ink" strokeWidth={0.9} strokeDasharray="4 3" onClick={() => onChoose(s.id)}>
            <title>{s.name}</title>
          </path>
        ))}
        {chosen.area && <path d={areaPath(chosen)} className="fill-signal/25 stroke-signal" strokeWidth={1.6} />}
        {geos.map((g) => (
          <g key={`${g.prn}-${g.lonDeg}`}>
            <line x1={X(g.lonDeg!)} x2={X(g.lonDeg!)} y1={Y(0) - 9} y2={Y(0) + 9} className="stroke-brass/60" strokeWidth={0.6} />
            <path d={`M${X(g.lonDeg!)} ${Y(0) - 5}l5 5-5 5-5-5z`} className={g.role === 'operational' ? 'fill-brass stroke-brass' : 'fill-sim-water stroke-brass'} strokeWidth={1.2} />
          </g>
        ))}
      </svg>
    </div>
  )
}

function SystemPicker({ chosen, onChoose, compact }: { chosen: SbasSystem; onChoose: (id: string) => void; compact: boolean }) {
  if (compact)
    return (
      <Select value={chosen.id} onValueChange={onChoose}>
        <SelectTrigger aria-label="SBAS system" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SBAS_SYSTEMS.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name} · {s.region}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  return (
    <ul className="flex flex-col" aria-label="SBAS systems">
      {SBAS_SYSTEMS.map((s) => {
        const on = s.id === chosen.id
        return (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onChoose(s.id)}
              className={cn(
                'flex min-h-10 w-full items-center justify-between gap-2 border-l-2 px-3 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                on ? 'border-signal bg-signal/10 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="hud-label text-foreground">{s.name}</span>
                <span className="truncate text-[12px]">{s.region}</span>
              </span>
              <span className={cn('inline-block size-2 shrink-0', s.status === 'operational' ? 'bg-success' : s.status === 'development' ? 'rotate-45 bg-brass' : 'border border-muted-foreground')} aria-label={STATUS_TEXT[s.status]} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function SystemCard({ s }: { s: SbasSystem }) {
  const showSources = useSources((x) => x.show)
  const count = (v: number | null) => (v === null ? 'not published' : String(v))
  return (
    <HudPanel index="02" title={s.name}>
      <p className="text-[12px] text-muted-foreground">{s.full}</p>
      <div className="mt-2">
        <StatusTag status={s.status} />
      </div>
      <p className="mt-2 text-[14px] leading-5 text-foreground">{s.headline}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px] leading-5">
        <dt className="hud-label pt-0.5">Provider</dt>
        <dd className="text-foreground">{s.provider}</dd>
        <dt className="hud-label pt-0.5">Serves</dt>
        <dd className="text-foreground">{s.region}</dd>
        <dt className="hud-label pt-0.5">Aviation</dt>
        <dd>
          {s.services.length ? (
            <ul className="flex flex-col gap-0.5 text-foreground">
              {s.services.map((v) => (
                <li key={v.level}>
                  {v.level}
                  {v.year !== null && <span className="hud-value ml-1.5 text-[12px] text-muted-foreground">{v.planned ? `planned ${v.year}` : v.year}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-foreground">No aviation service declared yet</span>
          )}
        </dd>
        <dt className="hud-label pt-0.5">GEOs</dt>
        <dd className="text-foreground">
          {s.geos.map((g) => `${g.name}${g.prn ? ` (PRN ${g.prn})` : ''}${g.role !== 'operational' ? `, ${g.role}` : ''}`).join(' · ')}
        </dd>
        <dt className="hud-label pt-0.5">Ground</dt>
        <dd className="text-foreground">
          Reference {count(s.ground.reference)} · master {count(s.ground.master)} · uplink {s.id === 'egnos' ? '2 per GEO' : count(s.ground.uplink)}
          <span className="block text-[12px] text-muted-foreground">{s.ground.note}</span>
        </dd>
        <dt className="hud-label pt-0.5">DFMC</dt>
        <dd className="text-foreground">{s.dfmc}</dd>
      </dl>
      <button type="button" className="hud-label mt-3 normal-case underline-offset-2 hover:text-foreground hover:underline" onClick={() => showSources([s.claim])}>
        Sources for {s.name}
      </button>
    </HudPanel>
  )
}

/**
 * The SBAS systems of the world, for civil aviation (`?view=systems`): where each serves,
 * its status and services, how SBAS works end to end, and a side-by-side comparison.
 */
export default function SystemsPage() {
  const [chosenId, setChosenId] = useState('egnos')
  const chosen = useMemo(() => SBAS_SYSTEMS.find((s) => s.id === chosenId) ?? SBAS_SYSTEMS[0], [chosenId])
  const wide = useMediaQuery('(min-width: 1024px)')
  useEffect(() => {
    document.title = 'SBAS Lab · SBAS worldwide: satellite augmentation for civil aviation'
  }, [])
  return (
    <>
      <SiteHeader actions={<SourcesButton />} />
      <ScenarioBar />
      <main id="main" className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <TitleBlock kicker="SBAS worldwide · civil aviation" title="Satellite augmentation around the world" sub="Who provides it, where, for which approaches, and how it works end to end" />

        <section aria-labelledby="map-title" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <HudPanel index="01" title={<span id="map-title">Service areas</span>}>
            <WorldMap chosen={chosen} onChoose={setChosenId} />
            <p className="hud-label mt-2 normal-case text-muted-foreground">
              Areas approximate, drawn from each provider’s wording, not official maps · ◆ GEO satellite over the equator (filled: operational) · dashed: other systems
            </p>
            {!wide && (
              <div className="mt-3">
                <SystemPicker chosen={chosen} onChoose={setChosenId} compact />
              </div>
            )}
          </HudPanel>
          {wide ? (
            <HudPanel index="··" title="Systems">
              <SystemPicker chosen={chosen} onChoose={setChosenId} compact={false} />
            </HudPanel>
          ) : null}
        </section>

        <section aria-label={`${chosen.name} in detail`} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <SystemCard s={chosen} />
          <HudPanel index="03" title="How SBAS works, end to end">
            <SbasChain system={chosen} />
          </HudPanel>
        </section>

        <section aria-labelledby="compare-title">
          <HudPanel index="04" title={<span id="compare-title">Side by side</span>}>
            {/* Phones: one card per system; wider screens: the table. */}
            <ul className="flex flex-col divide-y divide-hud-line md:hidden">
              {SBAS_SYSTEMS.map((s) => (
                <li key={s.id} className="py-3">
                  <button type="button" className="hud-label min-h-10 text-left text-foreground underline-offset-2 hover:underline" onClick={() => setChosenId(s.id)}>
                    {s.name} · <span className="normal-case tracking-normal text-muted-foreground">{s.region}</span>
                  </button>
                  <div>
                    <StatusTag status={s.status} />
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-foreground">{servicesText(s)}</p>
                  <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
                    GEO PRNs {prnList(s)} · {s.dfmc}
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>System</TableHead>
                    <TableHead>Serves</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aviation services</TableHead>
                    <TableHead>GEO PRNs</TableHead>
                    <TableHead>DFMC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SBAS_SYSTEMS.map((s) => (
                    <TableRow key={s.id} className={cn(s.id === chosen.id && 'bg-signal/5')}>
                      <TableCell>
                        <button type="button" className="hud-label min-h-10 text-left text-foreground underline-offset-2 hover:underline" onClick={() => setChosenId(s.id)}>
                          {s.name}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-normal">{s.region}</TableCell>
                      <TableCell>
                        <StatusTag status={s.status} />
                      </TableCell>
                      <TableCell className="whitespace-normal">{servicesText(s)}</TableCell>
                      <TableCell className="hud-value whitespace-normal">{prnList(s)}</TableCell>
                      <TableCell className="whitespace-normal">{s.dfmc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="mt-3 flex flex-col gap-1 text-[12.5px] leading-5 text-muted-foreground">
              {SBAS_STUDIES.map((x) => (
                <li key={x.name}>
                  <span className="hud-label mr-1.5 text-foreground">{x.name}</span>
                  {x.text}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-4 text-muted-foreground">
              Civil aviation only. Researched from the providers’ and ICAO’s public documents up to October 2026 (each system’s sources are listed under Sources); statuses change, so check the provider’s current notices. Not published or endorsed by any SBAS provider.
            </p>
          </HudPanel>
        </section>
      </main>
      <SourcesSheet />
    </>
  )
}
