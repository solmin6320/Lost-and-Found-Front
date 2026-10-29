import { queryOptions } from '@tanstack/react-query'

import { memberKeys } from '@/features/members'

import { getMatches } from '../api/matchApi'

/**
 * 추천 후보 쿼리 키 — **회원 키(`memberKeys.all`) 아래에** 둔다(받은 확인 요청 `claimKeys` 와 같은 까닭).
 * 어떤 글이 내 글의 후보인지는 글쓴이만 보는 개인 데이터라, 로그아웃 · 세션 만료 때 `AuthProvider` 가 `memberKeys.all` 을
 * 지우며 같이 지워진다. `postKeys.mines()` 아래는 안 된다 — 그 키 아래 응답을 모두 쪽 응답으로 읽는 곳(`cachedMyPostCounts`)이 있다
 */
export const matchKeys = {
  all: [...memberKeys.all, 'matches'] as const,
  /** 내 글 하나의 후보 */
  post: (postId: number) => [...matchKeys.all, postId] as const,
}

/** 내 글의 추천 후보(글쓴이 · 게시중 글에만 부른다 — 부른 쪽이 판정) */
export function matchesQueryOptions(postId: number) {
  return queryOptions({
    queryKey: matchKeys.post(postId),
    queryFn: ({ signal }) => getMatches(postId, signal),
  })
}
