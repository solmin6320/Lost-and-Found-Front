import { describe, expect, it } from 'vitest'

import { readImageFormat, sniffImageFormat } from './format'
import { stripGifMetadata, stripJpegMetadata, stripPngMetadata } from './metadata'

/* 작은 그림 파일을 바이트로 짓는다. 그림으로 그려질 필요는 없다 — 구조만 맞으면 된다 */

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0))
const bytes = (...parts: (number | number[])[]) => new Uint8Array(parts.flat())
const includes = (haystack: Uint8Array, text: string) => String.fromCharCode(...haystack).includes(text)

/** JPEG 세그먼트 FF xx [길이] [데이터] */
const segment = (marker: number, data: number[]) => [0xff, marker, ((data.length + 2) >> 8) & 0xff, (data.length + 2) & 0xff, ...data]

const SOI = [0xff, 0xd8]
const EOI = [0xff, 0xd9]
const APP0 = segment(0xe0, [...ascii('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0])
const EXIF = segment(0xe1, [...ascii('Exif\0\0'), ...ascii('GPS 37.5665N 126.9780E')])
const XMP = segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>'))
const ICC = segment(0xe2, [...ascii('ICC_PROFILE\0'), 1, 1, 9, 9])
const MPF = segment(0xe2, [...ascii('MPF\0'), 1, 2, 3])
const IPTC = segment(0xed, ascii('Photoshop 3.0\0IPTC'))
const ADOBE = segment(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1])
const COM = segment(0xfe, ascii('secret comment'))
const DQT = segment(0xdb, [0, 1, 2, 3])
const SOF = segment(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0])
const SOS = segment(0xda, [1, 1, 0, 0, 0x3f, 0])
/** 압축 데이터 — FF 00(바이트 채움) · FF D0(RST0) 이 끼어 있어도 끝이 아니다 */
const SCAN = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56]

describe('sniffImageFormat — 이름이 아니라 앞 바이트', () => {
  it.each([
    [[0xff, 0xd8, 0xff, 0xe0], 'jpeg'],
    [[0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a], 'png'],
    [ascii('GIF89a'), 'gif'],
    [ascii('GIF87a'), 'gif'],
  ] as const)('%j → %s', (head, format) => {
    expect(sniffImageFormat(bytes([...head]))).toBe(format)
  })

  it.each([
    ['WebP', ascii('RIFF\0\0\0\0WEBP')],
    ['HEIC', [0, 0, 0, 0x18, ...ascii('ftypheic')]],
    ['SVG', ascii('<svg xmlns=')],
    ['HTML', ascii('<!doctype html>')],
    ['BMP', ascii('BM')],
    ['빈 파일', []],
    ['GIF 흉내', ascii('GIF88a')],
  ])('%s 는 거른다', (_name, head) => {
    expect(sniffImageFormat(bytes(head))).toBeNull()
  })

  it('File 의 앞 8바이트만 읽는다', async () => {
    const disguised = new File([new Uint8Array(ascii('<html><script>'))], '사진.jpg', { type: 'image/jpeg' })
    expect(await readImageFormat(disguised)).toBeNull()
    expect(await readImageFormat(new File([bytes(SOI, APP0)], 'a.png'))).toBe('jpeg')
  })
})

describe('stripJpegMetadata — GPS 가 든 EXIF 를 걷는다', () => {
  it('APP1(EXIF · XMP) · APP13 · COM · ICC 가 아닌 APP2 · 끝 뒤의 바이트를 걷고, JFIF · ICC · Adobe · 그림은 남긴다', () => {
    const input = bytes(SOI, APP0, EXIF, XMP, ICC, MPF, IPTC, ADOBE, COM, DQT, SOF, SOS, SCAN, EOI, ascii('<html>appended'))
    const result = stripJpegMetadata(input)

    expect(result?.stripped).toBe(true)
    expect(Array.from(result!.bytes)).toEqual([...SOI, ...APP0, ...ICC, ...ADOBE, ...DQT, ...SOF, ...SOS, ...SCAN, ...EOI])
    expect(includes(result!.bytes, 'GPS')).toBe(false)
    expect(includes(result!.bytes, 'xmpmeta')).toBe(false)
    expect(includes(result!.bytes, 'secret')).toBe(false)
    expect(includes(result!.bytes, 'appended')).toBe(false)
  })

  it('걷을 것이 없으면 원본 그대로(같은 배열)', () => {
    const input = bytes(SOI, APP0, DQT, SOF, SOS, SCAN, EOI)
    const result = stripJpegMetadata(input)
    expect(result).toEqual({ bytes: input, stripped: false })
  })

  it('점진 JPEG — 스캔 사이 표 안의 FF D9 를 끝으로 읽지 않는다', () => {
    const tableWithFakeEnd = segment(0xc4, [0x10, 0xff, 0xd9, 0x01])
    const input = bytes(SOI, EXIF, SOF, SOS, SCAN, tableWithFakeEnd, SOS, SCAN, EOI)
    const result = stripJpegMetadata(input)
    expect(Array.from(result!.bytes)).toEqual([...SOI, ...SOF, ...SOS, ...SCAN, ...tableWithFakeEnd, ...SOS, ...SCAN, ...EOI])
  })

  it('끝 표시가 없는 잘린 파일은 있는 데까지 둔다', () => {
    const result = stripJpegMetadata(bytes(SOI, EXIF, SOF, SOS, SCAN))
    expect(Array.from(result!.bytes)).toEqual([...SOI, ...SOF, ...SOS, ...SCAN])
  })

  it.each([
    ['JPEG 가 아님', bytes(ascii('GIF89a'))],
    ['세그먼트 사이가 FF 가 아님', bytes(SOI, 0x00, 0x01)],
    ['길이가 파일을 넘음', bytes(SOI, 0xff, 0xe1, 0x40, 0x00, 1, 2, 3)],
    ['스캔 없이 끝남', bytes(SOI, APP0, EOI)],
  ])('%s → null(추측으로 자르지 않는다)', (_name, input) => {
    expect(stripJpegMetadata(input)).toBeNull()
  })
})

/** PNG 덩어리 [길이 4][종류 4][데이터][CRC 4]. CRC 는 검사하지 않으므로 0 으로 둔다 */
const chunk = (type: string, data: number[]) => [
  (data.length >>> 24) & 0xff,
  (data.length >>> 16) & 0xff,
  (data.length >>> 8) & 0xff,
  data.length & 0xff,
  ...ascii(type),
  ...data,
  0,
  0,
  0,
  0,
]
const PNG_SIG = [0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a]
const IHDR = chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
const IDAT = chunk('IDAT', [1, 2, 3])
const IEND = chunk('IEND', [])

describe('stripPngMetadata', () => {
  it('eXIf · tEXt · zTXt · iTXt · tIME 와 IEND 뒤를 걷고, 색 · 투명 · 움직임 덩어리는 남긴다', () => {
    const iccp = chunk('iCCP', [1, 2])
    const actl = chunk('acTL', [0, 0, 0, 2, 0, 0, 0, 0])
    const input = bytes(
      PNG_SIG,
      IHDR,
      chunk('eXIf', ascii('MM\0*GPS')),
      chunk('tEXt', ascii('Comment\0secret')),
      chunk('iTXt', ascii('XML:com.adobe.xmp\0')),
      chunk('tIME', [7, 234, 9, 28, 0, 0, 0]),
      iccp,
      actl,
      IDAT,
      IEND,
      ascii('appended'),
    )
    const result = stripPngMetadata(input)
    expect(result?.stripped).toBe(true)
    expect(Array.from(result!.bytes)).toEqual([...PNG_SIG, ...IHDR, ...iccp, ...actl, ...IDAT, ...IEND])
  })

  it('걷을 것이 없으면 원본 그대로', () => {
    const input = bytes(PNG_SIG, IHDR, IDAT, IEND)
    expect(stripPngMetadata(input)).toEqual({ bytes: input, stripped: false })
  })

  it('IEND 가 없거나 덩어리가 넘치면 null', () => {
    expect(stripPngMetadata(bytes(PNG_SIG, IHDR, IDAT))).toBeNull()
    expect(stripPngMetadata(bytes(PNG_SIG, IHDR, [0, 0, 1, 0, ...ascii('IDAT'), 1]))).toBeNull()
  })
})

const GIF_HEAD = [...ascii('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255] // 전역 색표 2색
const appExt = (name: string, data: number[]) => [0x21, 0xff, 11, ...ascii(name), data.length, ...data, 0]
const NETSCAPE = appExt('NETSCAPE2.0', [1, 0, 0])
const XMP_APP = appExt('XMP DataXMP', ascii('<x:xmpmeta GPS/>'))
const COMMENT = [0x21, 0xfe, 6, ...ascii('secret'), 0]
const GCE = [0x21, 0xf9, 4, 0, 10, 0, 0, 0]
const FRAME = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x4c, 0x01, 0]
const TRAILER = [0x3b]

describe('stripGifMetadata — 움직임은 그대로', () => {
  it('주석 · XMP 응용 확장 · 끝 뒤를 걷고, 반복(NETSCAPE) · 그래픽 제어 · 장면은 남긴다', () => {
    const input = bytes(GIF_HEAD, NETSCAPE, COMMENT, XMP_APP, GCE, FRAME, GCE, FRAME, TRAILER, ascii('appended'))
    const result = stripGifMetadata(input)
    expect(result?.stripped).toBe(true)
    expect(Array.from(result!.bytes)).toEqual([...GIF_HEAD, ...NETSCAPE, ...GCE, ...FRAME, ...GCE, ...FRAME, ...TRAILER])
  })

  it('걷을 것이 없으면 원본 그대로', () => {
    const input = bytes(GIF_HEAD, NETSCAPE, GCE, FRAME, TRAILER)
    expect(stripGifMetadata(input)).toEqual({ bytes: input, stripped: false })
  })

  it('모르는 블록 · 끝 표시 없음 → null', () => {
    expect(stripGifMetadata(bytes(GIF_HEAD, 0x99))).toBeNull()
    expect(stripGifMetadata(bytes(GIF_HEAD, GCE, FRAME))).toBeNull()
  })
})
