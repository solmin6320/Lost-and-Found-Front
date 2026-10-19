/**
 * 알림 · 대화 시각 — 오늘이면 시:분, 어제면 "어제", 그 전이면 월 · 일.
 * 시안은 '지금'을 목 데이터 기준(2026-10-19 19:00)에 고정한다
 */
export function shortTime(iso: string, now = new Date('2026-10-19T19:00:00')) {
  const at = new Date(iso)
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((day(now) - day(at)) / 86_400_000)
  if (diff === 0) return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  if (diff === 1) return '어제'
  return `${at.getMonth() + 1}월 ${at.getDate()}일`
}
