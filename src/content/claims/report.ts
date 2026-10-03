/**
 * docs/EXPERT_REVIEW.md and docs/claims.csv, rendered from the claims registry. Pure,
 * so a test can check the committed files are current; scripts/claims-report.mjs
 * writes them (npm run claims).
 */
import { SOURCES } from '../sources'
import { CLAIMS, STATUS_LABEL, statusCounts } from './index'
import type { Claim } from './types'

/** Questions for the reviewer that are not one claim. */
export const OPEN_QUESTIONS: readonly string[] = [
  '**The Indonesian scenario.** Check that nothing on the page reads as a claim that MSAS or any real SBAS serves Indonesia, that the 16 RIMS sites and the Jakarta/Makassar MCC and uplink sites are clearly illustrative, and that the Bali LPV approach (RNP RWY 09, channel 54201) is clearly not a published procedure. The scenario tab is named "AirNav Indonesia" for its audience; check it does not read as naming an SBAS operator.',
  '**Bali coastline.** Natural Earth 1:10m puts the Kuta–Tuban isthmus about 3 km east of the real shore by the runway. The terrain fills the airfield as reclaimed land up to that coastline (`views/terrain.ts`); confirm this reads acceptably.',
  '**Two GEOs for LPV.** Doc 9849 §4.3.2.10 requires the avionics to track two available SBAS satellites for LNAV/VNAV, LP and LPV. The model shows the count of GEOs tracked, keeps LPV with one GEO and loses it only when both are lost (after the time-out). Confirm that is the right reading.',
  '**DFMC services.** DFMC SBAS services are planned rather than operational (Doc 9849 §4.3.4.5: WAAS around 2026, EGNOS from 2028). The hypothetical Indonesian SBAS offers one; the ESSP-SAS scenario shows EGNOS v3 DFMC only as a labelled preview.',
  '**The ESSP-SAS scenario.** Check the EGNOS facts against the current EGNOS SoL SDD and service notices: the operational GEOs, the RIMS, MCC and NLES sites shown, ESSP’s role, the NOTAM proposal service and the EWA figures. The build could not reach the EGNOS user support site and used search results quoting it.',
  '**RIMS in the model.** The ESSP-SAS ground segment computes its corrections from the 11 RIMS it shows, not EGNOS’s full network, so the "RIMS offline" failure has a far larger effect than it would in reality; the page says so. Check the wording.',
  '**Nice LPV-200 at 200 ft.** The illustrative RNP RWY 04L approach is flown to LPV-200 minima with a 200 ft decision height over the Baie des Anges; the published procedure, its minima and its FAS data block are not used.',
]

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const refsText = (c: Claim) => c.refs.map((r) => `${SOURCES[r.source].publisher} ${shortTitle(r.source)}${r.section ? ` ${r.section}` : ''}`).join('; ')
const shortTitle = (id: keyof typeof SOURCES) => {
  const t = SOURCES[id].title
  const m = t.match(/(Doc \d+|DO-229|ED-259|Annex 10|SoL\) Service Definition Document|TR8350\.2|IS-GPS-200|2017\/1406)/)
  return m ? m[1].replace('SoL) Service Definition Document', 'SoL SDD') : t.length > 60 ? `${t.slice(0, 57)}…` : t
}
const valueText = (c: Claim) => (c.value === undefined ? '' : `${Array.isArray(c.value) ? c.value.join(', ') : c.value}${c.unit ? ` ${c.unit}` : ''}`)
const scenarioText = (c: Claim) => (c.scenarios.length === 2 ? 'both' : c.scenarios[0] === 'essp' ? 'ESSP-SAS' : 'AirNav Indonesia')

function table(claims: readonly Claim[]): string {
  const rows = claims.map((c) => `| \`${c.id}\` | ${scenarioText(c)} | ${esc(c.text)}${c.note ? ` *${esc(c.note)}*` : ''} | ${esc(valueText(c))} | ${esc(refsText(c))} | ${c.code ? `\`${c.code}\`` : ''} |`)
  return ['| Claim | Scenario | What the page says | Value | Source | Code |', '|---|---|---|---|---|---|', ...rows].join('\n')
}

export function renderExpertReview(): string {
  const n = statusCounts(CLAIMS)
  const byStatus = (s: Claim['status']) => CLAIMS.filter((c) => c.status === s)
  const sources = Object.values(SOURCES).map((s) => `| ${esc(s.title)} | ${esc(s.edition)} | ${s.publisher} | ${s.access} | ${esc(s.note ?? '')} |`)
  return `# Expert review list

<!-- Generated from src/content/claims by \`npm run claims\`. Do not edit by hand: change the registry. -->

Every fact SBAS Lab shows or computes is a claim in \`src/content/claims\`, with its sources and
review status. A qualified GNSS/CNS engineer should check them against ICAO Annex 10 Volume I,
ICAO Doc 9849, RTCA DO-229, EUROCAE ED-259 and, for the ESSP-SAS scenario, the EGNOS Safety of
Life Service Definition Document and service notices. The same list, for a spreadsheet, is
\`docs/claims.csv\`.

Tests keep the registry honest: a claim's value must match the code; every
\`TODO(expert-review)\` in the code belongs to a claim marked "to confirm"; every claim the
narration cites exists; and this file must be regenerated when the registry changes.

## Summary

| Status | Claims | Meaning |
|---|---|---|
| ${STATUS_LABEL.reviewed} | ${n.reviewed} | Confirmed by a named reviewer against the primary source |
| ${STATUS_LABEL.sourced} | ${n.sourced} | Source and section identified; not yet signed off |
| ${STATUS_LABEL['to-confirm']} | ${n['to-confirm']} | Not yet traced to a primary source, or an illustrative value the page labels as such |

## To confirm

${table(byStatus('to-confirm'))}

## Sourced, awaiting review

${table(byStatus('sourced'))}

## Reviewed

${n.reviewed ? table(byStatus('reviewed')) : 'None yet.'}

## Sources

| Document | Edition | Publisher | Used | Note |
|---|---|---|---|---|
${sources.join('\n')}

## Open questions for the reviewer

${OPEN_QUESTIONS.map((q) => `- ${q}`).join('\n')}

## Signing a claim off

Set the claim's \`status\` to \`'reviewed'\` and its \`review\` to \`{ by: '<name, role>', on: '<date>' }\`
in \`src/content/claims\`, correct the text, value or source if needed (the code must follow a
corrected value, or its test fails), remove the matching \`TODO(expert-review)\` from the code,
and run \`npm run claims\` to regenerate this file.
`
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export function renderClaimsCsv(): string {
  const head = ['id', 'topic', 'scenario', 'status', 'claim', 'value', 'sources', 'code', 'note', 'reviewed_by', 'reviewed_on']
  const rows = CLAIMS.map((c) => [c.id, c.topic, scenarioText(c), c.status, c.text, valueText(c), refsText(c), c.code ?? '', c.note ?? '', c.review?.by ?? '', c.review?.on ?? ''].map(csvCell).join(','))
  return [head.join(','), ...rows].join('\n') + '\n'
}
