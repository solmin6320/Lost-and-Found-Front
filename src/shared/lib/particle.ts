/** 조사 한 쌍 — [받침 있을 때, 없을 때] */
const PAIRS = {
  을: ['을', '를'],
  은: ['은', '는'],
  이: ['이', '가'],
  으로: ['으로', '로'],
} as const

export type Particle = keyof typeof PAIRS

/** ㄹ 받침의 번호. `으로`만 ㄹ 받침을 받침 없음처럼 쓴다 — "글로" · "목록으로" */
const RIEUL = 8

/**
 * 낱말 끝 받침에 맞는 조사 — `particle('분실일', '을')` → `을`, `particle('날짜', '을')` → `를`.
 * 조사만 돌려준다(낱말은 부른 쪽이 붙인다 — 낱말만 굵게 쓰는 문장이 있다).
 * 끝 글자가 한글이 아니면(숫자 · 영문) 받침 없는 쪽을 쓴다.
 */
export function particle(word: string, kind: Particle): string {
  const [withFinal, withoutFinal] = PAIRS[kind]
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (!(code >= 0 && code <= 0xd7a3 - 0xac00)) return withoutFinal
  const final = code % 28
  if (final === 0 || (kind === '으로' && final === RIEUL)) return withoutFinal
  return withFinal
}
