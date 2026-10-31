import { queryOptions } from '@tanstack/react-query'

import { memberKeys } from '@/features/members'

import { getPublicMatches } from '../api/publicMatchApi'

/**
 * 공공 습득물 후보 쿼리 키 — `matchKeys` 와 같은 까닭으로 **회원 키(`memberKeys.all`) 아래에** 둔다.
 * 어떤 물건이 내 분실 글의 후보인지는 글쓴이만 보는 개인 데이터라, 로그아웃 · 세션 만료 때 `AuthProvider` 가 `memberKeys.all` 을
 * 지우며 같이 지워진다. `matchKeys.all` 아래가 아니다 — 우리 사이트 추천을 다시 받을 때 공공 후보까지 끌려오지 않게
 */
export const publicMatchKeys = {
  all: [...memberKeys.all, 'public-matches'] as const,
  /** 내 분실 글 하나의 공공 후보 */
  post: (postId: number) => [...publicMatchKeys.all, postId] as const,
}

/** 내 분실 글의 공공 습득물 후보(글쓴이 · 게시중 · 분실 글에만 부른다 — 부른 쪽이 `showsPublicMatches` 로 판정) */
export function publicMatchesQueryOptions(postId: number) {
  return queryOptions({
    queryKey: publicMatchKeys.post(postId),
    queryFn: ({ signal }) => getPublicMatches(postId, signal),
  })
}
