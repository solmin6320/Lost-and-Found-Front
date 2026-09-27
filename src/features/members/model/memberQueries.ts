import { queryOptions, useQuery } from '@tanstack/react-query'

import { getMe } from '../api/memberApi'

/**
 * 회원 쿼리 키.
 *
 * `me()` 캐시는 인증 상태(`useAuth().me`)도 지켜본다. 이 캐시에 새 값이 들어가면
 * 헤더의 닉네임이 따라 바뀐다. 그래서 내 정보를 고친 뒤에는 이 키에 응답을 넣는다.
 */
export const memberKeys = {
  all: ['members'] as const,
  me: () => [...memberKeys.all, 'me'] as const,
}

/** 내 정보 쿼리 설정. 옵션을 덧붙여야 하면 훅 대신 이것을 펼쳐 쓴다 */
export function meQueryOptions() {
  return queryOptions({
    queryKey: memberKeys.me(),
    queryFn: ({ signal }) => getMe(signal),
  })
}

/**
 * [3.7] 내 정보.
 *
 * 로그인했을 때만 켠다. 비로그인으로 부르면 401 을 받고 재발급까지 헛걸음한다.
 * 로그아웃하거나 비밀번호를 바꾸면 이 캐시가 지워져 다시 요청하려 들기 때문에 꼭 막는다.
 *
 * ```ts
 * const me = useMe({ enabled: auth.status === 'authenticated' })
 * ```
 */
export function useMe({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...meQueryOptions(), enabled })
}
