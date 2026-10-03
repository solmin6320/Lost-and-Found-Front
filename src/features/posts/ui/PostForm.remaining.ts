import { checkPostForm, type PostFormValues } from '../model/postForm'

/**
 * 제출이 막힌 뒤 제출 줄 위에 남는 한 줄 — "3곳을 더 채워야 올라가요"(회의 AR-10).
 *
 * - **보내기 전 검사 결과로만** 센다. 서버 400(`INVALID_INPUT`)은 첫 칸 하나만 알려 주므로 넣지 않는다
 * - 칸을 고칠 때마다 다시 센다 — 줄면 수가 줄고, 다 채우면 줄이 사라진다
 * - 칸마다 붙은 오류 대신 이 한 줄이 **유일한 알림**이다(회의 UI2-9 · RV2-6). 문장은 해요체, 글자 기호 없음
 */
export function remainingFieldCount(values: PostFormValues, today: string): number {
  return Object.keys(checkPostForm(values, today)).length
}

export function remainingMessage(count: number, mode: 'create' | 'edit'): string | null {
  if (count <= 0) return null
  return `${count}곳을 더 채워야 ${mode === 'create' ? '올라가요' : '저장돼요'}`
}
