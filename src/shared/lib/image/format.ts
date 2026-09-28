/**
 * 파일 앞부분(매직 바이트)으로 실제 그림 형식을 본다. 이름 · MIME 은 누구나 바꿀 수 있다.
 *
 * 서버는 파일 이름의 확장자만 보고(`S3Service.extractExtension`), 파트의 Content-Type 을 S3 에 그대로 적는다.
 * 그래서 `사진.jpg` 로 이름만 바꾼 HTML · SVG · WebP 가 그대로 올라갈 수 있다. 여기서 먼저 거른다 —
 * **UX 이자 심층 방어일 뿐** 진짜 판정은 서버가 해야 한다(보안명세서 7장).
 */

export type ImageFormat = 'jpeg' | 'png' | 'gif'

/** 판정에 필요한 앞부분 길이 */
export const IMAGE_SIGNATURE_BYTES = 8

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

/** 앞 바이트가 JPEG(`FF D8 FF`) · PNG(`89 PNG \r\n 1A \n`) · GIF(`GIF87a` · `GIF89a`)면 그 형식, 아니면 `null` */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }
  if (bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return 'png'
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && // G
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x38 && // 8
    (bytes[4] === 0x37 || bytes[4] === 0x39) && // 7 | 9
    bytes[5] === 0x61 // a
  ) {
    return 'gif'
  }
  return null
}

/** 파일의 앞 8바이트만 읽어 형식을 본다. 읽지 못하면 `null` */
export async function readImageFormat(file: Blob): Promise<ImageFormat | null> {
  try {
    const head = await file.slice(0, IMAGE_SIGNATURE_BYTES).arrayBuffer()
    return sniffImageFormat(new Uint8Array(head))
  } catch {
    return null
  }
}
