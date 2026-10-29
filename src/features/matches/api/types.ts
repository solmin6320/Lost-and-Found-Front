/**
 * 자동 매칭 응답 타입(7.6 ②).
 * 원본 : Lost-and-Found `dto/response/MatchResponse` · `service/MatchService.getMatches`
 *
 * 점수(`PostMatch.score`)는 서버 정렬에만 쓰고 응답에 없다 — 화면에 일치율을 만들지 않는다(화면정의서 SCR-11).
 * 후보는 이미 걸러져 온다 : 반대 유형 · 같은 종류 · 분실일 ≤ 습득일 ≤ 분실일 + 14일 · 게시중 · 내가 숨기지 않은 것, 점수 높은 순
 */

import type { PostCategory, PostType } from '@/features/posts'

export interface MatchResponse {
  /** 후보 글 id — 누르면 그 글 상세, 숨길 때 `candidatePostId` */
  postId: number
  /** 후보 글의 유형. 내 글의 반대쪽이다 */
  type: PostType
  title: string
  /** 내 글과 늘 같다(서버가 같은 종류만 고른다) */
  category: PostCategory
  location: string
  /** `yyyy-MM-dd` */
  lostFoundDate: string
  /** 대표 사진 주소. 없으면 `null` — 포스터가 대신한다 */
  thumbnailUrl: string | null
  /** 분실일과 습득일의 차(0 이상, 일) */
  daysApart: number
  /** 장소 글자가 비슷하다(서버 낱말 겹침 0.3 이상) */
  similarPlace: boolean
  /** 제목 글자가 비슷하다(같은 기준) */
  similarText: boolean
}
