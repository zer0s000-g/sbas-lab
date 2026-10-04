/**
 * What the panels, instruments and text alternatives show, derived from the engine in
 * one place (every view agrees). Pure: the page samples it at about 10 Hz.
 */
import { APPROACH_CHANNEL, DECISION_HEIGHT_FT, deviations, fasCrc, fasValid, makeFasDataBlock, type Deviations } from '@/core/approach'
import { UDRE_TABLE_M } from '@/core/groundSegment'
import { operationFor, OPERATIONS, withinLimits, type Operation } from '@/core/operations'
import { approachMode, navStatus, type Snapshot } from '@/core/sbasWorld'
import type { ApproachMode, Fix } from '@/core/receiver'
import { scheduledMessage, messageType, type SbasSignal } from '@/core/messages'
import { GEO_SATS } from '@/core/orbits'
import { DEPARTURE, DESTINATION, REGION, zoneTime, type ZoneTime } from '@/core/region'
import { localToGeodetic } from '@/core/geo'
import { directionFor } from '@/journey/director'
import type { JourneyEngine } from '@/journey/engine'
import { phaseDef, PHASE_INDEX, type PhaseId } from '@/journey/phases'
import { formatMetres } from '@/lib/format'

const FAS = makeFasDataBlock()

export interface SatDot {
  id: string
  kind: 'gps' | 'geo'
  azDeg: number
  elDeg: number
  state: 'used' | 'tracked' | 'lost' | 'excluded'
}

export interface LogRow {
  second: number
  geo: string
  type: number
  name: string
  plain: string
  alarm: boolean
}

export interface ViewModel {
  phase: PhaseId
  phaseNo: number
  frozen: boolean
  signalS: number
  signalTotalS: number
  worldS: number
  /** Indonesian standard time under the aircraft: the clock hour and the zone (WIB, WITA). */
  localHour: number
  localZone: ZoneTime['zone']
  altFt: number
  gsKt: number
  distToGoNm: number
  sbasShown: boolean
  /** The operation whose limits apply now, if any. */
  op: Operation | null
  /** The fix the story navigates with, and where it came from. */
  nav: Fix | null
  navSource: 'sbas' | 'abas' | 'none'
  abas: Fix | null
  sbas: Fix | null
  /** L1 SBAS vertical-guidance fix, to compare with DFMC on final. */
  l1Pa: Fix | null
  dfmc: Fix | null
  /** DFMC with the non-precision K factor (the fix navigated with outside the final approach). */
  dfmcNpa: Fix | null
  mode: ApproachMode
  /** Approach mode if SBAS were in use (for the benefit card before the reveal). */
  sbasMode: ApproachMode
  withinLimits: boolean
  sats: SatDot[]
  gpsTracked: number
  geosTracked: number
  messageAgeS: number
  signal: SbasSignal
  log: LogRow[]
  alarmed: string[]
  dev: Deviations | null
  service: 'dfmc' | 'l1' | 'off'
  /** Phase-specific numbers for the "What's happening" panel. */
  detail: PhaseDetail | null
  /** Descent to landing: the approach mode annunciator is meaningful. */
  approachPhase: boolean
  /** The mode as annunciated: "LPV" on final, "LPV armed" on the descent. */
  modeText: string
}

export type PhaseDetail =
  | { kind: 'errors'; satId: string; elDeg: number; parts: { name: string; m: number; sbas: 'corrected' | 'modelled' | 'stays' }[] }
  | { kind: 'reference'; stations: number; perStation: number; pierce: number }
  | { kind: 'master'; ok: number; notMonitored: number; doNotUse: number; igpMonitored: number; igpTotal: number; bestUdreM: number }
  | { kind: 'uplink' }
  | { kind: 'fas'; channel: number; runway: string; gpaDeg: number; tchFt: number; halM: number; valM: number; crc: string; valid: boolean }
  | { kind: 'final'; heightFt: number; daFt: number; alongNm: number }

function phaseDetail(phase: PhaseId, snap: Snapshot, dev: Deviations | null): PhaseDetail | null {
  if (phase === 'errors') {
    const id = snap.abas?.used[0]
    const sat = snap.sats.find((s) => s.id === id)
    if (!sat?.parts) return null
    const p = sat.parts
    return {
      kind: 'errors',
      satId: sat.id,
      elDeg: sat.elDeg,
      parts: [
        { name: 'Satellite clock', m: p.clock, sbas: 'corrected' },
        { name: 'Orbit', m: p.orbit, sbas: 'corrected' },
        { name: 'Ionosphere', m: p.iono, sbas: 'corrected' },
        { name: 'Troposphere', m: p.tropo, sbas: 'modelled' },
        { name: 'Multipath and noise', m: p.multipath, sbas: 'stays' },
      ],
    }
  }
  if (phase === 'reference') {
    const obs = snap.ground.observations
    const stations = new Set(obs.map((o) => o.stationId)).size
    return { kind: 'reference', stations, perStation: stations ? obs.length / stations : 0, pierce: snap.ground.ionoObs.length }
  }
  if (phase === 'master') {
    const c = [...snap.ground.corrections.values()]
    const ok = c.filter((x) => x.status === 'ok')
    return {
      kind: 'master',
      ok: ok.length,
      notMonitored: c.filter((x) => x.status === 'not-monitored').length,
      doNotUse: c.filter((x) => x.status === 'do-not-use').length,
      igpMonitored: snap.ground.gridList.filter((g) => g.givei < 15).length,
      igpTotal: snap.ground.gridList.length,
      bestUdreM: ok.length ? Math.min(...ok.map((x) => UDRE_TABLE_M[x.udrei] ?? Infinity)) : Number.NaN,
    }
  }
  if (phase === 'uplink') return { kind: 'uplink' }
  if (phase === 'descent') {
    const crc = fasCrc(FAS)
    return { kind: 'fas', channel: APPROACH_CHANNEL, runway: FAS.runway, gpaDeg: FAS.gpaDeg, tchFt: FAS.tchFt, halM: FAS.halM, valM: FAS.valM, crc: crc.toString(16).toUpperCase().padStart(8, '0'), valid: fasValid(FAS, crc) }
  }
  if (phase === 'final' && dev) return { kind: 'final', heightFt: dev.heightAboveThresholdFt, daFt: DECISION_HEIGHT_FT, alongNm: dev.alongTrackM / 1852 }
  return null
}

function messageLog(snap: Snapshot, signal: SbasSignal, alarmed: string[], rows = 7): LogRow[] {
  if (snap.service.geosTracked === 0) return []
  const now = Math.floor(snap.tS)
  const out: LogRow[] = []
  for (let s = now; s > now - rows; s--) {
    const geoIndex = ((s % GEO_SATS.length) + GEO_SATS.length) % GEO_SATS.length
    const type = scheduledMessage(s, geoIndex, signal)
    const mt = messageType(signal, type)
    out.push({ second: s, geo: GEO_SATS[geoIndex].id, type, name: mt?.name ?? `Type ${type}`, plain: mt?.plain ?? '', alarm: false })
  }
  if (alarmed.length) out[0] = { ...out[0], type: signal === 'L1' ? 6 : 34, name: 'Integrity: Do not use', plain: `Stop using ${alarmed.join(', ')}`, alarm: true }
  return out
}

export function viewModel(e: JourneyEngine): ViewModel {
  const snap = e.snapshot()
  const phase = e.state.phase
  const def = phaseDef(phase)
  const a = e.aircraft
  const stage = directionFor(phase).stage
  const op = operationFor(stage)
  const cond = e.conditions()
  const shown = e.sbasShown
  const am = approachMode(snap)
  let nav: Fix | null = snap.abas
  let navSource: ViewModel['navSource'] = snap.abas ? 'abas' : 'none'
  if (shown) {
    if (stage === 'final') {
      nav = am.fix
      navSource = am.fix ? (am.fix === snap.abas ? 'abas' : 'sbas') : 'none'
    } else if (op) {
      const ns = navStatus(snap, op)
      nav = ns.fix
      navSource = ns.source
    } else {
      nav = snap.sbasFix ?? snap.abas
      navSource = snap.sbasFix ? 'sbas' : snap.abas ? 'abas' : 'none'
    }
  }
  const used = new Set(nav?.used ?? [])
  const excluded = new Set([...(nav?.excluded ?? []), ...snap.alarmedSats])
  const sats: SatDot[] = snap.sats
    .filter((s) => s.visible)
    .map((s) => ({ id: s.id, kind: s.kind, azDeg: s.azDeg, elDeg: s.elDeg, state: excluded.has(s.id) ? 'excluded' : !s.tracked ? 'lost' : s.kind === 'geo' || used.has(s.id) ? (s.kind === 'geo' ? 'tracked' : 'used') : 'tracked' }))
  // Before the reveal the story flies GPS alone, which supports LNAV at best (Doc 9849 §1.4.2.2).
  const mode: ApproachMode = shown ? am.mode : snap.abas && !snap.abas.alarm && snap.abas.hplM <= OPERATIONS.npa.halM ? 'LNAV' : 'NONE'
  const signal: SbasSignal = cond.service === 'l1' ? 'L1' : 'DFMC'
  const dev = stage === 'final' || stage === 'approach' ? deviations(FAS, a.eastNm, a.northNm, a.altFt) : null
  return {
    phase,
    phaseNo: PHASE_INDEX.get(phase)! + 1,
    frozen: def.frozen,
    signalS: e.signalS,
    signalTotalS: def.signalS,
    worldS: e.worldS,
    ...(() => {
      const z = zoneTime(e.worldS, localToGeodetic(REGION, a.eastNm, a.northNm, 0).lonDeg, cond.startLocalHour)
      return { localHour: z.hour, localZone: z.zone }
    })(),
    altFt: a.altFt,
    gsKt: a.gsKt,
    distToGoNm: Math.hypot(DESTINATION.thresholdEastNm - a.eastNm, DESTINATION.thresholdNorthNm - a.northNm),
    sbasShown: shown,
    op,
    nav,
    navSource,
    abas: snap.abas,
    sbas: snap.sbasFix,
    l1Pa: snap.l1sbasPa,
    dfmc: snap.dfmc,
    dfmcNpa: snap.dfmcNpa,
    mode,
    sbasMode: am.mode,
    withinLimits: !!(op && nav && withinLimits(op, nav.hplM, nav.vplM)),
    sats,
    gpsTracked: snap.sats.filter((s) => s.kind === 'gps' && s.tracked).length,
    geosTracked: snap.service.geosTracked,
    messageAgeS: snap.service.messageAgeS,
    signal,
    log: messageLog(snap, signal, snap.alarmedSats),
    alarmed: snap.alarmedSats,
    dev,
    service: cond.service,
    detail: phaseDetail(phase, snap, dev),
    approachPhase: phase === 'descent' || phase === 'final' || phase === 'landing',
    modeText: mode === 'NONE' ? 'No GNSS approach' : phase === 'descent' ? `${mode} armed` : mode,
  }
}

/** The live text alternative for a view (design.md §5). */
export function describe(m: ViewModel, view: 'space' | 'flight' | 'network'): string {
  const pl = m.nav ? `HPL ${formatMetres(m.nav.hplM)}${m.nav.vplM !== null ? `, VPL ${formatMetres(m.nav.vplM)}` : ''}` : 'no position'
  const lim = m.op ? `${m.op.name} limits HAL ${formatMetres(m.op.halM)}${m.op.valM !== null ? `, VAL ${formatMetres(m.op.valM)}` : ''}, ${m.withinLimits ? 'within limits' : 'outside limits'}` : ''
  const where = `LAB201 ${m.altFt < 100 ? 'on the ground' : `at ${Math.round(m.altFt / 100) * 100} ft`}, ${m.distToGoNm.toFixed(1)} NM from ${DESTINATION.city}`
  const sky = `${m.gpsTracked} GPS satellites tracked, ${m.geosTracked} of ${GEO_SATS.length} SBAS GEOs (${GEO_SATS.map((g) => g.id).join(' and ')}) received`
  // Where the flight view is looking: an airport, the Java Sea, Java or the sea off Bali.
  const routeNm = Math.hypot(DESTINATION.thresholdEastNm - DEPARTURE.thresholdEastNm, DESTINATION.thresholdNorthNm - DEPARTURE.thresholdNorthNm)
  const ap = (a: typeof DEPARTURE) => `${a.city} ${a.name} (${a.id})`
  const place =
    m.altFt < 100
      ? `at ${m.distToGoNm > routeNm / 2 ? ap(DEPARTURE) : ap(DESTINATION)}, with its runway, taxiways and terminal`
      : m.distToGoNm < 15
        ? `on final to runway ${DESTINATION.runway} at ${DESTINATION.city}, over the sea with the coast and the runway ahead`
        : m.distToGoNm > routeNm - 25
          ? `climbing out from ${DEPARTURE.city} over the Java Sea`
          : 'along Java, with the Java Sea to the north and the volcanoes below'
  const lead =
    view === 'space'
      ? 'Space view: the Earth, the GPS constellation and the Michibiki SBAS GEOs over Indonesia.'
      : view === 'network'
        ? 'Network map of Indonesia: the hypothetical SBAS ground segment, with RIMS reference stations, master control centres, uplink stations and the ionospheric grid.'
        : `Flight view: LAB201 ${place}.`
  return [lead, where, sky, `Using ${m.navSource === 'sbas' ? 'SBAS' : m.navSource === 'abas' ? 'GPS alone' : 'nothing'}: ${pl}`, lim, `Approach mode ${m.mode}`].filter(Boolean).join('. ') + '.'
}
