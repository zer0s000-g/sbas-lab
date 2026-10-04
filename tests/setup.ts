// The 3D views' loaders fetch the scenario's terrain coastline before views/terrain is
// used (views/geo/scenarioCoast); tests that use the terrain directly need it too.
import { loadTerrainCoast } from '@/views/geo/scenarioCoast'

await loadTerrainCoast()
