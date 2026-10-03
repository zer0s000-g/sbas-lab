// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { inflateRawSync, crc32 } from 'node:zlib'
// @ts-expect-error: a plain .mjs build script, no type declarations
import { LAUNCH, manifest, zip } from '../../scripts/scorm/lib.mjs'

/** Read a ZIP archive back: every entry's name and contents, checking its CRC. */
function unzip(buf: Buffer): { name: string; data: Buffer }[] {
  const end = buf.length - 22
  expect(buf.readUInt32LE(end)).toBe(0x06054b50)
  const count = buf.readUInt16LE(end + 10)
  let p = buf.readUInt32LE(end + 16)
  const out: { name: string; data: Buffer }[] = []
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50)
    const method = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16)
    const size = buf.readUInt32LE(p + 20)
    const raw = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    expect(buf.readUInt32LE(local)).toBe(0x04034b50)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const body = buf.subarray(start, start + size)
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body)
    expect(data.length).toBe(raw)
    expect(crc32(data) >>> 0).toBe(crc)
    out.push({ name, data })
    p += 46 + nameLen
  }
  return out
}

describe('the SCORM package', () => {
  it('writes a well-formed SCORM 1.2 manifest that launches the ESSP-SAS scenario', () => {
    const xml: string = manifest({ title: 'SBAS Lab & EGNOS', files: ['index.html', 'assets/a.js'] })
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    expect(doc.getElementsByTagName('schemaversion')[0].textContent).toBe('1.2')
    const res = doc.getElementsByTagName('resource')[0]
    expect(res.getAttribute('href')).toBe(LAUNCH)
    expect(LAUNCH).toBe('index.html?scenario=essp&lms=scorm')
    expect(res.getAttribute('adlcp:scormtype')).toBe('sco')
    expect([...doc.getElementsByTagName('file')].map((f) => f.getAttribute('href'))).toEqual(['index.html', 'assets/a.js'])
    expect(doc.getElementsByTagName('adlcp:masteryscore')[0].textContent).toBe('80')
    expect(doc.getElementsByTagName('title')[0].textContent).toBe('SBAS Lab & EGNOS')
  })
  it('zips and reads back every entry, stored or deflated, byte for byte', () => {
    const entries = [
      { name: 'imsmanifest.xml', data: Buffer.from('<manifest/>'.repeat(50)) },
      { name: 'assets/random.bin', data: Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 73) % 256)) },
      { name: 'empty.txt', data: Buffer.alloc(0) },
      { name: 'café/ü.txt', data: Buffer.from('unicode names') },
    ]
    const back = unzip(zip(entries))
    expect(back.map((e) => e.name)).toEqual(entries.map((e) => e.name))
    back.forEach((e, i) => expect(e.data.equals(entries[i].data)).toBe(true))
  })
  it('is reproducible: the same files give the same bytes', () => {
    const entries = [{ name: 'a.txt', data: Buffer.from('same') }]
    expect(zip(entries).equals(zip(entries))).toBe(true)
  })
})
