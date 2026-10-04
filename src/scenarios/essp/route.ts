/**
 * LAB201 from Toulouse-Blagnac (LFBO) to Nice Côte d'Azur (LFMN). The route is
 * simplified: its waypoints are illustrative, not a published SID, airway or STAR. It
 * departs runway 14L to the south-east, climbs over the Lauragais to FL330 near Béziers,
 * cruises over the Gulf of Lion, descends south of Marseille and Toulon, and joins a
 * straight-in final to runway 04L at Nice over the Baie des Anges.
 */
import type { RouteHelpers, Waypoint } from '@/core/flight'

export function route({ D, A, NM, onRunway, at, sd, glidePathAltFt }: RouteHelpers): Waypoint[] {
  return [
    // Toulouse: push back from the stand east of runway 14L, taxi along the parallel taxiway, line up on 14L.
    onRunway(D, 'GATE-D', 1500, sd(D, 410), D.elevationFt, 0, 'taxi-out'),
    onRunway(D, 'TWY-A', -185, sd(D, 410), D.elevationFt, 15, 'taxi-out'),
    onRunway(D, 'HOLD', -185, sd(D, 74), D.elevationFt, 12, 'taxi-out'),
    onRunway(D, 'LINEUP', 0, 0, D.elevationFt, 8, 'lineup'),
    onRunway(D, 'ROTATE', 1.25 * NM, 0, D.elevationFt, 155, 'takeoff'),
    // Climb out to the south-east, then east toward the Mediterranean.
    onRunway(D, 'DEP1', 8 * NM, 0, 4000, 210, 'air'),
    at('CLIMB', 43.33, 2.2, 18000, 300),
    at('TOC', 43.25, 3.1, 33000, 450),
    at('CRZ', 43.1, 4.0, 33000, 460),
    at('TOD', 43.05, 4.95, 33000, 460),
    // Descend over the sea south of Marseille and Toulon, then join final over the Baie des Anges.
    at('ARR1', 43.1, 6.75, 7000, 280),
    onRunway(A, 'IF', -10 * NM, 0, 3200, 180, 'air'),
    onRunway(A, 'FAF', -5 * NM, 0, Math.round(glidePathAltFt(5)), 145, 'final'),
    onRunway(A, 'THR', 0, 0, Math.round(glidePathAltFt(0)), 140, 'final'),
    onRunway(A, 'TDZ', 370, 0, A.elevationFt, 135, 'landing'),
    // Nice: roll out, vacate to the north-west and taxi to the stand at the terminal.
    onRunway(A, 'EXIT', 1850, 0, A.elevationFt, 20, 'landing'),
    onRunway(A, 'TWY-B', 2035, sd(A, 370), A.elevationFt, 15, 'taxi-in'),
    onRunway(A, 'GATE-A', 1300, sd(A, 556), A.elevationFt, 0, 'taxi-in'),
  ]
}
