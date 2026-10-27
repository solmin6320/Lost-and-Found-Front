import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { PostListResponse } from '../api/types'
import { PostCard } from './PostCard'

const base: PostListResponse = {
  id: 1,
  nickname: '서연',
  type: 'FOUND',
  title: '검은 반지갑',
  category: 'WALLET',
  location: '강남역',
  lostFoundDate: '2026-10-20',
  status: 'DONE',
  viewCount: 3,
  createdAt: '2026-10-20T10:00:00',
  thumbnailUrl: null,
}

const render = (post: PostListResponse) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <PostCard post={post} to="/posts/1" />
    </MemoryRouter>,
  )

describe('PostCard — 주인 확인 배지', () => {
  it('주인 확인 완료 글은 완료 배지 하나 안에서 "주인 확인"을 읽어 준다(배지를 더 달지 않는다)', () => {
    const html = render({ ...base, ownerVerified: true })
    expect(html).toContain('주인 확인')
    expect(html.match(/data-surface="photo"/g)).toHaveLength(2)
  })

  it('그냥 완료한 글 · 옛 응답(필드 없음)에는 달지 않는다', () => {
    expect(render({ ...base, ownerVerified: false })).not.toContain('주인 확인')
    expect(render(base)).not.toContain('주인 확인')
  })
})
