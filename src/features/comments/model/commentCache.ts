import type { InfiniteData } from '@tanstack/react-query'

import type { PostDetailResponse } from '@/features/posts'
import type { PagedModel } from '@/shared/types/api'

import { COMMENT_PAGE_SIZE, type CommentResponse } from '../api/types'

/**
 * 댓글 캐시를 서버 응답에 맞춰 고치는 순수 함수들.
 *
 * 정렬이 등록 오래된 순이라 **새 댓글은 항상 맨 끝**에 붙는다. 그래서 등록은 앞 페이지를 밀지 않고
 * 캐시만 고쳐도 서버와 맞는다. 삭제는 뒤 댓글이 한 칸씩 당겨져 페이지 경계가 바뀌므로
 * 캐시를 고친 뒤 다시 받는다(`commentMutations`).
 */

export type CommentPage = PagedModel<CommentResponse>
/** `pageParams` 는 서버 페이지 번호(0부터) */
export type CommentPages = InfiniteData<CommentPage, number>

function pageCount(totalElements: number): number {
  return Math.ceil(totalElements / COMMENT_PAGE_SIZE)
}

/** 상세 응답의 첫 20건을 댓글 0 페이지로 옮긴다. 서버 0 페이지와 정렬 · 크기가 같다 */
export function firstPageFromDetail(detail: PostDetailResponse): CommentPage {
  return {
    content: detail.comments,
    page: {
      size: COMMENT_PAGE_SIZE,
      number: 0,
      totalElements: detail.totalCommentCount,
      totalPages: pageCount(detail.totalCommentCount),
    },
  }
}

/** 다음에 부를 서버 페이지. 마지막 페이지까지 받았으면 `undefined` */
export function nextCommentPage(lastPage: CommentPage): number | undefined {
  const next = lastPage.page.number + 1
  return next < lastPage.page.totalPages ? next : undefined
}

/** 모든 페이지의 개수 정보를 같은 값으로 맞춘다. `getNextPageParam` 이 마지막 페이지만 보기 때문이다 */
function withTotal(pages: CommentPage[], totalElements: number): CommentPage[] {
  const totalPages = pageCount(totalElements)
  return pages.map((p) => ({ ...p, page: { ...p.page, totalElements, totalPages } }))
}

/**
 * 새 댓글을 넣는다. 마지막 페이지까지 받아 두었고 그 페이지에 자리가 있을 때만 목록에 보인다.
 * 아니면 개수만 늘린다 — "더 보기"로 받을 때 서버가 준다(겹치지 않는다).
 */
export function appendToPages(data: CommentPages, comment: CommentResponse): CommentPages {
  const lastIndex = data.pages.length - 1
  const last = data.pages[lastIndex]
  if (!last) return data

  const reachedEnd = nextCommentPage(last) === undefined
  const hasRoom = last.content.length < COMMENT_PAGE_SIZE
  const pages = withTotal(data.pages, last.page.totalElements + 1)

  if (reachedEnd && hasRoom) {
    const target = pages[lastIndex]
    if (target) pages[lastIndex] = { ...target, content: [...target.content, comment] }
  }
  return { ...data, pages }
}

export function replaceInPages(data: CommentPages, comment: CommentResponse): CommentPages {
  return {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      content: p.content.map((c) => (c.id === comment.id ? comment : c)),
    })),
  }
}

/** 지운 댓글을 뺀다. 페이지 경계가 어긋나므로 부른 쪽이 이어서 다시 받는다 */
export function removeFromPages(data: CommentPages, commentId: number): CommentPages {
  const found = data.pages.some((p) => p.content.some((c) => c.id === commentId))
  const total = data.pages.at(-1)?.page.totalElements ?? 0
  const pages = data.pages.map((p) => ({
    ...p,
    content: p.content.filter((c) => c.id !== commentId),
  }))
  // 받아 두지 않은 페이지의 댓글이면 개수를 모른다. 다시 받으면 맞춰진다
  return { ...data, pages: found ? withTotal(pages, Math.max(0, total - 1)) : pages }
}

/**
 * 상세 캐시(`totalCommentCount` · 첫 20건)를 댓글 변경에 맞춘다.
 * 새 댓글은 기존 댓글이 20건 미만일 때만 첫 20건 안에 든다.
 */
export function appendToDetail(detail: PostDetailResponse, comment: CommentResponse): PostDetailResponse {
  const fitsPreview = detail.totalCommentCount < COMMENT_PAGE_SIZE
  return {
    ...detail,
    comments: fitsPreview ? [...detail.comments, comment] : detail.comments,
    totalCommentCount: detail.totalCommentCount + 1,
  }
}

export function replaceInDetail(detail: PostDetailResponse, comment: CommentResponse): PostDetailResponse {
  return { ...detail, comments: detail.comments.map((c) => (c.id === comment.id ? comment : c)) }
}

export function removeFromDetail(detail: PostDetailResponse, commentId: number): PostDetailResponse {
  return {
    ...detail,
    comments: detail.comments.filter((c) => c.id !== commentId),
    totalCommentCount: Math.max(0, detail.totalCommentCount - 1),
  }
}
