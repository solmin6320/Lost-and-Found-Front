import { PostThumbnail, StatusBadge, TypeBadge, type PostListResponse } from '@/features/posts'
import { CaretLeft } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import styles from './PostDetailPage.module.css'

/** 이보다 긴 제목은 한 단계 작게(상세와 같은 값) */
export const LONG_TITLE = 36

interface PostDetailSkeletonProps {
  /**
   * 방금 누른 목록 카드(API-3). 있으면 제목 · 이름표 · 첫 사진을 먼저 그린다 — 누른 카드가 그 모습 그대로 열린다.
   * 본문 · 사진 넘김 · 내 글 관리 · 댓글은 진짜 응답이 온 뒤에
   */
  preview?: PostListResponse | null
  /** 글쓴이일 것이 확실하다(내가 쓴 글에서 왔다 · 닉네임이 같다). 내 글 관리 자리를 미리 잡아 사진이 밀리지 않게 */
  ownerLikely?: boolean
}

/**
 * 실제 화면과 같은 자리 · 같은 크기. 불러오면 그 자리에 글이 들어앉는다.
 *
 * 두 곳에서 쓴다 — 글을 받는 동안(상세 화면 안), 그리고 상세 화면 코드를 처음 받는 동안(라우트의 대체 화면).
 * 따로 떼어 둔 까닭이 뒤쪽이다 : 상세 화면은 나중에 받는 조각(lazy)이라, 대체 화면이 그 조각 안에 있으면 쓸 수 없다.
 * 두 단계가 같은 모양이라 코드 → 데이터로 넘어가도 화면이 한 번도 바뀌지 않는다.
 *
 * 목록 카드로 먼저 그린 제목은 **제목(`h1`)이 아니다**(SE2-4). 진짜 응답이 오면 요소가 바뀌는데, 거기에 포커스가 가 있으면
 * 문서 맨 앞으로 빠진다. 화면 이동 포커스(RouteFocus)는 진짜 제목을 기다린다. 탭 제목도 진짜 응답 뒤에 바뀐다.
 * 스크린리더에는 "불러오는 중"만 읽힌다(옛 제목을 읽히지 않는다)
 */
export function PostDetailSkeleton({ preview, ownerLikely = false }: PostDetailSkeletonProps = {}) {
  return (
    <div className={styles.page} data-owner={ownerLikely || undefined} aria-busy="true">
      <p className="sr-only" role="status">
        글을 불러오는 중입니다
      </p>
      <div className={styles.back}>
        <span className={styles.backLink} aria-hidden="true">
          <CaretLeft />
          목록으로
        </span>
      </div>
      <div className={styles.head} aria-hidden={preview ? true : undefined}>
        {preview ? (
          <p className={styles.title} data-long={preview.title.length > LONG_TITLE || undefined}>
            {preview.title}
          </p>
        ) : (
          <div className={styles.title}>
            <Skeleton shape="text" width="92%" />
            <Skeleton shape="text" width="54%" />
          </div>
        )}
        <div className={styles.badges}>
          <p className={styles.flags}>
            {preview ? (
              <>
                <TypeBadge type={preview.type} />
                <StatusBadge status={preview.status} surface="detail" />
              </>
            ) : (
              <>
                <Skeleton width="2.5rem" height="1.375rem" />
                <Skeleton width="3.75rem" height="1.375rem" />
              </>
            )}
          </p>
        </div>
      </div>
      {ownerLikely ? (
        <div className={styles.owner}>
          <Skeleton className={styles.skeletonPanel} />
        </div>
      ) : null}
      <div className={styles.gallery}>
        {preview ? <PreviewPhoto preview={preview} /> : <Skeleton className={styles.skeletonPhoto} />}
      </div>
      <div className={styles.info}>
        <div className={styles.facts}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.fact}>
              <Skeleton shape="text" width="3.5rem" />
              <Skeleton shape="text" width={i === 0 ? '80%' : '40%'} />
            </div>
          ))}
        </div>
        <div className={styles.content}>
          <Skeleton shape="text" width="100%" />
          <Skeleton shape="text" width="96%" />
          <Skeleton shape="text" width="88%" />
          <Skeleton shape="text" width="62%" />
        </div>
      </div>
    </div>
  )
}

/**
 * 목록에서 이미 받은 대표 사진(첫 장과 같은 주소) — 바로 뜬다. 상세와 같은 상자(1:1, 태블릿 4:3)에 자르지 않고 놓는다.
 * 사진이 없는 글은 목록과 같은 포스터
 */
function PreviewPhoto({ preview }: { preview: PostListResponse }) {
  if (!preview.thumbnailUrl) {
    return (
      <PostThumbnail
        className={styles.skeletonPhoto}
        category={preview.category}
        type={preview.type}
        alt=""
        seed={preview.id}
      />
    )
  }
  return (
    <div className={styles.previewPhoto}>
      <img className={styles.previewBackdrop} src={preview.thumbnailUrl} alt="" width={800} height={800} decoding="async" />
      <img className={styles.previewImage} src={preview.thumbnailUrl} alt="" width={800} height={800} decoding="async" />
    </div>
  )
}
