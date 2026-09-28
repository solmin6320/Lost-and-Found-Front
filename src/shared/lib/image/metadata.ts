import type { ImageFormat } from './format'

/** 파일에서 읽은 바이트. `Blob` 으로 다시 싸려면 `ArrayBuffer` 위의 배열이어야 한다 */
type Bytes = Uint8Array<ArrayBuffer>

/**
 * 사진 파일에서 **메타데이터만** 걷어 낸다. 그림 데이터는 한 바이트도 바꾸지 않는다(다시 인코딩하지 않는다).
 *
 * 올린 사진은 상세 화면에서 누구에게나 내려간다. 휴대폰 사진의 EXIF 에는 **찍은 곳의 GPS 좌표** · 기기 · 시각이 있다.
 * 분실물 글이면 집 · 직장 위치가 그대로 새어 나간다. 줄이는 경로(캔버스로 다시 그림)는 원래 EXIF 가 빠지지만,
 * 원본을 그대로 보내는 경로(GIF · 다시 그린 결과가 더 큰 PNG · 캔버스 실패)가 있어 여기서 한 번 더 걷는다.
 *
 * 형식을 끝까지 읽지 못하면(깨졌거나 모르는 구조) `null` — 부르는 쪽이 다른 길을 고른다. 추측으로 자르지 않는다.
 * 파일 끝 뒤에 붙은 바이트(다른 파일을 이어 붙인 polyglot, 휴대폰의 부가 이미지)도 잘라 낸다.
 */
export interface StrippedImage {
  bytes: Bytes
  /** 무엇이든 걷어 냈나. `false` 면 `bytes` 는 원본과 같다 */
  stripped: boolean
}

export function stripImageMetadata(bytes: Bytes, format: ImageFormat): StrippedImage | null {
  switch (format) {
    case 'jpeg':
      return stripJpegMetadata(bytes)
    case 'png':
      return stripPngMetadata(bytes)
    case 'gif':
      return stripGifMetadata(bytes)
  }
}

/* ── JPEG ─────────────────────────────────────────────────────────────
 * [FF D8] [FF xx 길이(2) 데이터]… [FF DA 스캔 머리] 압축 데이터 … [FF D9]
 *
 * 걷는 것 : APP1(EXIF · XMP — GPS 가 여기 있다) · APP2 가운데 ICC 가 아닌 것(MPF 부가 이미지 목차) ·
 *           APP3~APP13(IPTC · Photoshop 등) · APP15 · COM(주석) · APP14 가운데 Adobe 가 아닌 것
 * 남기는 것 : APP0(JFIF) · APP2 ICC_PROFILE(색) · APP14 Adobe(색 변환 — 빼면 CMYK · RGB 사진의 색이 틀어진다) · 나머지 표준 세그먼트
 *
 * EXIF 의 방향 태그도 함께 빠진다. 세로로 찍은 사진이 누울 수 있어서, 원본에 메타데이터가 있으면
 * 부르는 쪽이 캔버스로 다시 그린 결과(방향 적용됨)를 먼저 쓴다(`features/posts` 의 `preparePostImage`).
 */
export function stripJpegMetadata(bytes: Bytes): StrippedImage | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  const kept: Bytes[] = [bytes.subarray(0, 2)]
  let stripped = false
  let pos = 2

  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) return null
    // 마커 앞의 채움 바이트(FF FF …)는 건너뛴다
    let markerAt = pos + 1
    while (markerAt < bytes.length && bytes[markerAt] === 0xff) markerAt += 1
    if (markerAt >= bytes.length) return null
    const marker = bytes[markerAt]

    if (marker === 0xd9) {
      // 스캔 없이 끝났다 — 그림이 아니다
      return null
    }
    // 길이 없는 마커(RSTn · TEM)는 스캔 앞에 오지 않지만 오면 그대로 둔다
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(bytes.subarray(pos, markerAt + 1))
      pos = markerAt + 1
      continue
    }
    if (markerAt + 2 >= bytes.length) return null
    const length = (bytes[markerAt + 1] << 8) | bytes[markerAt + 2]
    const end = markerAt + 1 + length
    if (length < 2 || end > bytes.length) return null

    if (marker === 0xda) {
      // 스캔 시작 — 여기부터 끝까지가 그림이다. 압축 데이터 안의 FF 는 뒤에 00 · RSTn 이 붙으므로
      // 처음 만나는 FF D9 가 파일 끝이다. 그 뒤(이어 붙인 파일 · 부가 이미지)는 버린다
      const eoi = findJpegEnd(bytes, end)
      const tail = eoi < 0 ? bytes.length : eoi
      if (tail < bytes.length) stripped = true
      kept.push(bytes.subarray(pos, tail))
      return { bytes: stripped ? concat(kept) : bytes, stripped }
    }

    if (isJpegMetadataSegment(marker, bytes.subarray(markerAt + 3, end))) {
      stripped = true
    } else {
      kept.push(bytes.subarray(pos, end))
    }
    pos = end
  }
  return null
}

function isJpegMetadataSegment(marker: number, data: Bytes): boolean {
  if (marker === 0xfe) return true // COM
  if (marker < 0xe0 || marker > 0xef) return false // APPn 이 아니다
  if (marker === 0xe0) return false // APP0 JFIF
  if (marker === 0xe2) return !startsWithAscii(data, 'ICC_PROFILE\0')
  if (marker === 0xee) return !startsWithAscii(data, 'Adobe')
  return true // APP1 EXIF · XMP, APP3~13, APP15
}

/**
 * 스캔 머리 뒤에서 EOI(FF D9)를 찾아 **그 뒤 위치**를 돌려준다. 없으면 -1.
 * 압축 데이터 안의 FF 는 뒤에 00(바이트 채움) · D0~D7(RSTn)이 붙는다. 그 밖의 마커(점진 JPEG 의 DHT · 다음 SOS 등)는
 * 길이만큼 통째로 건너뛴다 — 표 안의 바이트가 우연히 FF D9 여도 끝으로 읽지 않는다
 */
function findJpegEnd(bytes: Bytes, from: number): number {
  let i = from
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1
      continue
    }
    const next = bytes[i + 1]
    if (next === 0xd9) return i + 2
    if (next === 0xff) {
      i += 1
      continue
    }
    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
      i += 2
      continue
    }
    if (i + 3 >= bytes.length) return -1
    const length = (bytes[i + 2] << 8) | bytes[i + 3]
    if (length < 2) return -1
    i += 2 + length
  }
  return -1
}

/* ── PNG ──────────────────────────────────────────────────────────────
 * [시그니처 8] [길이(4) 종류(4) 데이터 CRC(4)]… [IEND]
 * 덩어리 단위로 통째로 빼므로 남은 덩어리의 CRC 는 그대로 맞다.
 *
 * 걷는 것 : eXIf(EXIF — GPS) · tEXt · zTXt · iTXt(글자 메타데이터, XMP 도 여기 들어간다) · tIME
 * 남기는 것 : 나머지 전부 — 색(iCCP · sRGB · gAMA) · 투명(tRNS) · 움직이는 PNG(acTL · fcTL · fdAT) 가 깨지지 않게 모르는 덩어리도 둔다
 */
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])

export function stripPngMetadata(bytes: Bytes): StrippedImage | null {
  if (bytes.length < 8 + 12) return null
  const kept: Bytes[] = [bytes.subarray(0, 8)]
  let stripped = false
  let pos = 8

  while (pos + 12 <= bytes.length) {
    const length = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7])
    const end = pos + 12 + length
    if (!/^[A-Za-z]{4}$/.test(type) || end > bytes.length) return null

    if (PNG_METADATA_CHUNKS.has(type)) {
      stripped = true
    } else {
      kept.push(bytes.subarray(pos, end))
    }
    pos = end

    if (type === 'IEND') {
      if (pos < bytes.length) stripped = true // IEND 뒤에 붙은 것
      return { bytes: stripped ? concat(kept) : bytes, stripped }
    }
  }
  return null
}

/* ── GIF ──────────────────────────────────────────────────────────────
 * [GIF89a] [화면 설명 7] [전역 색표?] { 확장 블록 | 그림 블록 }… [3B]
 *
 * 걷는 것 : 주석 확장(21 FE) · 반복(NETSCAPE2.0 · ANIMEXTS1.0) · 색(ICCRGBG1012)이 아닌 응용 확장(21 FF — XMP 가 여기 들어간다)
 * 남기는 것 : 그래픽 제어(21 F9 — 프레임 간격 · 투명) · 그림 블록 · 반복 설정. 움직임은 그대로다
 */
const GIF_KEPT_APPLICATIONS = ['NETSCAPE2.0', 'ANIMEXTS1.0', 'ICCRGBG1012']

export function stripGifMetadata(bytes: Bytes): StrippedImage | null {
  if (bytes.length < 13) return null
  const packed = bytes[10]
  let pos = 13 + ((packed & 0x80) !== 0 ? 3 * (1 << ((packed & 0x07) + 1)) : 0)
  if (pos > bytes.length) return null

  const kept: Bytes[] = [bytes.subarray(0, pos)]
  let stripped = false

  while (pos < bytes.length) {
    const introducer = bytes[pos]

    if (introducer === 0x3b) {
      if (pos + 1 < bytes.length) stripped = true // 끝 표시 뒤에 붙은 것
      kept.push(bytes.subarray(pos, pos + 1))
      return { bytes: stripped ? concat(kept) : bytes, stripped }
    }

    if (introducer === 0x21) {
      if (pos + 1 >= bytes.length) return null
      const label = bytes[pos + 1]
      const end = skipSubBlocks(bytes, pos + 2)
      if (end < 0) return null
      if (isGifMetadataExtension(label, bytes, pos + 2)) {
        stripped = true
      } else {
        kept.push(bytes.subarray(pos, end))
      }
      pos = end
      continue
    }

    if (introducer === 0x2c) {
      // 그림 설명 10바이트(2C 포함) → 지역 색표? → LZW 최소 코드 크기 1바이트 → 데이터 서브블록
      if (pos + 10 > bytes.length) return null
      const imagePacked = bytes[pos + 9]
      const table = (imagePacked & 0x80) !== 0 ? 3 * (1 << ((imagePacked & 0x07) + 1)) : 0
      const end = skipSubBlocks(bytes, pos + 10 + table + 1)
      if (end < 0) return null
      kept.push(bytes.subarray(pos, end))
      pos = end
      continue
    }

    return null
  }
  return null
}

function isGifMetadataExtension(label: number, bytes: Bytes, dataAt: number): boolean {
  if (label === 0xfe) return true // 주석
  if (label !== 0xff) return false // 그래픽 제어 · 글자 확장은 그림의 일부다
  if (bytes[dataAt] !== 11) return true // 응용 확장의 첫 서브블록은 11바이트(이름 8 + 인증 3)여야 한다
  const name = String.fromCharCode(...bytes.subarray(dataAt + 1, dataAt + 12))
  return !GIF_KEPT_APPLICATIONS.includes(name)
}

/** [크기][데이터]… [00] 을 건너뛴 위치. 넘치면 -1 */
function skipSubBlocks(bytes: Bytes, from: number): number {
  let pos = from
  while (pos < bytes.length) {
    const size = bytes[pos]
    pos += 1
    if (size === 0) return pos
    pos += size
  }
  return -1
}

/* ── 공통 ── */

function startsWithAscii(data: Bytes, text: string): boolean {
  if (data.length < text.length) return false
  for (let i = 0; i < text.length; i += 1) {
    if (data[i] !== text.charCodeAt(i)) return false
  }
  return true
}

function concat(parts: readonly Bytes[]): Bytes {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}
