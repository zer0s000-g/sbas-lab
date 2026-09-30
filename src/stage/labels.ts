import { createContext, type RefObject } from 'react'

/** The stage's DOM layer for 3D labels (Callout3D uses it unless given a portal). */
export const StageLabelsContext = createContext<RefObject<HTMLElement> | null>(null)
