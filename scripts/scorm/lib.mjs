// The SCORM package's parts, kept free of the build so tests can check them:
// a SCORM 1.2 manifest for the ESSP-SAS scenario, and a small ZIP writer (stored or
// deflated entries, CRC-32) with no dependencies.
import { crc32, deflateRawSync } from 'node:zlib'

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The page an LMS launches: the ESSP-SAS scenario, told it runs inside an LMS. */
export const LAUNCH = 'index.html?scenario=essp&lms=scorm'

/**
 * A SCORM 1.2 manifest (IMS content packaging 1.1.2 with the ADL 1.2 extensions): one
 * organisation, one item, one SCO resource listing every file of the site. The mastery
 * score matches the page's pass mark (80 %).
 */
export function manifest({ title, files, masteryScore = 80 }) {
  const fileList = files.map((f) => `      <file href="${xmlEscape(f)}"/>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="sbas-lab-essp-sas" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="sbas-lab-org">
    <organization identifier="sbas-lab-org">
      <title>${xmlEscape(title)}</title>
      <item identifier="sbas-lab-item" identifierref="sbas-lab-sco">
        <title>${xmlEscape(title)}</title>
        <adlcp:masteryscore>${masteryScore}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="sbas-lab-sco" type="webcontent" adlcp:scormtype="sco" href="${xmlEscape(LAUNCH)}">
${fileList}
    </resource>
  </resources>
</manifest>
`
}

/** DOS date and time of a JS date (ZIP stores local time to 2 s). */
function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/**
 * A ZIP archive of `entries` ({ name, data: Buffer }). Each entry is deflated when that
 * makes it smaller, else stored. `date` fixes the timestamps so a build is reproducible.
 */
export function zip(entries, date = new Date(2026, 0, 1)) {
  const { time, date: day } = dosTime(date)
  const locals = []
  const centrals = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data) >>> 0
    const deflated = deflateRawSync(data, { level: 9 })
    const useDeflate = deflated.length < data.length
    const body = useDeflate ? deflated : data
    const method = useDeflate ? 8 : 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBuf, body)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(day, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + body.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, end])
}
