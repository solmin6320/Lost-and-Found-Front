import { MutationCache, QueryClient } from '@tanstack/react-query'

import { waitForPendingDots } from '@/shared/lib/useLateFlag'

/**
 * 서버 응답이 아니라 네트워크·서버 장애일 때만 재시도한다.
 *
 * 4xx 는 다시 보내도 같은 답이 온다. 특히 아래 둘은 재시도가 해로운 경우다.
 *
 *  401 — 액세스 토큰이 5분이라 만료가 잦다. 만료는 API 클라이언트의 인터셉터가
 *        `POST /api/auth/reissue` 로 처리한다(기능명세서 [3.3]).
 *        재발급은 리프레시 토큰을 매번 교체(로테이션)하므로, Query 가 401 을 보고
 *        따로 재시도하면 재발급이 여러 번 겹친다. 먼저 끝난 요청이 Redis 값을 갈아치우고
 *        뒤늦게 도착한 요청은 불일치로 401 을 받아, 멀쩡한 세션이 끊긴다.
 *  423 — 로그인 5회 실패로 30분 잠긴 상태다. 재시도가 실패 횟수를 더 올린다.
 *
 * 오류 객체에서 status 를 못 읽으면 응답 자체가 없었다는 뜻(네트워크 끊김·타임아웃)이므로
 * 재시도 대상으로 본다. HTTP 클라이언트는 던지는 오류에 `status` 를 실어야 한다.
 */
function shouldRetry(_failureCount: number, error: unknown): boolean {
  const status = (error as { status?: unknown } | null | undefined)?.status

  if (typeof status !== 'number') {
    return true
  }

  return status >= 500
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    /**
     * 쓰기 요청이 끝나는 때를 **버튼 점이 끝나는 그림**에 맞춘다(QA-D-11) — 모든 쓰기(로그인 · 가입 · 저장 · 댓글 · 삭제 · 상태 바꾸기 · 올리기)가
     * 버튼 점(`Button pending`)으로 기다림을 보인다. 점은 한 번 뜨면 0.45초 머무는데, 그 사이에 응답이 오면 오류 문구 · 포커스가
     * 먼저 나오고 버튼만 "확인 중"으로 남았다. 여기서 남은 시간을 기다리면 성공 · 실패가 그 뒤에야 정해져(훅의 onSuccess · onError,
     * 화면의 mutate 콜백, isPending 이 모두 뒤로) 점이 끝나는 그림에서 결과가 함께 나온다. 0.3초 안의 응답은 기다리지 않는다
     */
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => waitForPendingDots(mutation.state.submittedAt),
      onError: (_error, _variables, _context, mutation) => waitForPendingDots(mutation.state.submittedAt),
    }),
    defaultOptions: {
      queries: {
        /**
         * 30초. 기본값 0 이면 목록 -> 상세 -> 뒤로가기 를 할 때마다 목록을 다시 받는다.
         * 분실물은 새 글이 계속 올라오므로 길게 잡을 수도 없다.
         * 더 길거나 짧아야 하는 쿼리는 훅에서 개별로 덮는다.
         */
        staleTime: 30_000,

        /** 화면을 떠난 데이터를 5분간 메모리에 둔다(라이브러리 기본값). 뒤로가기가 즉시 그려진다 */
        gcTime: 5 * 60_000,

        /** 5xx·네트워크 오류만 최대 2회 */
        retry: (failureCount, error) => failureCount < 2 && shouldRetry(failureCount, error),

        /**
         * 탭을 다시 볼 때마다 재요청하지 않는다. 모바일 우선이라 앱 전환이 잦고,
         * 글을 쓰다가 사진 앱에 다녀오면 폼 아래 목록이 통째로 다시 그려진다.
         * 신선도가 중요한 화면에서 개별로 켠다.
         */
        refetchOnWindowFocus: false,
      },

      mutations: {
        /**
         * 쓰기는 자동 재시도하지 않는다.
         * `POST /api/posts` 를 재시도하면 게시글이 두 개 만들어진다.
         * 폼에서 중복 클릭을 막는 것과 같은 이유다. 재시도는 사용자가 누를 때만 한다.
         */
        retry: 0,

        /**
         * 연결이 끊겨 있어도 **바로 보내 보고 실패를 받는다**(`always`).
         * 기본값 `online` 은 브라우저가 오프라인이라고 보면 요청을 보내지 않고 "멈춤"으로 둔다 — `isPending` 이 끝나지 않아
         * [로그인]이 `확인 중…` 그대로 · 칸이 읽기 전용 그대로 남았다(QA D-9, 2026-10-11). 연결이 돌아오면 저절로 보내기까지 해서
         * 사용자가 떠난 뒤 글 · 댓글이 올라갈 수도 있었다. 지금은 곧바로 `NetworkError` → 폼 위 "연결하지 못했어요." 한 줄이 뜨고,
         * 다시 보내기는 사용자가 누를 때만이다(위 `retry: 0` 과 같은 규칙). 멈춤 상태(`isPaused`)를 읽는 곳은 없다
         */
        networkMode: 'always',
      },
    },
  })
}
