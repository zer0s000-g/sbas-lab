/**
 * docs/EXPERT_REVIEW.md and docs/claims.csv, rendered from the claims registry. Pure,
 * so a test can check the committed files are current; scripts/claims-report.mjs
 * writes them (npm run claims).
 */
import { SOURCES } from '../sources'
import { AI_MODEL, CLAIMS, STATUS_LABEL, statusCounts } from './index'
import type { Claim } from './types'

/** Questions for the reviewer that are not one claim. */
export const OPEN_QUESTIONS: readonly string[] = [
  '**The controller’s view: conventional approaches.** The view lets the controller clear arrivals to the ILS RWY 04L at Nice and the ILS RWY 09 at Bali. Check both procedures, and their exact chart titles (for example a Z or Y suffix the clearance must carry), against the current AIRAC AIP France and AIP Indonesia (claim `atc.conventional-approach`).',
  '**The Indonesian scenario.** Check that nothing on the page reads as a claim that MSAS or any real SBAS serves Indonesia, that the 16 RIMS sites and the Jakarta/Makassar MCC and uplink sites are clearly illustrative, and that the Bali LPV approach (RNP RWY 09, channel 54201) is clearly not a published procedure. The scenario tab is named "AirNav Indonesia" for its audience; check it does not read as naming an SBAS operator.',
  '**Bali coastline.** Natural Earth 1:10m puts the Kuta–Tuban isthmus about 3 km east of the real shore by the runway. The terrain fills the airfield as reclaimed land up to that coastline (`views/terrain.ts`); confirm this reads acceptably.',
  '**Airports (AIP France).** `scenario.essp-airports` needs AIP France AD 2 LFBO and LFMN (current AIRAC): threshold coordinates, elevations, true bearings and TORA/LDA. OurAirports matches the code except the length of LFMN 04L (2628 m there, 2570 m here), which may be a declared distance rather than the physical length.',
  '**Airports (AIP Indonesia).** `scenario.indonesia-airports` needs AIP Indonesia AD 2 WIII and WADD (current AIRAC). OurAirports matches the code except the length of WADD 09 (2984 m there, 2996 m here).',
  '**FIR hand-off (AIP Indonesia).** `scenario.indonesia-fir` needs AIP Indonesia ENR 2.1, or an AirNav Indonesia reviewer, for where the route crosses from the Jakarta FIR to the Ujung Pandang FIR and the names of the units.',
  '**L5 from QZS-3 and QZS-6 (JCAB).** `scenario.qzs6-status`: JCAB’s ITF/8 IP/05 (May 2026) gives QZS-6 in SBAS service since October 2025, but nothing read says whether QZS-3 and QZS-6 broadcast an L5 (DFMC) SBAS signal, which the AirNav Indonesia scenario shows; a JCAB/MSAS notice or AIP Japan GEN/ENR entry would settle it.',
  '**Departure alert limit (RTCA DO-229).** `ops.departure-row`: EGNOS SoL SDD v3.6 Table 7, summarising Annex 10, gives the departure row HAL 556 m (0.3 NM), which the page applies; an earlier reading of Annex 10 Note 2 found no departure HAL, the PBN Manual uses 1 NM for RNAV 1 and RNP 1 departures, and the earlier build used 1 NM. A reviewer with Annex 10 and DO-229 should settle the departure-mode HAL.',
  '**Other values only RTCA DO-229 can settle.** The ±1 NM limit on the LPV lateral full scale (`sbas.lpv-deviations`, in neither Annex 10 nor Doc 8168); the FDE false-alert requirement, per hour rather than the per-epoch 10⁻⁵ the page uses (`sbas.raim`); whether LP shares the UDREI ≥ 12 rule and the 12 s UDREI time-out of precision approach and APV (`sbas.do-not-use`, `sbas.timeouts`).',
  '**DFMC services.** DFMC SBAS services are planned rather than operational: the FAA plans WAAS dual-frequency service from about 2026 (limited) to about 2028 (final), and EUSPA’s 2026 roadmap places the EGNOS v3 DFMC service in the early 2030s, later than Doc 9849 (2025) §4.3.4.5 says. Ask ESSP or EUSPA for the official V3.2 date. The hypothetical Indonesian SBAS offers DFMC; the ESSP-SAS scenario shows EGNOS v3 DFMC only as a labelled preview.',
  '**The ESSP-SAS scenario.** The AI check read the EGNOS SoL SDD v3.6, Service Notices 33–35, the Realtime page (5 October 2026) and ESSP’s 2024 EWA figures. Still to confirm with ESSP: current EWA and procedure counts (the page shows March 2024), whether the Haifa RIMS is back in operation, whether LPV-200 outages get NOTAM proposals of their own, and that the NLES list of the 2017 decision is still current.',
  '**RIMS in the model.** The ESSP-SAS ground segment computes its corrections from the 9 RIMS it shows, not EGNOS’s 38, so the "RIMS offline" failure has a far larger effect than it would in reality; the page says so. Check the wording.',
  '**GPS alone at Nice.** With 24 evenly spaced satellites, whether RAIM supports LNAV on an approach depends on where the constellation starts. The ESSP-SAS scenario starts it at 172° (`scenarios/essp/geos.ts`). Recomputed after the AI check (RAIM factors for a missed-detection probability of 10⁻³, the Annex 10 broadcast-model ionospheric σ, the 9 RIMS): of all 360 start positions, 315 give RAIM LNAV on the approach into Nice and 294 also give LPV-200 through EGNOS, LNAV under a storm and with RIMS offline, and DFMC LPV in a storm (288 before); 172° lies well inside the band 75°–229° where all pass, with a RAIM HPL of about 34 m on final against HAL 556 m. Confirm that showing LNAV with GPS alone is the representative case.',
  '**Nice LPV-200 at 200 ft.** The illustrative RNP RWY 04L approach is flown to LPV-200 minima with a 200 ft decision height over the Baie des Anges; the published procedure, its minima and its FAS data block are not used.',
]

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const refsText = (c: Claim) => c.refs.map((r) => `${SOURCES[r.source].publisher} ${shortTitle(r.source)}${r.section ? ` ${r.section}` : ''}`).join('; ')
const shortTitle = (id: keyof typeof SOURCES) => {
  const t = SOURCES[id].title
  const m = t.match(/(Doc \d+|DO-229|ED-259|Annex 10|SoL\) Service Definition Document|TR8350\.2|IS-GPS-200|2017\/1406|SPS PS|IGRF-14)/)
  return m ? m[1].replace('SoL) Service Definition Document', 'SoL SDD') : t.length > 60 ? `${t.slice(0, 57)}…` : t
}
const valueText = (c: Claim) => (c.value === undefined ? '' : `${Array.isArray(c.value) ? c.value.join(', ') : c.value}${c.unit ? ` ${c.unit}` : ''}`)
const scenarioText = (c: Claim) => (c.scenarios.length === 2 ? 'both' : c.scenarios[0] === 'essp' ? 'ESSP-SAS' : 'AirNav Indonesia')

function table(claims: readonly Claim[]): string {
  const rows = claims.map((c) => `| \`${c.id}\` | ${scenarioText(c)} | ${esc(c.text)}${c.note ? ` *${esc(c.note)}*` : ''} | ${esc(valueText(c))} | ${esc(refsText(c))} | ${c.code ? `\`${c.code}\`` : ''} |`)
  return ['| Claim | Scenario | What the page says | Value | Source | Code |', '|---|---|---|---|---|---|', ...rows].join('\n')
}

function aiTable(claims: readonly Claim[]): string {
  if (!claims.length) return 'None yet.'
  const rows = claims.map((c) => {
    const a = c.aiCheck!
    const read = a.checked.map((k) => `${k.source}${k.section ? ` ${k.section}` : ''}${k.read ? ' (read)' : ''}`).join('; ')
    return `| \`${c.id}\` | ${scenarioText(c)} | ${esc(c.text)} | ${esc(valueText(c))} | ${a.verdict} | ${esc(a.rationale)} | ${esc(read)} |`
  })
  return ['| Claim | Scenario | What the page says | Value | AI verdict | Why | Checked against |', '|---|---|---|---|---|---|---|', ...rows].join('\n')
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
\`TODO(expert-review)\` in the code belongs to a claim marked "to confirm" or "checked by AI";
every claim the narration cites exists; and this file must be regenerated when the registry
changes.

**About the AI check.** ${AI_MODEL}, prompted to act as a senior GNSS/SBAS integrity engineer,
checked every claim against its sources, reading the public documents it could reach
(\`src/content/claims/aiChecks.ts\`). Its verdicts and reasons are listed below. A claim counts as
checked by AI only when the model read at least one of its documents itself; where it could
read none, its view from memory is listed separately and the claim keeps its status. An AI
check is not a sign-off: it narrows what a qualified reviewer has to look at, and "Reviewed"
stays reserved for a named reviewer.

## Summary

| Status | Claims | Meaning |
|---|---|---|
| ${STATUS_LABEL.reviewed} | ${n.reviewed} | Confirmed by a named reviewer against the primary source |
| ${STATUS_LABEL['ai-checked']} | ${n['ai-checked']} | Checked by an AI model against the sources; a named reviewer still has to confirm it |
| ${STATUS_LABEL.sourced} | ${n.sourced} | Source and section identified; not yet signed off |
| ${STATUS_LABEL['to-confirm']} | ${n['to-confirm']} | Not yet traced to a primary source, or an illustrative value the page labels as such |

## To confirm

${byStatus('to-confirm').length ? table(byStatus('to-confirm')) : 'None.'}

## Sourced, awaiting review

${byStatus('sourced').length ? table(byStatus('sourced')) : 'None.'}

## Checked by AI, awaiting expert

${aiTable(byStatus('ai-checked'))}

## AI views from memory (no source read)

The model could read none of these claims' documents, so they keep their status above.

${aiTable(CLAIMS.filter((c) => c.aiCheck && c.status !== 'ai-checked'))}

## Reviewed

${n.reviewed ? table(byStatus('reviewed')) : 'None yet.'}

## Sources

| Document | Edition | Publisher | Used | Note |
|---|---|---|---|---|
${sources.join('\n')}

## Open questions for the reviewer

${OPEN_QUESTIONS.map((q) => `- ${q}`).join('\n')}

## Signing a claim off

A claim checked by AI still needs this step. Set the claim's \`status\` to \`'reviewed'\` and its \`review\` to \`{ by: '<name, role>', on: '<date>' }\`
in \`src/content/claims\`, correct the text, value or source if needed (the code must follow a
corrected value, or its test fails), remove the matching \`TODO(expert-review)\` from the code,
and run \`npm run claims\` to regenerate this file.
`
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export function renderClaimsCsv(): string {
  const head = ['id', 'topic', 'scenario', 'status', 'claim', 'value', 'sources', 'code', 'note', 'reviewed_by', 'reviewed_on', 'ai_verdict', 'ai_checked_on', 'ai_rationale']
  const rows = CLAIMS.map((c) =>
    [c.id, c.topic, scenarioText(c), c.status, c.text, valueText(c), refsText(c), c.code ?? '', c.note ?? '', c.review?.by ?? '', c.review?.on ?? '', c.aiCheck?.verdict ?? '', c.aiCheck?.on ?? '', c.aiCheck?.rationale ?? '']
      .map(csvCell)
      .join(','),
  )
  return [head.join(','), ...rows].join('\n') + '\n'
}
