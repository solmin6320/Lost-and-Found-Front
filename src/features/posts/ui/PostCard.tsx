import { Link } from 'react-router-dom'

import { formatDate } from '@/shared/lib/date'
import { MapPin } from '@/shared/ui/icons'

import type { PostListResponse } from '../api/types'
import { lostFoundDateLabel } from '../model/labels'
import styles from './PostCard.module.css'
import { PostThumbnail } from './PostThumbnail'
import { StatusBadge } from './StatusBadge'
import { TypeBadge } from './TypeBadge'

interface PostCardProps {
  post: PostListResponse
  /**
   * 상세 주소. 경로는 app 이 정한다(`paths.postDetail(id)`).
   * 없으면 링크가 아닌 카드다 — 등록 · 수정 화면의 "목록에서 이렇게 보여요" 미리보기
   */
  to?: string
  /** 대표 사진 주소(`PostListResponse.thumbnailUrl`). 없거나 못 불러오면 포스터가 대신한다 */
  thumbnailUrl?: string | null
  /** 목록의 제목 구조에 맞춘다 */
  headingLevel?: 'h2' | 'h3'
  /** 첫 화면에 보이는 카드(목록 첫 줄). 사진을 미루지 않고 바로 받는다 */
  priority?: boolean
  /** 상세로 넘길 기록 상태. 상세의 [목록으로]가 이것을 보고 뒤로 간다(보던 필터 · 스크롤 그대로) */
  linkState?: unknown
}

/**
 * 피드 카드 — 사진(없으면 포스터)이 위, 글이 아래. 눈이 멈추는 순서를 고정한다.
 *   1 사진 + 제목   2 유형(사진 위 배지) · 연락중/완료   3 장소 · 분실습득일
 * 작성자 · 조회수는 싣지 않는다. "내 물건인가" 를 가리는 데 쓰이지 않고, 좁은 두 칸에서 줄만 늘린다.
 *
 * 읽는 순서는 제목 → 배지 → 장소 · 날짜다. 배지는 문서에서 제목 바로 뒤에 두고 CSS 로 사진 위에 올린다.
 * **카드 전체(사진 포함)가 제목 링크 하나다** — 링크의 덮개(`::after`)가 카드를 덮는다. 누르는 곳 · Tab 한 번 · 읽는 이름(제목)이 하나다.
 * 두 줄 자르기(`overflow: hidden`)는 링크 **안쪽** 글자 칸에만 건다. 덮개를 품은 칸을 자르면 브라우저에 따라 덮개가 제목 줄
 * 밖에서 잘려 사진을 눌러도 열리지 않는다(본인 피드백 2026-10-07 "사진을 눌러도 글로 안 들어간다").
 * 사진은 `alt=""` — 제목이 이미 카드의 이름이라 두 번 읽지 않는다.
 * 본문(`content`)은 싣지 않는다 — 응답에도 없다.
 * 소유자 동작(수정·삭제)도 없다. 목록 응답에 `memberId` 가 없어 본인 판정을 할 수 없다.
 */
export function PostCard({
  post,
  to,
  thumbnailUrl,
  headingLevel: Heading = 'h3',
  priority = false,
  linkState,
}: PostCardProps) {
  return (
    <article className={styles.card} data-status={post.status}>
      <div className={styles.body}>
        <Heading className={styles.title}>
          {to ? (
            <Link className={styles.link} to={to} state={linkState}>
              <span className={styles.titleText}>{post.title}</span>
            </Link>
          ) : (
            <span className={styles.titleText}>{post.title}</span>
          )}
        </Heading>

        {/* 게시중은 기본값이라 표시하지 않는다. 연락중 · 완료만 유형 옆에 붙는다.
            두 배지 사이의 쉼표는 스크린리더가 "분실, 연락중" 으로 끊어 읽게 한다 */}
        <p className={styles.flags}>
          <TypeBadge type={post.type} surface="photo" />
          {post.status === 'OPEN' ? null : (
            <>
              <span className="sr-only">, </span>
              <StatusBadge status={post.status} surface="photo" />
            </>
          )}
        </p>

        <dl className={styles.facts}>
          <div className={styles.place}>
            <dt>
              <MapPin className={styles.pin} />
              <span className="sr-only">장소</span>
            </dt>
            <dd>{post.location}</dd>
          </div>
          <div className={styles.date}>
            <dt>{lostFoundDateLabel(post.type)}</dt>
            <dd>
              <time dateTime={post.lostFoundDate}>{formatDate(post.lostFoundDate)}</time>
            </dd>
          </div>
        </dl>
      </div>

      <div className={styles.media}>
        <PostThumbnail
          className={styles.visual}
          category={post.category}
          type={post.type}
          src={thumbnailUrl ?? undefined}
          alt=""
          seed={post.id}
          loading={priority ? 'eager' : 'lazy'}
        />
      </div>
    </article>
  )
}
