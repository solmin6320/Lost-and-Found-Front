import { describe, expect, it } from 'vitest'

import { deleteConsequence } from './postDelete'

const none = { photos: 0, comments: 0, claims: 0 }
const tail = '함께 사라져요. 되돌릴 수 없어요.'

describe('deleteConsequence — 함께 사라지는 것을 숫자로', () => {
  it('아무것도 없으면 되돌릴 수 없다는 말만', () => {
    expect(deleteConsequence(none)).toBe('이 게시글을 삭제하면 되돌릴 수 없어요.')
  })

  it('하나 — 끝 조사는 그 낱말의 받침을 따른다', () => {
    expect(deleteConsequence({ ...none, photos: 2 })).toBe(`이 게시글을 삭제하면 사진 2장이 ${tail}`)
    expect(deleteConsequence({ ...none, comments: 3 })).toBe(`이 게시글을 삭제하면 댓글 3개가 ${tail}`)
    expect(deleteConsequence({ ...none, claims: 1 })).toBe(`이 게시글을 삭제하면 확인 요청 1건이 ${tail}`)
  })

  it('둘 — 앞 조사는 첫 낱말, 끝 조사는 마지막 낱말', () => {
    expect(deleteConsequence({ ...none, photos: 2, comments: 3 })).toBe(`이 게시글을 삭제하면 사진 2장과 댓글 3개가 ${tail}`)
    expect(deleteConsequence({ ...none, comments: 3, claims: 1 })).toBe(`이 게시글을 삭제하면 댓글 3개와 확인 요청 1건이 ${tail}`)
    expect(deleteConsequence({ ...none, photos: 1, claims: 2 })).toBe(`이 게시글을 삭제하면 사진 1장과 확인 요청 2건이 ${tail}`)
  })

  it('셋 — "사진 2장과 댓글 3개, 확인 요청 1건이"', () => {
    expect(deleteConsequence({ photos: 2, comments: 3, claims: 1 })).toBe(
      `이 게시글을 삭제하면 사진 2장과 댓글 3개, 확인 요청 1건이 ${tail}`,
    )
  })

  it('큰 수는 자리 쉼표', () => {
    expect(deleteConsequence({ ...none, comments: 1234 })).toBe(`이 게시글을 삭제하면 댓글 1,234개가 ${tail}`)
  })
})
