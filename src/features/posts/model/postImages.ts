import { ClientValidationError } from '@/shared/lib/http'
import { ImageDecodeError, encodeAsJpeg, isDecodableImage } from '@/shared/lib/image'

/*
 * 게시글 사진 규칙 — 등록 · 수정([4.1] · [4.4] · [4.5])
 *
 * 한도는 전부 백엔드 값을 옮긴 것이다. 여기서 막는 건 **빠른 피드백(UX)** 이고 판정은 서버가 한다.
 * 특히 크기 한도를 넘긴 요청은 서버가 `ErrorResponse` 로 답하지 못할 수 있어(연결이 끊기거나 500)
 * 보내기 전에 막아야 사용자가 제대로 된 문장을 본다.
 */

/** 한 글의 최대 사진 수. 원본 : `PostService.MAX_IMAGE_COUNT` */
export const POST_IMAGE_MAX_COUNT = 5

/**
 * 파일 한 개의 최대 크기. 원본 : `application.yml` `spring.servlet.multipart.max-file-size: 10MB`.
 * Spring `DataSize` 의 MB 는 1024 × 1024 바이트다.
 * **줄인 뒤의 크기**에 건다. 고를 때의 원본은 10MB 를 넘어도 된다(GIF 만 빼고 — 줄이지 않는다).
 */
export const POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024

/**
 * 요청 하나의 최대 크기. 원본 : `spring.servlet.multipart.max-request-size: 60MB`.
 * 폼 필드와 multipart 경계 문자열까지 포함한 크기다. 5장 × 10MB = 50MB 라 앞의 두 한도를 지키면 넘지 않는다.
 */
export const POST_REQUEST_MAX_BYTES = 60 * 1024 * 1024

/** 폼 필드(본문 5000자 등)와 multipart 머리글 몫으로 남겨 두는 여유 */
const REQUEST_OVERHEAD_BYTES = 1024 * 1024

/** 허용 확장자(소문자). 원본 : `S3Service.ALLOWED_EXTENSIONS`. 서버는 **파일 이름의 마지막 `.` 뒤**만 본다 */
export const POST_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'] as const
export type PostImageExtension = (typeof POST_IMAGE_EXTENSIONS)[number]

/**
 * `<input type="file" accept>` 값. MIME 을 함께 적어야 iOS 가 HEIC 사진을 JPEG 로 바꿔서 넘겨 준다.
 * accept 는 거르는 힌트일 뿐이라 고른 뒤 `checkPostImageSelection()` 으로 다시 본다.
 */
export const POST_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif'

/** 업로드 전 축소 — 긴 변 2048px, JPEG 품질 0.85 (기능명세서 [4.5] "업로드 전 축소") */
export const POST_IMAGE_MAX_EDGE = 2048
export const POST_IMAGE_JPEG_QUALITY = 0.85

/** 서버가 `original_filename`(VARCHAR 255)에 그대로 넣는다. 넘치면 500 이라 여유 있게 자른다 */
const FILE_BASENAME_MAX_LENGTH = 100

const MIME_OF: Record<PostImageExtension, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
}

/**
 * 화면 문장. 확장자 · 개수는 서버 `ErrorCode` 의 문장과 **같은 문장**이다(어느 쪽이 막아도 같은 말).
 * 나머지는 서버가 `ErrorResponse` 로 알려 주지 못하는 경우라 프론트가 짓는다.
 */
export const POST_IMAGE_MESSAGES = {
  extension: '허용되지 않는 이미지 확장자입니다',
  count: `이미지는 최대 ${POST_IMAGE_MAX_COUNT}장까지 첨부할 수 있습니다`,
  fileSize: '사진은 한 장에 10MB까지 올릴 수 있습니다',
  totalSize: '사진은 모두 합쳐 60MB까지 올릴 수 있습니다',
  unreadable: '사진을 읽을 수 없습니다. 다른 사진을 골라 주세요',
} as const

/**
 * `ClientValidationError.code` 값. 확장자 · 개수는 서버 code 와 같은 이름이라
 * 서버가 막았든 브라우저가 막았든 같은 code 로 분기할 수 있다.
 */
export type PostImageErrorCode =
  | 'INVALID_IMAGE_EXTENSION'
  | 'EXCEEDED_IMAGE_COUNT'
  | 'IMAGE_TOO_LARGE'
  | 'REQUEST_TOO_LARGE'
  | 'UNREADABLE_IMAGE'

/** 서버와 같은 방식으로 확장자를 뽑는다(마지막 `.` 뒤, 소문자). 허용 목록에 없으면 `null` */
export function postImageExtension(fileName: string): PostImageExtension | null {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) {
    return null
  }
  const extension = fileName.slice(dot + 1).toLowerCase()
  return (POST_IMAGE_EXTENSIONS as readonly string[]).includes(extension)
    ? (extension as PostImageExtension)
    : null
}

/** 개수 검사. 추가로 고를 때는 기존 선택과 합친 수를 넘긴다 */
export function checkPostImageCount(count: number): string | undefined {
  return count > POST_IMAGE_MAX_COUNT ? POST_IMAGE_MESSAGES.count : undefined
}

/**
 * 고른 **직후** 파일 한 개 검사(동기). 문제 있는 파일에 표시할 문장, 없으면 `undefined`.
 *
 * - 확장자가 jpg / jpeg / png / gif 가 아니면 막는다
 * - GIF 는 줄이지 않고 그대로 보내므로(움직임이 깨진다) 여기서 10MB 를 본다.
 *   JPEG · PNG 는 줄인 뒤에 보므로 원본이 10MB 를 넘어도 통과다
 */
export function checkPostImageFile(file: File): string | undefined {
  const extension = postImageExtension(file.name)
  if (extension === null) {
    return POST_IMAGE_MESSAGES.extension
  }
  if (extension === 'gif' && file.size > POST_IMAGE_MAX_BYTES) {
    return POST_IMAGE_MESSAGES.fileSize
  }
  return undefined
}

/** 고른 직후 전체 검사(동기). 개수 → 파일별 순서로 첫 문제의 문장 */
export function checkPostImageSelection(files: readonly File[]): string | undefined {
  return checkPostImageCount(files.length) ?? firstDefined(files, checkPostImageFile)
}

/**
 * **줄인 뒤** 보내기 직전 검사. 장당 10MB · 합계 60MB(여유 1MB 를 뺀 값) · 5장.
 * `preparePostImages()` 가 마지막에 부른다. 직접 FormData 를 만들 때만 따로 부른다.
 */
export function checkPreparedPostImages(files: readonly File[]): string | undefined {
  const countMessage = checkPostImageCount(files.length)
  if (countMessage) return countMessage
  if (files.some((file) => file.size > POST_IMAGE_MAX_BYTES)) return POST_IMAGE_MESSAGES.fileSize

  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > POST_REQUEST_MAX_BYTES - REQUEST_OVERHEAD_BYTES) return POST_IMAGE_MESSAGES.totalSize
  return undefined
}

/*
 * 준비(축소) 결과를 File 별로 기억한다. 제출이 서버 검증(제목 비었음 등)으로 실패한 뒤 다시 누르면
 * 같은 사진을 또 줄이지 않는다. 키가 File 이라 선택에서 빠지면 함께 사라진다(WeakMap).
 */
const prepared = new WeakMap<File, Promise<File>>()

/**
 * 사진 한 장을 올릴 모양으로 만든다.
 *
 * - **JPEG · PNG** : 긴 변 2048px · JPEG 0.85 로 다시 그린다(EXIF 방향 적용, EXIF 제거, 투명 → 흰색).
 *   결과가 원본보다 크면 원본을 쓴다(이미 작고 잘 압축된 사진, 단색 PNG)
 * - **GIF** : 줄이지 않고 그대로 보낸다. 캔버스는 첫 장면만 그려서 움직이는 GIF 가 멈춘 그림이 된다.
 *   대신 그림으로 읽히는지만 확인한다
 *
 * 파일 이름은 `원래이름.jpg` 처럼 확장자를 실제 형식에 맞춘다. 서버는 이름의 확장자로 허용 여부를 보고,
 * 파트의 Content-Type 을 S3 에 그대로 적는다. 서버는 저장 이름을 UUID 로 바꾸지만(`S3Service.upload`)
 * 원래 이름은 `original_filename` 에 남겨 **상세 응답으로 누구에게나 내려준다.**
 *
 * 실패하면 `ClientValidationError`(`INVALID_IMAGE_EXTENSION` · `IMAGE_TOO_LARGE` · `UNREADABLE_IMAGE`).
 */
export function preparePostImage(file: File): Promise<File> {
  let result = prepared.get(file)
  if (!result) {
    result = prepare(file)
    prepared.set(file, result)
    result.catch(() => prepared.delete(file))
  }
  return result
}

/**
 * 여러 장을 **한 장씩 차례로** 준비한다. 동시에 풀면 4000만 화소 사진 5장이 한꺼번에 메모리에 올라가
 * 모바일 브라우저가 탭을 죽인다. 마지막에 `checkPreparedPostImages()` 로 한도를 본다.
 */
export async function preparePostImages(files: readonly File[]): Promise<File[]> {
  const selectionMessage = checkPostImageCount(files.length)
  if (selectionMessage) {
    throw new ClientValidationError('EXCEEDED_IMAGE_COUNT', selectionMessage)
  }

  const result: File[] = []
  for (const file of files) {
    result.push(await preparePostImage(file))
  }

  const preparedMessage = checkPreparedPostImages(result)
  if (preparedMessage) {
    const code: PostImageErrorCode =
      preparedMessage === POST_IMAGE_MESSAGES.totalSize ? 'REQUEST_TOO_LARGE' : 'IMAGE_TOO_LARGE'
    throw new ClientValidationError(code, preparedMessage)
  }
  return result
}

async function prepare(file: File): Promise<File> {
  const extension = postImageExtension(file.name)
  if (extension === null) {
    throw new ClientValidationError('INVALID_IMAGE_EXTENSION', POST_IMAGE_MESSAGES.extension)
  }

  if (extension === 'gif') {
    if (!(await isDecodableImage(file))) {
      throw new ClientValidationError('UNREADABLE_IMAGE', POST_IMAGE_MESSAGES.unreadable)
    }
    return withinFileLimit(rename(file, file.name, 'gif'))
  }

  let encoded: Blob | null = null
  try {
    encoded = await encodeAsJpeg(file, {
      maxEdge: POST_IMAGE_MAX_EDGE,
      quality: POST_IMAGE_JPEG_QUALITY,
    })
  } catch (error) {
    if (error instanceof ImageDecodeError) {
      throw new ClientValidationError('UNREADABLE_IMAGE', POST_IMAGE_MESSAGES.unreadable)
    }
    // 읽기는 됐는데 캔버스가 실패했다(메모리 부족 등). 원본이 한도 안이면 원본을 보낸다
  }

  if (encoded && encoded.size < file.size) {
    return withinFileLimit(rename(encoded, file.name, 'jpg'))
  }
  return withinFileLimit(rename(file, file.name, extension))
}

function withinFileLimit(file: File): File {
  if (file.size > POST_IMAGE_MAX_BYTES) {
    throw new ClientValidationError('IMAGE_TOO_LARGE', POST_IMAGE_MESSAGES.fileSize)
  }
  return file
}

/**
 * 보낼 파일 이름 `이름.확장자`. 확장자는 실제 형식으로 바꾸고, 이름은 100자(코드 포인트)에서 자른다.
 * Content-Type 도 확장자에 맞춰 붙인다 — 비어 있으면 브라우저가 `application/octet-stream` 으로 보내고
 * S3 가 그 형식으로 내려준다.
 */
function rename(blob: Blob, originalName: string, extension: PostImageExtension): File {
  const dot = originalName.lastIndexOf('.')
  const base = Array.from((dot < 0 ? originalName : originalName.slice(0, dot)).trim())
    .slice(0, FILE_BASENAME_MAX_LENGTH)
    .join('')
  const name = `${base || 'image'}.${extension}`
  const lastModified = blob instanceof File ? blob.lastModified : Date.now()
  return new File([blob], name, { type: MIME_OF[extension], lastModified })
}

function firstDefined<T>(items: readonly T[], check: (item: T) => string | undefined) {
  for (const item of items) {
    const message = check(item)
    if (message) return message
  }
  return undefined
}
