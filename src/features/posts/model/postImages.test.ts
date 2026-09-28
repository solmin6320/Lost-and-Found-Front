import { describe, expect, it } from 'vitest'

import {
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_MESSAGES,
  POST_REQUEST_MAX_BYTES,
  checkPostImageCount,
  checkPostImageFile,
  checkPostImageSelection,
  checkPreparedPostImages,
  postImageExtension,
} from './postImages'

/** 검사 함수는 name · size 만 본다. 큰 파일을 실제로 만들지 않는다 */
function fakeFile(name: string, size = 1024): File {
  return { name, size } as File
}

const MB = 1024 * 1024

describe('postImageExtension — 서버처럼 마지막 . 뒤를 소문자로', () => {
  it.each([
    ['photo.jpg', 'jpg'],
    ['photo.JPEG', 'jpeg'],
    ['a.b.PNG', 'png'],
    ['anim.gif', 'gif'],
  ])('%s → %s', (name, expected) => {
    expect(postImageExtension(name)).toBe(expected)
  })

  it.each([['photo'], ['photo.heic'], ['photo.webp'], ['photo.jpg.exe'], ['photo.'], ['.jpgx']])(
    '%s 는 허용하지 않는다',
    (name) => {
      expect(postImageExtension(name)).toBeNull()
    },
  )
})

describe('checkPostImageCount — 5장 제한', () => {
  it('5장까지는 통과, 6장은 막는다', () => {
    expect(checkPostImageCount(0)).toBeUndefined()
    expect(checkPostImageCount(5)).toBeUndefined()
    expect(checkPostImageCount(6)).toBe(POST_IMAGE_MESSAGES.count)
  })
})

describe('checkPostImageFile — 고른 직후 한 장', () => {
  it('허용 확장자는 통과', () => {
    expect(checkPostImageFile(fakeFile('a.jpg'))).toBeUndefined()
  })

  it('허용하지 않는 확장자는 확장자 문구', () => {
    expect(checkPostImageFile(fakeFile('a.webp'))).toBe(POST_IMAGE_MESSAGES.extension)
  })

  it('GIF 는 줄이지 않으므로 10MB 를 넘으면 막는다', () => {
    expect(checkPostImageFile(fakeFile('a.gif', POST_IMAGE_MAX_BYTES))).toBeUndefined()
    expect(checkPostImageFile(fakeFile('a.gif', POST_IMAGE_MAX_BYTES + 1))).toBe(
      POST_IMAGE_MESSAGES.fileSize,
    )
  })

  it('JPEG · PNG 원본은 10MB 를 넘어도 통과(줄인 뒤에 본다)', () => {
    expect(checkPostImageFile(fakeFile('a.jpg', 30 * MB))).toBeUndefined()
    expect(checkPostImageFile(fakeFile('a.png', 30 * MB))).toBeUndefined()
  })
})

describe('checkPostImageSelection — 개수 먼저, 그다음 파일별', () => {
  it('6장이면 확장자보다 개수 문구가 먼저', () => {
    const files = Array.from({ length: 6 }, (_, i) => fakeFile(`${i}.webp`))
    expect(checkPostImageSelection(files)).toBe(POST_IMAGE_MESSAGES.count)
  })

  it('5장 안에서는 첫 문제 파일의 문구', () => {
    const files = [fakeFile('a.jpg'), fakeFile('b.bmp'), fakeFile('c.gif', 11 * MB)]
    expect(checkPostImageSelection(files)).toBe(POST_IMAGE_MESSAGES.extension)
  })

  it('문제 없으면 undefined', () => {
    expect(checkPostImageSelection([fakeFile('a.jpg'), fakeFile('b.png')])).toBeUndefined()
  })
})

describe('checkPreparedPostImages — 줄인 뒤 보내기 직전', () => {
  it('장당 10MB 를 넘으면 막는다', () => {
    expect(checkPreparedPostImages([fakeFile('a.jpg', POST_IMAGE_MAX_BYTES)])).toBeUndefined()
    expect(checkPreparedPostImages([fakeFile('a.jpg', POST_IMAGE_MAX_BYTES + 1)])).toBe(
      POST_IMAGE_MESSAGES.fileSize,
    )
  })

  it('6장이면 개수 문구', () => {
    const files = Array.from({ length: 6 }, (_, i) => fakeFile(`${i}.jpg`))
    expect(checkPreparedPostImages(files)).toBe(POST_IMAGE_MESSAGES.count)
  })

  it('5장 × 10MB 는 요청 한도(60MB − 여유 1MB) 안이다', () => {
    const files = Array.from({ length: 5 }, (_, i) => fakeFile(`${i}.jpg`, POST_IMAGE_MAX_BYTES))
    expect(checkPreparedPostImages(files)).toBeUndefined()
    expect(5 * POST_IMAGE_MAX_BYTES).toBeLessThan(POST_REQUEST_MAX_BYTES - MB)
  })
})
