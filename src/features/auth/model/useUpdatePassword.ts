import { useMutation } from '@tanstack/react-query'

import { useAuth } from './useAuth'

/**
 * [3.6] 비밀번호 변경. 성공하면 이 기기의 세션이 끝난다(토큰 · 쿼리 캐시 · 로그인 상태를 비운다).
 *
 * 로그인 화면으로 보내는 것은 부른 쪽이 한다. 세션을 다 비운 **뒤에** `onSuccess` 가 불리므로,
 * 로그인 화면이 "이미 로그인됨"으로 보고 되돌려 보내지 않는다.
 *
 * ```ts
 * const updatePassword = useUpdatePassword()
 * updatePassword.mutate(body, {
 *   onSuccess: () => navigate(...), // "비밀번호를 바꿨어요. 다시 로그인하세요." (SCR-05)
 * })
 * ```
 *
 * 실패 code : `PASSWORD_MISMATCH`(400) · `INVALID_INPUT`(400). 실패하면 세션은 그대로다.
 * members 의 닉네임 훅과 달리 여기 있는 이유 : 성공 결과가 세션 종료라 로그인 상태를 바꿔야 한다.
 */
export function useUpdatePassword() {
  const { updatePassword } = useAuth()

  return useMutation({
    mutationFn: updatePassword,
    // 자동으로 다시 보내지 않는다. 응답만 잃었을 때 서버에선 이미 바뀌었을 수 있고,
    // 그러면 재시도가 옛 비밀번호로 가서 PASSWORD_MISMATCH 가 난다
    retry: 0,
  })
}
