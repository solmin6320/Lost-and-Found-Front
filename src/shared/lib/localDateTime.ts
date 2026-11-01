/**
 * 서버 `LocalDateTime`(시간대 없음) 읽기 · 상대 시각 — 알림 줄 · 대화 목록 · 말풍선이 같이 쓴다.
 * 서버와 기기가 같은 시간대(한국)라고 본다.
 */

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/

/** 서버 `LocalDateTime` → 이 기기 시각으로 읽은 `Date`. 모양이 틀리면 `null` */
export function parseLocalDateTime(value: string): Date | null {
  const m = LOCAL_DATE_TIME.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0))
}

/**
 * 가까울수록 상대 시각(사람들이 알림 · 대화 목록에서 기대하는 말, 제이콥).
 * 1분 안 `방금` · 1시간 안 `N분 전` · 오늘 `N시간 전` · 어제 `어제` · 올해 `M월 D일` · 그 전 `YYYY년 M월 D일`.
 * 기기 시계가 서버보다 늦어 앞날로 보이면 `방금`
 */
export function relativeTime(value: string, now: Date = new Date()): string {
  const at = parseLocalDateTime(value)
  if (!at) return ''
  const diffMin = Math.floor((now.getTime() - at.getTime()) / 60_000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000)
  if (days === 0) return `${Math.floor(diffMin / 60)}시간 전`
  if (days === 1) return '어제'
  if (at.getFullYear() === now.getFullYear()) return `${at.getMonth() + 1}월 ${at.getDate()}일`
  return `${at.getFullYear()}년 ${at.getMonth() + 1}월 ${at.getDate()}일`
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
