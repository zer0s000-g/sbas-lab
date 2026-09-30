import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { toThreeStyle } from '@/lib/color'

/** three.js colour for a design token: `col(t, 'stage-signal')`. The only way scene code gets a colour. */
export const col = (t: ThemeTokens, name: keyof ThemeTokens) => new THREE.Color(toThreeStyle(String(t[name])))
