import type { PostListParams } from '../api/types'
import { KEYWORD_MAX_LENGTH, toPostListParams, withKeyword, type PostListSearch } from './postListSearch'

/**
 * 검색어 추천 — 치는 동안 검색칸 아래에 맞는 글 몇 개를 띄운다(본인 피드백 2026-10-07).
 * 새 요청 없이 목록 API(`GET /api/posts?keyword=…&size=5`)를 그대로 쓴다.
 */

/** 띄우는 글 수 */
export const SUGGESTION_LIMIT = 5

/**
 * 마지막 입력에서 이만큼 멈추면 요청한다. 글자마다 보내지는 않되, 치는 대로 바로바로 바뀌게 짧게 둔다
 * (본인 피드백 2026-10-14 "맞는 글 나오는 속도를 높이기" — 300 → 120ms). 빠르게 이어 치는 동안(키 사이 ~100ms)은 묶이고,
 * 손이 멈추면 사람이 "즉시"로 느끼는 안(~100ms)에 요청이 나간다. 이미 찾아 본 말(지우며 되돌아온 말)은 캐시에서 바로 그린다
 */
export const SUGGESTION_DEBOUNCE_MS = 120

/** 한글 호환 자모(ㄱ~ㅣ). 조합이 덜 끝난 글자다 — "지갑"을 치는 도중의 "지ㄱ" */
const TRAILING_JAMO = /[ㄱ-ㆎ]+$/

/**
 * 입력칸 글자 → 추천을 찾을 말. 찾을 것이 없으면 `''`(추천 칸을 띄우지 않는다).
 *
 * - 앞뒤 공백을 지운다. 공백뿐이면 `''`
 * - **조합 중**(`composing`)이면 끝에 매달린 낱자모를 떼고 찾는다 — "지ㄱ"은 "지"로. 낱자모로는 어떤 제목도 맞지 않아
 *   "맞는 글이 없어요"가 한 번 깜빡이게 된다. 조합이 끝난 낱자모("ㅋㅋ")는 사용자가 친 말이라 그대로 찾는다
 * - 검색어와 같은 한도(100자)로 자른다
 */
export function suggestTerm(text: string, composing: boolean): string {
  let term = text.trim()
  if (composing) term = term.replace(TRAILING_JAMO, '').trimEnd()
  return term.slice(0, KEYWORD_MAX_LENGTH)
}

/** 한글 완성 글자(가~힣) */
const LAST_SYLLABLE = /[가-힣]$/

/**
 * 치는 도중 0건이어도 "맞는 글이 없어요"를 바로 말하지 않고 앞 결과를 이만큼 더 둔다. 손이 이보다 오래 멈추면 그때 말한다
 */
export const SUGGESTION_HOLD_EMPTY_MS = 600

/**
 * 마지막 글자가 아직 바뀌는 중인가 — 한글 조합 중이고 끝이 완성 글자다. "지갑"을 치는 동안 "직"(받침이 다음 글자로 옮겨 간다) ·
 * "지가"(받침이 붙는다)처럼 **그 글자로 찾은 0건은 곧 뒤집힌다.** 이때는 0건이어도 앞 결과를 그대로 둔다(한 글자 칠 때마다
 * "맞는 글이 없어요"가 깜빡이지 않게). 조합이 끝났거나(`composing` 거짓) 끝이 한글 완성 글자가 아니면 `false`
 */
export function isSyllableInFlux(term: string, composing: boolean): boolean {
  return composing && LAST_SYLLABLE.test(term)
}

/**
 * 추천 요청 조건 — **그 말로 Enter 를 눌렀을 때 나올 목록의 앞 5건**이다. 추천에서 본 글이 결과에서 빠지는 일이 없다.
 *   - 새 검색어는 분실 · 습득을 함께 찾는다(`withKeyword`) — 추천에도 두 종류가 섞이고 이름표로 가른다
 *   - 상태는 목록과 같은 기준 : 고르지 않았으면 "진행 중"(게시중 + 연락중), 골랐으면 그 상태
 *   - 칩 줄에 걸어 둔 카테고리 · 장소 · 기간도 그대로 건다
 */
export function suggestionParams(search: PostListSearch, term: string): PostListParams {
  return { ...toPostListParams(withKeyword(search, term)), page: 0, size: SUGGESTION_LIMIT }
}

export interface HighlightPart {
  text: string
  /** 찾는 말과 맞는 조각 */
  match: boolean
}

/** 정규식에서 뜻을 갖는 글자를 글자 그대로 찾게 한다 */
function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&')
}

/**
 * 제목을 "맞는 조각 / 나머지"로 나눈다. **맞는 조각만** 강조한다(본인 — "키워드에 맞는 게시글 제목 부분만 강조").
 * 대소문자를 가리지 않고(`AirPods` ↔ `airpods`), 찾는 말에 든 정규식 기호(`(현대)`)는 글자로 찾는다. 맞는 곳이 여럿이면 모두.
 * 화면은 이 조각들을 React 노드(`<mark>`)로 그린다 — HTML 문자열로 만들지 않는다(`dangerouslySetInnerHTML` 금지).
 *
 * 서버는 제목 **또는 본문**에서 찾는다. 본문에서만 맞은 글은 맞는 조각이 없다(화면이 "내용에서 찾음"을 붙인다)
 */
export function highlightParts(text: string, term: string): HighlightPart[] {
  const needle = term.trim()
  if (!needle) return [{ text, match: false }]

  const parts: HighlightPart[] = []
  let last = 0
  for (const found of text.matchAll(new RegExp(escapeRegExp(needle), 'gi'))) {
    const at = found.index ?? 0
    if (at > last) parts.push({ text: text.slice(last, at), match: false })
    parts.push({ text: found[0], match: true })
    last = at + found[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false })
  return parts.length > 0 ? parts : [{ text, match: false }]
}

/** 맞는 조각 앞 글이 이보다 길면 앞을 접는다 */
const LEAD_MAX = 12
/** 접을 때 맞는 조각 앞에 남기는 글자 수 — 어떤 말 사이에서 맞았는지 보일 만큼 */
const LEAD_KEEP = 6

/**
 * 맞는 조각이 한 줄 칸 밖으로 잘려 보이지 않는 일을 막는다. 첫 맞는 조각 앞 글이 길면(12자 넘게)
 * 앞을 접어 `folded` 로 돌려주고, 맞는 조각 바로 앞 6자만 남긴다 — 화면은 "…신도림역에서 [카드]지갑"처럼 그린다.
 * 접은 글자는 버리지 않는다 — 화면은 스크린리더용으로 그대로 읽게 둔다(제목 전체가 이름이다)
 */
export function foldLead(parts: HighlightPart[]): { folded: string; parts: HighlightPart[] } {
  const [head, next] = parts
  if (!head || head.match || !next?.match || head.text.length <= LEAD_MAX) return { folded: '', parts }
  return {
    folded: head.text.slice(0, -LEAD_KEEP),
    parts: [{ text: head.text.slice(-LEAD_KEEP), match: false }, ...parts.slice(1)],
  }
}

/** 제목에 찾는 말이 들어 있나 */
export function titleMatches(text: string, term: string): boolean {
  return highlightParts(text, term).some((part) => part.match)
}

/**
 * 추천 칸의 키보드(WAI-ARIA 콤보박스 — 목록 자동완성, 고르기는 직접). 포커스는 입력칸에 그대로 두고
 * 가리키는 칸만 `aria-activedescendant` 로 옮긴다.
 *
 *   ↓ : 닫혀 있으면 열고 첫 칸 · 열려 있으면 다음 칸(끝에서 첫 칸으로)
 *   ↑ : 닫혀 있으면 열고 끝 칸 · 열려 있으면 앞 칸(첫 칸에서 끝 칸으로)
 *   Esc : 추천 칸(목록 · "맞는 글이 없어요" · "찾는 중…")이 떠 있으면 닫는다. **친 글자는 언제나 그대로 둔다**
 *         (본인 피드백 2026-10-14 — 브라우저의 검색칸은 Esc 로 글자를 지워 "처음으로 돌아갔다"). 닫혀 있으면 아무것도 하지 않는다(`keep`)
 *   Enter : 여기서 다루지 않는다 — 폼 제출이 맡는다(가리킨 칸이 있으면 그 글을 열고, 없으면 검색)
 *
 * **한글 조합 중에 누른 키는 무시한다**(`composing`) — 조합을 끝내는 키가 칸 이동으로 함께 읽히지 않게.
 * 고를 칸이 없으면(0건 · 아직 모름) 열지 않는다.
 */
export type SuggestionKeyAction =
  | { type: 'none' }
  | { type: 'move'; active: number }
  | { type: 'close' }
  /** 브라우저 기본 동작만 막는다(검색칸 Esc = 글자 지우기) */
  | { type: 'keep' }

export function suggestionKeyAction(input: {
  key: string
  /** 고를 수 있는 목록이 펼쳐져 있다 */
  open: boolean
  /** 추천 칸이 무엇이든 떠 있다(목록 · 0건 · 찾는 중). 없으면 `open` 과 같다 */
  popup?: boolean
  active: number
  count: number
  composing: boolean
}): SuggestionKeyAction {
  const { key, open, popup = open, active, count, composing } = input
  if (composing) return { type: 'none' }

  if (key === 'Escape') return open || popup ? { type: 'close' } : { type: 'keep' }

  if (key !== 'ArrowDown' && key !== 'ArrowUp') return { type: 'none' }
  if (count === 0) return { type: 'none' }

  const down = key === 'ArrowDown'
  if (!open || active < 0) return { type: 'move', active: down ? 0 : count - 1 }
  return { type: 'move', active: (active + (down ? 1 : -1) + count) % count }
}
