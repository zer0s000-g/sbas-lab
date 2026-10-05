/**
 * The module's learning objectives (src/scenarios/essp/questions.ts) mapped to formal
 * training curricula and guidance: EU ATSEP and ATCO training (Part-PERS, Part ATCO), the
 * EU rule on GNSS status information for ATS, and ICAO's PBN and GNSS manuals. Researched
 * from the documents themselves (October 2026; each framework says which edition). A
 * proposed mapping, not approved by any authority: a training organisation confirms it
 * against its own syllabus (claim training.curricula).
 */

export interface Framework {
  id: string
  /** Short name for tables. */
  short: string
  name: string
  instrument: string
  edition: string
}

export interface CurriculumLink {
  objective: string
  framework: string
  /** The item as the source numbers it. */
  item: string
  /** What the item asks, in short. */
  itemText: string
  fit: 'full' | 'partial'
}

export const FRAMEWORKS: readonly Framework[] = [
  { id: "easa-atsep", short: "ATSEP (EU 2017/373, Part-PERS)", name: "ATSEP training: basic and qualification training (Part-PERS, Subpart A)", instrument: "Commission Implementing Regulation (EU) 2017/373, Annex XIII (Part-PERS), Appendices 1-4; detailed objectives in AMC Appendices 2a and 4a (ED Decision 2020/020/R)", edition: "EUR-Lex 2017/373 text (converted 2024-12-08) and EASA Easy Access Rules for ATM/ANS, revision March 2025" },
  { id: "easa-atco", short: "ATCO (EU 2015/340)", name: "ATCO initial training: basic and rating training", instrument: "Commission Regulation (EU) 2015/340, Annex I (Part ATCO), Appendices 2-8 (subjects/topics/subtopics); objectives in AMC1 ATCO.D.010(a)(1) (basic) and AMC1 ATCO.D.010(a)(2)(iii)/(v) (APP/APS), ED Decision 2023/011/R, applicable from 4 August 2024", edition: "EASA Easy Access Rules for ATCO Licensing and Certification, revision March 2024 (correction June 2024); incorporates Regulation (EU) 2023/893" },
  { id: "easa-ats-or", short: "EU 2017/373 ATS.OR.525(b)", name: "Information on the operational status of navigation services (GNSS)", instrument: "Regulation (EU) 2017/373, Annex IV (Part-ATS), ATS.OR.525(b); AMC1 and GM1 ATS.OR.525(b) (ED Decision 2020/008/R)", edition: "EASA Easy Access Rules for ATM/ANS, revision March 2025" },
  { id: "icao-9613", short: "ICAO Doc 9613 (PBN), 2023", name: "ICAO Performance-based Navigation (PBN) Manual", instrument: "ICAO Doc 9613", edition: "Fifth Edition, 2023" },
  { id: "icao-9849", short: "ICAO Doc 9849 (GNSS), 3rd ed.", name: "ICAO Global Navigation Satellite System (GNSS) Manual", instrument: "ICAO Doc 9849", edition: "Third Edition, 2017" },
  { id: "icao-apac-sbas", short: "ICAO APAC SBAS guidance", name: "Guidance Document for Implementation of SBAS in the Asia/Pacific Region", instrument: "ICAO APAC regional guidance (GBAS/SBAS ITF)", edition: "Edition/date not stated in the extracted text; local copy" },
  { id: "essp-lpv-guide", short: "ESSP LPV implementation guidelines, 2015", name: "Guidelines for ANSP/Airports and Aircraft Operators for LPV implementation", instrument: "ESSP SAS guidance under the EGNOS Service Provision Contract with the GSA", edition: "Released September 2015" },
]

export const CURRICULUM_LINKS: readonly CurriculumLink[] = [
  { objective: "obj.principle", framework: "easa-atsep", item: "Appendix 2a (basic, streams), Subject 6 NAVIGATION: ATSEP.BAS.NAV_4.3.1 (Space-based Navigation Systems)", itemText: "Explain the basic working principles of satellite positioning (level 2; GNSS e.g. Galileo, GPS)", fit: "full" },
  { objective: "obj.principle", framework: "easa-atsep", item: "Appendix 2a, ATSEP.BAS.NAV_4.3.5", itemText: "State the current limitations of space-based navigation systems (single frequency, weak signal, ionospheric delay, multipath)", fit: "full" },
  { objective: "obj.principle", framework: "easa-atsep", item: "Appendix 2a, ATSEP.BAS.NAV_4.3.6", itemText: "Describe the basic working principles of satellite augmentation (ABAS, SBAS, GBAS)", fit: "partial" },
  { objective: "obj.principle", framework: "easa-atco", item: "Appendix 2 (Basic), SUBJECT 5 NAVIGATION, Subtopic NAVB 5.3 Satellite-based systems: objective BASIC NAVB 5.3.1", itemText: "Explain the basic working principles of a satellite positioning system (level 2)", fit: "full" },
  { objective: "obj.principle", framework: "easa-atco", item: "Subtopic NAVB 5.3: BASIC NAVB 5.3.3", itemText: "Explain the limitations of satellite-based systems (GPS, Galileo; optional: integrity, GPS NOTAMs)", fit: "partial" },
  { objective: "obj.principle", framework: "icao-9849", item: "Chapter 4, 4.3.1 SBAS system architecture and operation, para 4.3.1.1", itemText: "SBAS computes clock/ephemeris corrections and ionospheric grid corrections, bounded by UDRE and GIVE", fit: "full" },
  { objective: "obj.architecture", framework: "icao-9849", item: "Chapter 4, 4.3.1, paras 4.3.1.1-4.3.1.2", itemText: "Reference stations feed master stations; uplink stations send messages to GEOs broadcasting on L1", fit: "full" },
  { objective: "obj.architecture", framework: "easa-atsep", item: "Appendix 4a (qualification, NAV streams), Subject 3 GNSS, Topic 1, Sub-topic 1.1 General View: ATSEP.QLF.NAV.GNS_1.1.2", itemText: "Describe the elements of GNSS within Europe (core systems; augmentations e.g. EGNOS, WAAS)", fit: "partial" },
  { objective: "obj.architecture", framework: "easa-atsep", item: "Appendix 2a, ATSEP.BAS.NAV_4.3.7", itemText: "State the current implementations of satellite-based navigation systems (core systems; RAIM, AAIM, EGNOS, WAAS, GBAS)", fit: "partial" },
  { objective: "obj.architecture", framework: "easa-atco", item: "Subtopic NAVB 5.3: BASIC NAVB 5.3.2", itemText: "State the basic principles of GNSS concept (Basic, ABAS, SBAS, GBAS)", fit: "partial" },
  { objective: "obj.integrity", framework: "icao-9849", item: "Chapter 2, 2.2.2 Integrity and time-to-alert, para 2.2.2.2", itemText: "Avionics compute protection levels; when one exceeds its alert limit the avionics must alert", fit: "full" },
  { objective: "obj.integrity", framework: "icao-9613", item: "Vol II, Part C, Ch 5 Section B, 5.3.3.1.2 On-board performance monitoring and alerting", itemText: "After FAP: 6 s alert, NSE 40 m; vertical 50 m (LPV 250 ft), 35 m (LPV 200 ft)", fit: "full" },
  { objective: "obj.integrity", framework: "icao-9613", item: "Vol II, Part C, Ch 5 Section B, 5.2.7 Controller training, 5.2.7.2 Core training a)2) and a)3)", itemText: "Accuracy, integrity, availability, continuity incl. on-board monitoring and alerting; GNSS/SBAS receivers, RAIM, FDE, integrity alerts", fit: "partial" },
  { objective: "obj.integrity", framework: "easa-atsep", item: "Appendix 4a, Subject 1 PBN, Topic 1 Navigation Concepts: ATSEP.QLF.NAV.PBN_1.1.1", itemText: "Explain the main performance characteristics of a navigation system (accuracy, integrity, availability, continuity...)", fit: "partial" },
  { objective: "obj.integrity", framework: "easa-atco", item: "Appendix 2, Subtopic NAVB 6.2 Introduction to PBN: BASIC NAVB 6.2.2", itemText: "Differentiate between RNAV and RNP (on-board performance monitoring and alerting)", fit: "partial" },
  { objective: "obj.operations", framework: "easa-atco", item: "Appendix 5/7 (APP/APS ratings), SUBJECT 5 NAVIGATION, Subtopic NAV 2.5 Satellite-based systems: APP NAV 2.5.1 / APS NAV 2.5.1", itemText: "State the different applications of satellite-based systems relevant for approach operations (RNP APCH, SBAS; optional LPV)", fit: "full" },
  { objective: "obj.operations", framework: "easa-atco", item: "APP/APS Subtopic NAV 2.3 Instrument departures and arrivals: NAV 2.3.3", itemText: "Describe the relevant minima for precision/non-precision approach (optional LNAV, LNAV/VNAV, LPV)", fit: "partial" },
  { objective: "obj.operations", framework: "icao-9613", item: "Vol II, Part C, Ch 5 Section B, 5.2.6.5 and 5.2.7.2 a)5)-6)", itemText: "FAS defined by FAS DB protected by CRC; controller core training includes FAS DB and geometric vs barometric slopes", fit: "partial" },
  { objective: "obj.operations", framework: "icao-9613", item: "Vol II, Part C, Ch 5 Section B, 5.3.5 Pilot knowledge and training, b)3)ii) and b)7)vii)", itemText: "SBAS characteristics; consideration of the SBAS approach mode indication (LP, LPV, LNAV/VNAV)", fit: "partial" },
  { objective: "obj.operations", framework: "icao-9849", item: "Chapter 4, 4.3.3 SBAS operations, para 4.3.3.2", itemText: "FAS data block defines HAL/VAL; RNAV(GNSS) charts with LPV, LNAV/VNAV, LNAV, circling minima", fit: "full" },
  { objective: "obj.provision", framework: "easa-ats-or", item: "AMC1 ATS.OR.525(b) and GM1 ATS.OR.525(b), 'Provision of information with respect to GNSS'", itemText: "ATS provider should establish formal arrangements with ESSP; ESSP certified and overseen by EASA", fit: "full" },
  { objective: "obj.provision", framework: "icao-9613", item: "Vol II, Part A, Ch 4 Navigation service monitoring, 4.2.2 and 4.3.1.4.2.2", itemText: "Agreements between SBAS signal provider and ANSP; advisory predictive GNSS availability NOTAMs to users and ATC", fit: "full" },
  { objective: "obj.provision", framework: "icao-9849", item: "Chapter 7, 7.11 GNSS service status notification (7.11.4 'SBAS UNAVAILABLE' NOTAM)", itemText: "NOTAM types for core-constellation, interference and SBAS outages", fit: "partial" },
  { objective: "obj.provision", framework: "easa-atsep", item: "Appendix 4a, Subject 3 GNSS, Sub-topic 1.1: ATSEP.QLF.NAV.GNS_1.1.4 and GNS_1.1.6", itemText: "Explain who has GNSS oversight in your State (EASA, GSA, NSA, ANSP); describe the purpose of the GNSS NOTAM", fit: "partial" },
  { objective: "obj.provision", framework: "easa-atsep", item: "Appendix 3a (qualification, shared), Functional Safety: ATSEP.QLF.SHR.FST_2.1.2", itemText: "Explain the need for NOTAMs (e.g. for PBN and GNSS status)", fit: "partial" },
  { objective: "obj.provision", framework: "icao-9613", item: "Vol II, Part C, Ch 5 Section B, 5.3.4.3 SBAS availability", itemText: "LPV availability verified via SBAS NOTAMs or prediction services, possibly provided by the ANSP", fit: "partial" },
  { objective: "obj.provision", framework: "essp-lpv-guide", item: "Section 5.4 EGNOS Working Agreement (EWA) with the ESSP", itemText: "ANSPs first sign an EWA with ESSP, the EGNOS service provider; free bilateral arrangement", fit: "full" },
  { objective: "obj.threats", framework: "icao-9849", item: "Chapter 5 GNSS Vulnerability, 5.5 Effects of the ionosphere and solar activity, para 5.5.5", itemText: "Severe ionospheric storms may infrequently cause SBAS APV outages in mid-latitudes", fit: "full" },
  { objective: "obj.threats", framework: "icao-9849", item: "Appendix F (GNSS RFI Mitigation Plan), paras 5.3.3.4.1-5.3.3.4.2", itemText: "Alternate navigation and ATC vectoring; train airspace users and ATCOs to recognise GNSS anomalies and react", fit: "partial" },
  { objective: "obj.threats", framework: "icao-9613", item: "Vol II, Part C, Ch 5 Section B, 5.3.4.3.4 and 5.3.4.7.2", itemText: "Wide-area loss of GNSS/SBAS needs ANSP contingency procedures; pilot notifies ATC of loss of LPV/SBAS", fit: "full" },
  { objective: "obj.threats", framework: "icao-9613", item: "Vol II, Part A, Ch 4, 4.3.1.5", itemText: "Airspace users notify ATC of interference; ATC should consider informing others (ATIS, NOTAM)", fit: "full" },
  { objective: "obj.threats", framework: "easa-atsep", item: "Appendix 4a, Subject 3 GNSS, Sub-topic 1.1: ATSEP.QLF.NAV.GNS_1.1.3", itemText: "Appreciate the sources of interference to GNSS signals (ionospheric, solar, jamming, spoofing) (level 3)", fit: "partial" },
  { objective: "obj.threats", framework: "easa-atco", item: "APP/APS Subtopic NAV 2.1 Navigational systems: NAV 2.1.1 and NAV 2.1.2", itemText: "Manage traffic (level 4) / appreciate the effect (level 3) of a change in operational status of navigational systems", fit: "partial" },
  { objective: "obj.threats", framework: "easa-atco", item: "APP rating, SUBJECT 8 EQUIPMENT AND SYSTEMS, Subtopic EQPS 5.3 Navigational equipment degradation: APP EQPS 5.3.1-5.3.2", itemText: "Identify when a navigational equipment failure affects operations; apply contingency procedures", fit: "partial" },
]

/** What the mapping found the module does not cover yet. */
export const CURRICULUM_GAPS: readonly string[] = [
  "Level of learning: most mapped ATCO and ATSEP objectives at level 1-2 are fully supported, but APP/APS NAV 2.1.1 (level 4, manage traffic), EQPS 5.3.2 (level 3, apply contingency procedures) and ATSEP.QLF.NAV.GNS_1.1.3 (level 3, appreciate) need practical or analysis exercises. The 12 recall questions do not assess them; scenario-based items (e.g. 'GEO lost with three aircraft on final: what do you tell them?') would help.",
  "Doc 9613 Vol II Part C Ch 5 Sect B 5.2.7.2 c) / 5.2.7.3 controller items: the Controller’s view now practises phraseology for GNSS and SBAS outages and mixed equipage; separation minima, flight plan requirements, vectoring to the final approach segment, T/Y approaches and re-routing during a procedure are not covered.",
  "ABAS/RAIM/FDE and GBAS (Doc 9613 5.2.7.2 a)3); ATCO NAVB 5.3.2; ATSEP.BAS.NAV_4.3.6) are not taught. A short 'SBAS vs RAIM vs GBAS' comparison would close this.",
  "ATSEP-specific content not covered: GNSS frequency bands (ATSEP.BAS.NAV_4.3.3), GNSS modernisation and the ARNS bands L5/E5a/E5b (ATSEP.QLF.NAV.GNS_1.1.5; the module has only a DFMC preview), GNSS development policy (GNS_1.1.1: ICAO Doc 9849, ATM Master Plan, EU navigation strategy), national oversight (GNS_1.1.4). Part-PERS has no SBAS maintenance or system/equipment rating content, which ATSEP rating training sets per service provider (ATSEP.OR.215).",
  "Departure alert limit (q.departure) and LPV-200 versus APV-I values come from ICAO Annex 10 Vol I (a specification, not a curriculum). No EU syllabus item names departure GNSS performance explicitly.",
  "obj.provision has no direct item in any EU training syllabus. It rests on the regulatory text (ATS.OR.525(b) AMC/GM) and ICAO guidance; ESSP-specific items (service notices, NOTAM proposal service) are provider practice, not curriculum.",
  "Not read or verified: ICAO PANS-TRG (Doc 9868), ICAO Doc 10056/10057 (ATCO/ATSEP CBTA) and Doc 7192 Part E-2; EUROCONTROL course syllabi and the EUROCONTROL ATSEP common core specification; EASA AMC 20-28 status, CS-ACNS and Part-FCL/Air-Ops PBN training; Regulation (EU) 2018/1048 (PBN IR, cited as optional content in ATCO NAVB 6.3.1). ATCO EAR checked at revision March 2024; ATM/ANS EAR at revision March 2025. Later amendments not checked.",
  "Pilot-side training (Doc 9613 5.3.5 a)-b), e.g. selecting LPV minima, VTF, temperature compensation, R/T phraseology) is only partly relevant; the module targets ANSP staff, so pilot training items are mapped only where they overlap.",
]

/** The mapping as CSV (one row per link), for a training organisation's records. */
export function curriculaCsv(objectives: readonly { id: string; text: string }[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const head = ['objective_id', 'objective', 'framework', 'item', 'item_text', 'fit']
  const rows = CURRICULUM_LINKS.map((l) => [l.objective, objectives.find((o) => o.id === l.objective)?.text ?? '', FRAMEWORKS.find((f) => f.id === l.framework)?.short ?? l.framework, l.item, l.itemText, l.fit].map(cell).join(','))
  return [head.join(','), ...rows].join('\n') + '\n'
}
