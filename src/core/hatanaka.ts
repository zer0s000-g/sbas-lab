/**
 * Compact RINEX 3 (Hatanaka) to RINEX 3 observation text, as the IGS and EUREF data
 * centres distribute daily files (`*.crx`). Pure; reads the text, writes the text.
 *
 * The format (Hatanaka, 2008, "A compression format and tools for GNSS observation
 * data", Bull. GSI 55): the header is copied as is; each epoch line is either a full
 * line starting with ">" or a character difference against the previous one (a space
 * keeps the old character, "&" writes a space); the epoch line carries the satellite
 * list from column 41. Each observation is an integer in thousandths, sent as an n-th
 * order difference ("n&value" restarts an arc of order n), and the LLI/SSI flags are a
 * character difference against the satellite's previous flags.
 */

interface Arc {
  order: number
  /** u[0] is the value; u[k] its k-th difference, in thousandths. */
  u: number[]
}

interface SatState {
  arcs: (Arc | null)[]
  flags: string
}

/** Applies a CRINEX character difference to the previous line. */
export function applyTextDiff(prev: string, diff: string): string {
  const out = prev.split('')
  for (let i = 0; i < diff.length; i++) {
    const ch = diff[i]
    if (ch === ' ') {
      if (i >= out.length) out[i] = ' '
    } else if (ch === '&') out[i] = ' '
    else out[i] = ch
  }
  return out.join('').replace(/\s+$/, '')
}

/** The observation types of each system, from the RINEX 3 header. */
export function obsTypes(header: readonly string[]): Map<string, string[]> {
  const types = new Map<string, string[]>()
  let cur: string | null = null
  let want = 0
  for (const line of header) {
    if (line.slice(60).trim() !== 'SYS / # / OBS TYPES') continue
    if (line[0] !== ' ') {
      cur = line[0]
      want = Number(line.slice(3, 6))
      types.set(cur, [])
    }
    if (!cur) continue
    const list = types.get(cur)!
    for (let k = 0; k < 13 && list.length < want; k++) {
      const t = line.slice(7 + 4 * k, 10 + 4 * k).trim()
      if (t) list.push(t)
    }
  }
  return types
}

const fmtValue = (thousandths: number) => {
  const s = (thousandths / 1000).toFixed(3)
  return s.length > 14 ? s.slice(-14) : s.padStart(14)
}

/**
 * Decompresses a compact RINEX 3 file. Throws on a file that is not CRINEX 3, and on a
 * data line that does not fit the header's observation types (a corrupt file).
 */
export function crxToRinex(crx: string): string {
  const lines = crx.split(/\r?\n/)
  if (!/COMPACT RINEX FORMAT/.test(lines[0] ?? '') || !lines[0].trimStart().startsWith('3')) throw new Error('not a compact RINEX 3 file')
  let i = 2
  const header: string[] = []
  while (i < lines.length) {
    const l = lines[i++]
    header.push(l)
    if (l.slice(60).trim() === 'END OF HEADER') break
  }
  const types = obsTypes(header)
  const out: string[] = [...header]
  const sats = new Map<string, SatState>()
  let epoch = ''
  while (i < lines.length) {
    const raw = lines[i++]
    if (raw === '' && i >= lines.length) break
    if (raw.startsWith('>')) {
      epoch = raw
    } else if (raw.startsWith('&')) {
      // A special event in an initialised line ("&" in column 1 stands for ">").
      epoch = '>' + raw.slice(1)
    } else {
      epoch = applyTextDiff(epoch, raw)
    }
    // Clock offset line (receiver clock; kept blank in the output when absent).
    i++ // the receiver clock offset line (not used: the output leaves it blank)
    const flag = Number(epoch.slice(31, 32))
    const n = Number(epoch.slice(32, 35))
    if (flag > 1) {
      // Event: the next n lines are header records, copied as they are.
      out.push(epoch.slice(0, 41).trimEnd())
      i-- // no clock line for events
      for (let k = 0; k < n; k++) out.push(lines[i++] ?? '')
      continue
    }
    const list: string[] = []
    for (let k = 0; k < n; k++) list.push(epoch.slice(41 + 3 * k, 44 + 3 * k))
    out.push(epoch.slice(0, 35))
    const fresh = new Map<string, SatState>()
    for (const sat of list) {
      const ty = types.get(sat[0])
      if (!ty) throw new Error(`no observation types for system ${sat[0]}`)
      const line = lines[i++] ?? ''
      const prev = sats.get(sat)
      const st: SatState = prev ?? { arcs: ty.map(() => null), flags: '' }
      // Fields: one per observation type, separated by single spaces; the rest is the flags diff.
      let pos = 0
      const cells: string[] = []
      for (let k = 0; k < ty.length; k++) {
        const sp = line.indexOf(' ', pos)
        if (sp < 0) {
          cells.push(line.slice(pos))
          pos = line.length + 1
          for (let r = k + 1; r < ty.length; r++) cells.push('')
          break
        }
        cells.push(line.slice(pos, sp))
        pos = sp + 1
      }
      const flagDiff = pos <= line.length ? line.slice(pos) : ''
      st.flags = applyTextDiff(st.flags, flagDiff)
      let rec = sat
      for (let k = 0; k < ty.length; k++) {
        const c = cells[k] ?? ''
        if (c === '') {
          st.arcs[k] = null
        } else {
          const amp = c.indexOf('&')
          if (amp >= 0) {
            st.arcs[k] = { order: Number(c.slice(0, amp)), u: [Number(c.slice(amp + 1))] }
          } else {
            const arc = st.arcs[k]
            if (!arc) throw new Error(`difference without an arc start (${sat}, ${ty[k]})`)
            const d = Number(c)
            if (arc.u.length - 1 < arc.order) arc.u.push(d)
            else arc.u[arc.order] = d
            for (let j = arc.u.length - 1; j > 0; j--) arc.u[j - 1] += arc.u[j]
          }
        }
        const arc = st.arcs[k]
        const lli = st.flags[2 * k] ?? ' '
        const ssi = st.flags[2 * k + 1] ?? ' '
        rec += arc ? fmtValue(arc.u[0]) + lli + ssi : ' '.repeat(16)
      }
      out.push(rec.trimEnd())
      fresh.set(sat, st)
    }
    // A satellite missing from an epoch restarts all its arcs when it comes back.
    sats.clear()
    for (const [k, v] of fresh) sats.set(k, v)
  }
  return out.join('\n') + '\n'
}
