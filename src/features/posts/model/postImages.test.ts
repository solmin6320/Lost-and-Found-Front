import { describe, expect, it } from 'vitest'

import {
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_MESSAGES,
  POST_REQUEST_MAX_BYTES,
  checkPostImageContent,
  checkPostImageCount,
  checkPostImageFile,
  checkPostImageSelection,
  checkPreparedPostImages,
  postImageExtension,
  safePostImageBaseName,
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

describe('checkPostImageContent — 앞 바이트가 JPG · PNG · GIF 인지', () => {
  const file = (head: number[], name: string, size?: number) => {
    const real = new File([new Uint8Array(head)], name)
    return size === undefined ? real : Object.defineProperty(real, 'size', { value: size })
  }
  const codes = (text: string) => Array.from(text, (char) => char.charCodeAt(0))
  const JPEG = [0xff, 0xd8, 0xff, 0xe0]
  const GIF = codes('GIF89a')

  it('이름과 달라도 실제 그림이면 통과', async () => {
    expect(await checkPostImageContent(file(JPEG, 'scan.png'))).toBeUndefined()
  })

  it('이름만 .jpg 인 HTML · WebP 는 거른다', async () => {
    expect(await checkPostImageContent(file(codes('<html><script>'), 'photo.jpg'))).toBe(POST_IMAGE_MESSAGES.format)
    expect(await checkPostImageContent(file([...codes('RIFF'), 0, 0, 0, 0, ...codes('WEBP')], 'photo.jpg'))).toBe(
      POST_IMAGE_MESSAGES.format,
    )
  })

  it('이름이 .jpg 여도 내용이 GIF 면 GIF 한도(줄이지 않는다)를 본다', async () => {
    expect(await checkPostImageContent(file(GIF, 'anim.jpg', POST_IMAGE_MAX_BYTES + 1))).toBe(
      POST_IMAGE_MESSAGES.fileSize,
    )
    expect(await checkPostImageContent(file(JPEG, 'big.jpg', POST_IMAGE_MAX_BYTES + 1))).toBeUndefined()
  })
})

describe('safePostImageBaseName — 서버가 누구에게나 내려주는 원래 이름', () => {
  it.each([
    ['../../etc/passwd.jpg', '_.._etc_passwd'],
    ['C:\\Users\\me\\사진.jpg', 'C__Users_me_사진'],
    ['a:b*c?d"e<f>g|h.png', 'a_b_c_d_e_f_g_h'],
    ['   ..hidden.jpg', 'hidden'],
    ['name\u0000\u001f\u007f\u009f.jpg', 'name'],
    ['invoice\u202egpj.exe.jpg', 'invoicegpj.exe'],
    ['zero\u200bwidth\ufeff.jpg', 'zerowidth'],
    ['tab\t\tspace   name.jpg', 'tab space name'],
    ['.jpg', 'image'],
    ['', 'image'],
  ])('%j → %j', (input, expected) => {
    expect(safePostImageBaseName(input)).toBe(expected)
  })

  it('macOS 의 풀어 쓴 한글(NFD)을 모아 쓴다(NFC)', () => {
    const nfd = '지갑'.normalize('NFD')
    expect(safePostImageBaseName(`${nfd}.jpg`)).toBe('지갑')
  })

  it('100자(코드 포인트)에서 자른다 — 이모지를 반으로 가르지 않는다', () => {
    const result = safePostImageBaseName(`${'😀'.repeat(150)}.jpg`)
    expect(Array.from(result)).toHaveLength(100)
    expect(result).toBe('😀'.repeat(100))
  })
})
