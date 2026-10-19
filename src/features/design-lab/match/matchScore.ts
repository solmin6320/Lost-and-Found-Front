import type { LabMatchSource } from '@/app/lab/LabSlot'
import type { PostListResponse } from '@/features/posts'

import { distanceKm, pointOf } from '../map/coords'

/**
 * 시안용 일치율 — 화면을 그리려고 흉내 낸 점수다. 실제 점수 · 이유는 백엔드 매칭이 준다
 * (카테고리 · 날짜 근접 · 장소 · 제목 · 본문 n-gram, `GET /api/posts/{id}/matches` 초안).
 */
export type MatchReasonKind = 'CATEGORY' | 'DATE' | 'PLACE' | 'WORDS'

export interface MatchReason {
  kind: MatchReasonKind
  /** 화면 문장 */
  text: string
  /** 내 글 값 · 이 글 값(비교 시안) */
  mine?: string
  theirs?: string
  matched: boolean
}

export interface MatchCandidate {
  post: PostListResponse
  /** 0 ~ 100 */
  score: number
  reasons: MatchReason[]
}

const CATEGORY_WORD: Record<string, string> = { WALLET: '지갑', ELECTRONICS: '전자기기', CARD: '카드', CLOTHES: '옷', ETC: '기타' }

function bigrams(text: string) {
  const plain = text.replace(/\s+/g, '')
  const set = new Set<string>()
  for (let i = 0; i < plain.length - 1; i += 1) set.add(plain.slice(i, i + 2))
  return set
}

function days(a: string, b: string) {
  return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000)
}

const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

export function scoreCandidates(source: LabMatchSource, candidates: readonly PostListResponse[], limit = 4): MatchCandidate[] {
  const sourcePoint = pointOf({ ...source, nickname: '', status: 'OPEN', viewCount: 0, createdAt: '', thumbnailUrl: null })
  const sourceWords = bigrams(source.title)
  return candidates
    .filter((post) => post.type !== source.type && post.status !== 'DONE')
    .map((post) => {
      const reasons: MatchReason[] = []
      let score = 0
      const sameCategory = post.category === source.category
      if (sameCategory) score += 50
      reasons.push({ kind: 'CATEGORY', text: sameCategory ? `같은 종류(${CATEGORY_WORD[post.category]})` : `종류가 달라요(${CATEGORY_WORD[post.category]})`, mine: CATEGORY_WORD[source.category], theirs: CATEGORY_WORD[post.category], matched: sameCategory })

      const gap = days(source.lostFoundDate, post.lostFoundDate)
      score += Math.max(0, 28 - gap * 4)
      reasons.push({ kind: 'DATE', text: gap === 0 ? '같은 날' : `${gap}일 차이`, mine: shortDate(source.lostFoundDate), theirs: shortDate(post.lostFoundDate), matched: gap <= 3 })

      const point = pointOf(post)
      if (sourcePoint && point) {
        const km = distanceKm([sourcePoint.lat, sourcePoint.lng], [point.lat, point.lng])
        score += Math.max(0, 22 - km * 2)
        reasons.push({ kind: 'PLACE', text: km < 1 ? `${Math.round(km * 1000)}m 거리` : `${km.toFixed(1)}km 거리`, mine: source.location, theirs: post.location, matched: km <= 3 })
      }

      const words = bigrams(post.title)
      const shared = [...words].filter((w) => sourceWords.has(w)).length
      const jaccard = shared / Math.max(1, new Set([...words, ...sourceWords]).size)
      score += Math.round(jaccard * 30)
      if (shared >= 2) reasons.push({ kind: 'WORDS', text: '제목 낱말이 겹쳐요', matched: true })

      return { post, score: Math.min(97, Math.round(score)), reasons }
    })
    .filter((c) => c.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** 일치율을 세 단계 말로(숫자만으로는 얼마나 믿어야 할지 모른다) */
export function scoreWord(score: number) {
  if (score >= 75) return '높음'
  if (score >= 55) return '보통'
  return '낮음'
}
