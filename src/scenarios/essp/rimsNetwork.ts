/**
 * The EGNOS RIMS sites ESSP names in its monthly performance report (August 2026,
 * Table 7), at city level: the reference network the service-area maps model their
 * corrections with. The full network has 38 RIMS (SoL SDD v3.6 §3.3.2.1); six are not
 * named there and are left out. Positions are city centres, not the stations'
 * surveyed positions (claim `servicemap.rims-network`).
 */
import type { Geodetic } from '@/core/geo'

export interface RimsSite extends Geodetic {
  id: string
  name: string
}

const site = (id: string, name: string, latDeg: number, lonDeg: number): RimsSite => ({ id, name, latDeg, lonDeg, hM: 0 })

export const EGNOS_RIMS: readonly RimsSite[] = [
  site('ACR', 'Azores', 37.74, -25.67),
  site('ALB', 'Aalborg', 57.05, 9.92),
  site('AGA', 'Agadir', 30.42, -9.6),
  site('ATH', 'Athens', 37.98, 23.73),
  site('BRN', 'Berlin', 52.52, 13.4),
  site('CNR', 'Canary Islands', 27.93, -15.39),
  site('CRK', 'Cork', 51.9, -8.47),
  site('CTN', 'Catania', 37.5, 15.09),
  site('DJA', 'Djerba', 33.81, 10.85),
  site('EGI', 'Egilsstaðir', 65.27, -14.4),
  site('GLG', 'Glasgow', 55.86, -4.25),
  site('GOL', 'Gölbaşı', 39.79, 32.81),
  site('GVL', 'Gävle', 60.67, 17.14),
  site('JME', 'Jan Mayen', 70.94, -8.67),
  site('KIR', 'Kirkenes', 69.73, 30.05),
  site('KUU', 'Kuusamo', 65.96, 29.19),
  site('LAP', 'Lappeenranta', 61.06, 28.19),
  site('LPI', 'La Palma', 28.68, -17.76),
  site('LSB', 'Lisbon', 38.72, -9.14),
  site('MAD', 'Madeira', 32.65, -16.91),
  site('MLG', 'Málaga', 36.72, -4.42),
  site('PDM', 'Palma de Mallorca', 39.57, 2.65),
  site('RKK', 'Reykjavík', 64.15, -21.94),
  site('ROM', 'Rome', 41.9, 12.5),
  site('SDC', 'Santiago de Compostela', 42.88, -8.54),
  site('SOF', 'Sofia', 42.7, 23.32),
  site('SWA', 'Swanwick', 50.88, -1.28),
  site('TLS', 'Toulouse', 43.6, 1.44),
  site('TRD', 'Trondheim', 63.43, 10.4),
  site('TRO', 'Tromsø', 69.65, 18.96),
  site('WRS', 'Warsaw', 52.23, 21.01),
  site('ZUR', 'Zurich', 47.38, 8.54),
]
