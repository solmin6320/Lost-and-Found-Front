/**
 * 업로드 전 사진 줄이기. 도메인을 모른다 — 크기 · 품질은 부르는 쪽이 정한다.
 */

export interface JpegEncodeOptions {
  /** 긴 변의 최대 px. 이보다 작으면 크기는 그대로 두고 다시 인코딩만 한다 */
  maxEdge: number
  /** JPEG 품질 0~1 */
  quality: number
}

/** 브라우저가 이 파일을 그림으로 읽지 못했다(깨진 파일, 확장자만 바꾼 파일, HEIC 등) */
export class ImageDecodeError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('이미지를 읽을 수 없습니다', options)
    this.name = 'ImageDecodeError'
  }
}

/** 그림은 읽었는데 JPEG 로 만들지 못했다(캔버스 메모리 부족 등) */
class ImageEncodeError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('이미지를 변환할 수 없습니다', options)
    this.name = 'ImageEncodeError'
  }
}

/**
 * 사진을 JPEG 로 다시 그린다. 긴 변이 `maxEdge` 보다 크면 비율을 지키며 줄인다.
 *
 * - **EXIF 방향을 먼저 적용하고** 그린다. 결과에는 방향 태그가 없고 그림 자체가 똑바로 서 있다.
 *   휴대폰 세로 사진이 눕지 않는다
 * - 투명한 부분은 흰색으로 채운다. JPEG 에는 알파가 없어 그대로 두면 검게 나온다
 * - 다시 그리므로 **EXIF 가 모두 빠진다**(촬영 위치 GPS · 기기 정보 포함)
 * - 결과가 원본보다 커질 수 있다(이미 작고 잘 압축된 사진, 단색 PNG). 고르는 건 부르는 쪽이다
 *
 * 실패하면 `ImageDecodeError` 또는 `ImageEncodeError` 를 던진다.
 */
export async function encodeAsJpeg(file: Blob, { maxEdge, quality }: JpegEncodeOptions): Promise<Blob> {
  const image = await decode(file)
  try {
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new ImageEncodeError()
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image.source, 0, 0, width, height)

    const blob = await toBlob(canvas, quality)
    // 캔버스 메모리를 바로 돌려준다(모바일 Safari 는 캔버스 총량 한도가 있다)
    canvas.width = 0
    canvas.height = 0
    return blob
  } finally {
    image.release()
  }
}

/**
 * 브라우저가 이 파일을 그림으로 읽을 수 있는지. 다시 그리지 않고 보낼 파일(GIF)을 거를 때 쓴다.
 * 확장자만 바꾼 파일을 막는 **UX** 일 뿐이다. 진짜 판정은 서버가 한다.
 */
export async function isDecodableImage(file: Blob): Promise<boolean> {
  try {
    const image = await decode(file)
    image.release()
    return true
  } catch {
    return false
  }
}

interface DecodedImage {
  source: CanvasImageSource
  /** EXIF 방향을 적용한 뒤의 크기 */
  width: number
  height: number
  release: () => void
}

async function decode(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' : EXIF 방향대로 돌려서 읽는다
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // 옛 브라우저는 'from-image' 값을 몰라 TypeError 를 던진다. <img> 로 한 번 더 시도한다
    }
  }
  return decodeWithImageElement(file)
}

/**
 * `<img>` 로 읽는다. 요즘 브라우저는 `<img>` 에 EXIF 방향을 기본으로 적용하고(CSS `image-orientation: from-image`),
 * 캔버스에 그릴 때도 그 방향을 따른다.
 * `blob:` 주소를 쓰므로 운영 CSP 의 `img-src` 에 `blob:` 이 있어야 한다(보안명세서 4장).
 */
async function decodeWithImageElement(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file)
  const release = () => URL.revokeObjectURL(url)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release }
  } catch (error) {
    release()
    throw new ImageDecodeError({ cause: error })
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // 캔버스가 너무 크거나 메모리가 모자라면 null 이 온다
        if (blob) resolve(blob)
        else reject(new ImageEncodeError())
      },
      'image/jpeg',
      quality,
    )
  })
}
