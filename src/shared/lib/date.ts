/**
 * 날짜 표기. 서버의 `LocalDate`(`"2026-09-20"`) · `LocalDateTime`(`"2026-09-21T14:03:11"`)은
 * 시간대 오프셋이 없다. `new Date("2026-09-20")` 은 UTC 자정으로 읽혀 한국 밖에서 하루가 밀리므로
 * 문자열을 직접 자른다.
 */

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/

/** `"2026-09-20"` → `"2026. 9. 20."`. 목록·상세가 같은 형식을 쓴다 */
export function formatDate(value: string): string {
  const match = ISO_DATE_PREFIX.exec(value)
  if (!match) {
    return value
  }
  const [, year, month, day] = match
  return `${year}. ${Number(month)}. ${Number(day)}.`
}

/** 달력에 실제로 있는 `yyyy-MM-dd` 인지. `2026-02-31` 은 거짓이다 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** 이 기기 시간대 기준 오늘. `<input type="date">` 의 `max` 에 쓴다 */
export function todayIsoDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const ISO_TIME = /T(\d{2}):(\d{2})/

/** `"2026-09-21T14:03:11.123"` → `"2026. 9. 21. 14:03"`. 댓글처럼 같은 날 여러 건이 오가는 자리에 쓴다 */
export function formatDateTime(value: string): string {
  const date = formatDate(value)
  const time = ISO_TIME.exec(value)
  return time ? `${date} ${time[1]}:${time[2]}` : date
}
