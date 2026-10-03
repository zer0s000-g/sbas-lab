/**
 * LAB201 from Jakarta (WIII) to Bali (WADD). The route is simplified: its waypoints are
 * illustrative, not a published airway, departure or arrival procedure. It climbs out
 * over the Java Sea, cruises at FL330 along the north coast of Java, descends across
 * East Java and joins a straight-in final to runway 09 at Bali over the sea.
 */
import type { RouteHelpers, Waypoint } from '@/core/flight'

export function route({ D, A, NM, onRunway, at, sd, glidePathAltFt }: RouteHelpers): Waypoint[] {
  return [
    // Jakarta: push back from the stand, taxi along the parallel taxiway, line up on 07R.
    onRunway(D, 'GATE-D', 1300, sd(D, 410), D.elevationFt, 0, 'taxi-out'),
    onRunway(D, 'TWY-A', -185, sd(D, 410), D.elevationFt, 15, 'taxi-out'),
    onRunway(D, 'HOLD', -185, sd(D, 74), D.elevationFt, 12, 'taxi-out'),
    onRunway(D, 'LINEUP', 0, 0, D.elevationFt, 8, 'lineup'),
    onRunway(D, 'ROTATE', 1.25 * NM, 0, D.elevationFt, 155, 'takeoff'),
    // Climb out over the Java Sea and turn east along the coast.
    onRunway(D, 'DEP1', 8 * NM, 0, 3000, 210, 'air'),
    at('CLIMB', -5.85, 107.5, 18000, 300),
    at('TOC', -6.0, 108.6, 33000, 450),
    at('CRZ', -6.35, 110.5, 33000, 460),
    at('TOD', -7.65, 113.35, 33000, 460),
    // Descend across East Java and the Bali Strait, then join final over the sea.
    at('ARR1', -8.55, 114.55, 7000, 280),
    onRunway(A, 'IF', -10 * NM, 0, 3200, 180, 'air'),
    onRunway(A, 'FAF', -5 * NM, 0, Math.round(glidePathAltFt(5)), 145, 'final'),
    onRunway(A, 'THR', 0, 0, Math.round(glidePathAltFt(0)), 140, 'final'),
    onRunway(A, 'TDZ', 370, 0, A.elevationFt, 135, 'landing'),
    // Bali: roll out, vacate to the north and taxi to the stand at the terminal.
    onRunway(A, 'EXIT', 2037, 0, A.elevationFt, 20, 'landing'),
    onRunway(A, 'TWY-B', 2222, sd(A, 370), A.elevationFt, 15, 'taxi-in'),
    onRunway(A, 'GATE-A', 1481, sd(A, 556), A.elevationFt, 0, 'taxi-in'),
  ]
}
