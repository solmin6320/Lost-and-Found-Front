/**
 * 쓰는 칸에 개인정보 모양의 숫자가 들어 있는지 **기기 안에서만** 알아본다(보안 결정 SE-3).
 *
 * 막지 않는다 — 연락처를 꼭 남기려는 사람의 선택이다. 칸 아래 한 줄로 "올리면 누구나 봐요"만 알린다.
 * 그래서 놓치는 것보다 **잘못 걸리는 것**이 더 나쁘다. 경고가 엉뚱한 글에 뜨면 사람들은 그 줄을 읽지 않게 된다.
 * 분실물 글에 흔한 숫자는 걸리지 않게 짰다(시험 `personalInfo.test.ts`).
 *
 *   걸린다     010-1234-5678 · 010 1234 5678 · 01012345678 · +82 10-1234-5678 · 02-123-4567 · 031)123-4567 ·
 *              1588-1234 · 900101-1234567 · 4111 1111 1111 1111
 *   안 걸린다  2026-09-24(날짜) · 2026.09.24 · 146번 버스 · 7016번 · 50,000원 · 1,500,000원 · 09:30 ·
 *              2호선 · 학번 20231234 · 1995-2000(연도 범위)
 *
 * 보이지 않는 글자나 다른 숫자 체계(전각 숫자)로 우회하는 것까지 쫓지 않는다 — 이건 방어선이 아니라 안내다.
 * 공용이다 : 댓글 · 댓글 수정 · 글 폼(제목 · 장소 · 설명)이 같은 판정을 쓴다.
 */

export type PersonalInfoKind = 'phone' | 'residentId' | 'card'

/** 칸 아래 한 줄. 해요체, 무엇이 보였는지 + 결과 한 가지 */
export const PERSONAL_INFO_NOTICE: Record<PersonalInfoKind, string> = {
  phone: '전화번호가 들어 있어요. 올리면 누구나 봐요.',
  residentId: '주민등록번호가 들어 있어요. 올리면 누구나 봐요.',
  card: '카드 번호가 들어 있어요. 올리면 누구나 봐요.',
}

/** 숫자 사이 구분 — 하이픈 · 점 · 빈칸 하나 */
const SEP = '[-.\\s]?'

/**
 * 전화번호.
 * - 휴대폰 : 010 · 011 · 016 · 017 · 018 · 019 + 3~4자리 + 4자리. 국가번호(+82)로 시작해 앞 0 이 빠진 것도
 * - 지역번호 : 02 · 031~064 · 070 + 3~4자리 + 4자리(괄호 `031)` 도)
 * - 대표번호 : 15xx · 16xx · 18xx 네 자리 + 하이픈 + 네 자리. 하이픈을 꼭 요구한다(여덟 자리 학번 · 연도 범위와 갈린다)
 *
 * 모두 **0 이나 +82 로 시작**해야 한다. 날짜(2026-09-24) · 금액 · 버스 번호는 0 으로 시작하는 덩어리가 없어 걸리지 않는다.
 * 앞뒤가 숫자면 더 긴 숫자의 일부라 버린다(`(?<!\d)` · `(?!\d)`).
 */
const PHONE_PATTERNS: readonly RegExp[] = [
  new RegExp(`(?<![\\d+])(?:\\+82${SEP}0?1[016789]|01[016789])${SEP}\\d{3,4}${SEP}\\d{4}(?!\\d)`),
  new RegExp(`(?<![\\d+])0(?:2|[3-6][1-5]|70)(?:\\)\\s?|${SEP})\\d{3,4}${SEP}\\d{4}(?!\\d)`),
  /(?<!\d)1(?:5[4-9]|6\d|8\d)\d-\d{4}(?!\d)/,
]

/**
 * 주민등록번호 — 앞 여섯 자리가 **있을 수 있는 생년월일**(월 01~12 · 일 01~31)이고 뒤 첫 자리가 1~8.
 * 뒤 여섯 자리를 별표로 가린 것(`900101-1******`)도 생년월일 · 성별이 드러나 같이 본다
 */
const RESIDENT_ID = /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[-\s]?[1-8](?:\d{6}|\*{6})(?!\d)/

/** 카드 번호 — 넷씩 네 묶음(같은 구분). 구분이 없는 15~16자리는 카드 번호 검사(Luhn)를 통과할 때만 */
const CARD_GROUPED = /(?<!\d)\d{4}([-\s])\d{4}\1\d{4}\1\d{4}(?!\d)/
const CARD_PLAIN = /(?<!\d)\d{15,16}(?!\d)/g

/** 카드 번호 끝자리 검사. 아무 열여섯 자리(송장 · 주문 번호)를 카드로 읽지 않게 한다 */
function passesLuhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i += 1) {
    let digit = digits.charCodeAt(digits.length - 1 - i) - 48
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

function hasCardNumber(text: string): boolean {
  if (CARD_GROUPED.test(text)) return true
  for (const match of text.matchAll(CARD_PLAIN)) {
    if (passesLuhn(match[0])) return true
  }
  return false
}

/**
 * 가장 민감한 것 하나를 돌려준다(주민등록번호 > 카드 번호 > 전화번호). 없으면 `null`.
 * 한 줄만 띄우므로 여럿이 섞여 있어도 하나만 말한다
 */
export function detectPersonalInfo(text: string): PersonalInfoKind | null {
  if (!/\d/.test(text)) return null
  if (RESIDENT_ID.test(text)) return 'residentId'
  if (hasCardNumber(text)) return 'card'
  if (PHONE_PATTERNS.some((pattern) => pattern.test(text))) return 'phone'
  return null
}
