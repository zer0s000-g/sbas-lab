/**
 * Claims of the training layer: the controller's view (arrival traffic and the
 * conventional approach a controller can clear aircraft to) and the curriculum mapping
 * of the assessment's objectives.
 */
import { SCENARIO_TRAFFIC } from '@/scenarios/traffic'
import { CURRICULUM_LINKS } from '@/content/curricula'
import type { Claim } from './types'

const BOTH = ['indonesia', 'essp'] as const

export const TRAINING_CLAIMS: readonly Claim[] = [
  {
    id: 'atc.traffic',
    topic: 'Operations and ATM',
    scenarios: BOTH,
    text: 'The arrivals in the controller’s view, their streams, callsigns and equipage (SBAS, GPS only, or no GNSS approach) are illustrative; what each one can fly comes from the same simulated SBAS world as LAB201.',
    refs: [{ source: 'icao-doc9613', section: 'Vol II Part C Ch 5, 5.2.7 (controller training: mixed equipage)' }],
    status: 'to-confirm',
    code: 'src/scenarios/traffic.ts',
    note: 'Illustrative by design; the panel labels it.',
  },
  {
    id: 'atc.conventional-approach',
    topic: 'Operations and ATM',
    scenarios: BOTH,
    text: 'When GNSS cannot be used, the controller can clear arrivals to the conventional approach of the runway in use: ILS RWY 04L at Nice and ILS RWY 09 at Bali.',
    refs: [{ source: 'aip-france', section: 'AD 2 LFMN' }, { source: 'aip-indonesia', section: 'AD 2 WADD' }, { source: 'icao-doc9849', section: 'Appendix F (alternate navigation and ATC vectoring)' }],
    status: 'to-confirm',
    value: 'ILS RWY 04L / ILS RWY 09',
    actual: () => [SCENARIO_TRAFFIC.essp.conventional, SCENARIO_TRAFFIC.indonesia.conventional].join(' / '),
    code: 'src/scenarios/traffic.ts',
    note: 'Check both procedures against the current AIRAC AIP.',
  },
  {
    id: 'training.curricula',
    topic: 'Training',
    scenarios: ['essp'],
    text: 'The assessment’s six objectives are mapped to items of EU ATSEP training (Part-PERS), EU ATCO training (Part ATCO), the EU rule on GNSS status information for ATS (ATS.OR.525(b)), and ICAO Doc 9613 and Doc 9849. The mapping is proposed, not approved by any authority.',
    refs: [{ source: 'eu-2017-373-pers' }, { source: 'eu-2015-340' }, { source: 'icao-doc9613', section: 'Vol II Part C Ch 5' }, { source: 'icao-doc9849-3rd', section: 'Chapters 2, 4, 5 and 7, Appendix F' }, { source: 'essp-lpv-guidelines', section: '§5.4' }],
    status: 'sourced',
    value: 34,
    unit: 'links',
    actual: () => CURRICULUM_LINKS.length,
    code: 'src/content/curricula.ts',
    note: 'ICAO PANS-TRG, Doc 10056/10057 and EUROCONTROL syllabi were not read; later amendments to the Easy Access Rules were not checked.',
  },
]
