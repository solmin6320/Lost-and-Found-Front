import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageFormat, StrippedImage } from '@/shared/lib/image'

import { POST_IMAGE_MESSAGES, preparePostImage } from './postImages'

/*
 * 준비(축소 · 메타데이터 걷기)가 **어느 쪽 바이트를 보내는지**만 본다.
 * 캔버스 · 구조 해석은 브라우저 · 다른 테스트(metadata.test.ts)의 몫이라 흉내 낸다 — 이 파일에서만(vi.mock 은 파일 단위)
 */
const image = vi.hoisted(() => ({
  format: 'jpeg' as ImageFormat,
  /** 다시 그린 결과. `Error` 면 캔버스 실패(읽기는 됐다) */
  encoded: null as Blob | Error | null,
  /** `stripImageMetadata` 의 결과. `null` 이면 구조를 끝까지 읽지 못했다 */
  stripped: null as StrippedImage | null,
}))

vi.mock('@/shared/lib/image', () => {
  class ImageDecodeError extends Error {}
  return {
    ImageDecodeError,
    readImageFormat: () => Promise.resolve(image.format),
    isDecodableImage: () => Promise.resolve(true),
    encodeAsJpeg: () =>
      image.encoded instanceof Error ? Promise.reject(image.encoded) : Promise.resolve(image.encoded),
    stripImageMetadata: () => image.stripped,
  }
})

const MB = 1024 * 1024
const ORIGINAL = 'ORIGINAL-WITH-GPS'
const REDRAWN = 'REDRAWN'
const STRIPPED = 'STRIPPED'

/** 파일마다 새로 만든다 — 준비 결과를 File 별로 기억하기 때문이다 */
function original(name: string, size = 1000): File {
  return new File([ORIGINAL.padEnd(size, '.')], name)
}

function blobOfSize(text: string, size: number): Blob {
  return new Blob([text.padEnd(size, '.')])
}

async function textOf(file: File): Promise<string> {
  return (await file.text()).replace(/\.+$/, '')
}

beforeEach(() => {
  image.format = 'jpeg'
  image.encoded = null
  image.stripped = null
})

describe('preparePostImage — 걷지 않은 원본은 어떤 경로로도 나가지 않는다(2026-09-29 검수 L4)', () => {
  it('다시 그린 쪽이 작으면 그것을 보낸다', async () => {
    image.encoded = blobOfSize(REDRAWN, 500)

    const result = await preparePostImage(original('a.jpg'))

    expect(await textOf(result)).toBe(REDRAWN)
    expect(result.name).toBe('a.jpg')
  })

  it('다시 그린 쪽이 커도 원본에 걷을 것이 없었으면(구조는 읽었다) 원본을 보낸다', async () => {
    image.format = 'png'
    image.encoded = blobOfSize(REDRAWN, 2000)
    image.stripped = { bytes: new Uint8Array(), stripped: false }

    const result = await preparePostImage(original('a.png'))

    expect(await textOf(result)).toBe(ORIGINAL)
    expect(result.type).toBe('image/png')
  })

  it('PNG · 다시 그린 쪽이 크고 원본 구조를 못 읽었으면 다시 그린 쪽을 보낸다(원본을 보내지 않는다)', async () => {
    image.format = 'png'
    image.encoded = blobOfSize(REDRAWN, 2000)
    image.stripped = null

    const result = await preparePostImage(original('a.png'))

    expect(await textOf(result)).toBe(REDRAWN)
    expect(result.name).toBe('a.jpg')
    expect(result.type).toBe('image/jpeg')
  })

  it('JPEG · 캔버스가 실패해도 원본에서 걷었으면 걷은 것을 보낸다', async () => {
    image.encoded = new Error('canvas')
    image.stripped = { bytes: new TextEncoder().encode(STRIPPED), stripped: true }

    const result = await preparePostImage(original('a.jpeg'))

    expect(await textOf(result)).toBe(STRIPPED)
    expect(result.name).toBe('a.jpeg')
  })

  it.each<ImageFormat>(['jpeg', 'png'])(
    '%s · 캔버스도 실패하고 원본 구조도 못 읽으면 그 사진을 막는다(읽을 수 없음)',
    async (format) => {
      image.format = format
      image.encoded = new Error('canvas')
      image.stripped = null

      await expect(preparePostImage(original(format === 'png' ? 'a.png' : 'a.jpg'))).rejects.toMatchObject({
        code: 'UNREADABLE_IMAGE',
        message: POST_IMAGE_MESSAGES.unreadable,
      })
    },
  )

  // 예전에는 한도 안(9MB)인 원본으로 물러서서 걷지 않은 채 보냈다
  it('원본 구조를 못 읽었고 다시 그린 쪽이 10MB 를 넘으면 원본으로 물러서지 않고 크기로 막는다', async () => {
    image.encoded = new Blob([new Uint8Array(11 * MB)])
    image.stripped = null

    await expect(preparePostImage(new File([new Uint8Array(9 * MB)], 'a.jpg'))).rejects.toMatchObject({
      code: 'IMAGE_TOO_LARGE',
    })
  })
})
