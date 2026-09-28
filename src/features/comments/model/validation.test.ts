import { describe, expect, it } from 'vitest'

import { COMMENT_MAX_LENGTH } from '../api/types'
import { COMMENT_MESSAGES, checkCommentContent } from './validation'

describe('checkCommentContent', () => {
  it('정상 내용은 통과한다', () => {
    expect(checkCommentContent('제 지갑 같아요')).toBeUndefined()
  })

  it.each([[''], [' '], ['   \n\t  ']])('비었거나 공백만 있으면(%j) 필수 문구', (value) => {
    expect(checkCommentContent(value)).toBe(COMMENT_MESSAGES.contentRequired)
  })

  it('한도는 300자다', () => {
    expect(COMMENT_MAX_LENGTH).toBe(300)
  })

  it('정확히 300자는 통과, 301자는 길이 문구', () => {
    expect(checkCommentContent('가'.repeat(300))).toBeUndefined()
    expect(checkCommentContent('가'.repeat(301))).toBe(COMMENT_MESSAGES.contentLength)
  })

  it('앞뒤 공백도 길이에 센다(보낼 값 그대로)', () => {
    expect(checkCommentContent(` ${'가'.repeat(299)} `)).toBe(COMMENT_MESSAGES.contentLength)
  })
})
