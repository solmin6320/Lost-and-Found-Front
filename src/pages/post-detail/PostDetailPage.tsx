import { useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { loginPath } from '@/app/authRedirect'
import { usePageGuide } from '@/app/onboarding'
import { paths, readPostDetailEntry, type LoginNoticeState } from '@/app/paths'
import { useAuth } from '@/features/auth'
import { CommentSection } from '@/features/comments'
import {
  MissingPost,
  POST_CATEGORY_LABEL,
  PostGallery,
  PostOwnerPanel,
  PostStatusGuide,
  StatusBadge,
  TypeBadge,
  lostFoundDateLabel,
  toPostId,
  usePostDetail,
  type PostDetailResponse,
} from '@/features/posts'
import { formatDate } from '@/shared/lib/date'
import { isPlainClick } from '@/shared/lib/events'
import { showFlash } from '@/shared/lib/flash'
import { getErrorMessage, hasErrorCode, isApiError } from '@/shared/lib/http'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { ErrorState } from '@/shared/ui/ErrorState'
import { CalendarBlank, CaretLeft, MapPin, Tag } from '@/shared/ui/icons'

import styles from './PostDetailPage.module.css'
import { PostDetailSkeleton } from './PostDetailSkeleton'

/** 이보다 긴 제목(최대 100자)은 한 단계 작게 — 휴대폰에서 제목이 첫 화면을 다 차지하지 않게 */
const LONG_TITLE = 36

/**
 * SCR-03 게시글 상세 · `/posts/:postId` — [4.3] 상세 · [4.6] 상태 변경 · [4.4] 삭제 · [5.1] 댓글
 *
 * 읽는 순서를 고정한다 : 제목 → 이름표 → 사진 → 핵심 정보(장소 · 분실습득일 · 종류) → 본문 → 메타 → (내 글 관리) → 댓글.
 * 넓은 화면(64rem 이상)은 왼쪽에 사진 열을 세워 두고(따라 내려온다), 오른쪽 읽기 열(30~34rem)에 나머지를 둔다.
 *
 * 네 가지 상태 — 로딩(같은 모양의 스켈레톤) · 없는 글(404 · 잘못된 주소) · 오류(서버 message + 다시 시도) ·
 * 권한(내 글 관리 · 댓글 쓰기 · 내 댓글 수정/삭제는 조건이 맞을 때만 **그린다**. 비활성으로 남기지 않는다).
 */
export function PostDetailPage() {
  const postId = toPostId(useParams().postId)
  const detail = usePostDetail(postId)

  // 숫자가 아닌 주소는 요청하지 않는다. 서버에 없는 글(404) · 받아 주지 않는 id(400)도 같은 화면이다
  const missing =
    postId === null ||
    hasErrorCode(detail.error, 'POST_NOT_FOUND') ||
    (isApiError(detail.error) && detail.error.status === 400)

  if (missing) return <MissingPost listHref={paths.postList} className={styles.stateBox} />
  // 받아 둔 글이 있으면 다시 받다 실패해도 그대로 둔다(1분 뒤 다시 받는다)
  if (detail.data) return <PostDetail key={detail.data.id} post={detail.data} />
  if (detail.isError) {
    return (
      <div className={styles.page}>
        <div className={styles.back}>
          <BackToList />
        </div>
        <div className={styles.stateBox}>
          <ErrorState
          message={getErrorMessage(detail.error)}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
          titleAs="h1"
          />
        </div>
      </div>
    )
  }
  return <PostDetailSkeleton />
}

function PostDetail({ post }: { post: PostDetailResponse }) {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [guideOpen, setGuideOpen] = useState(false)
  const guideRef = useRef<HTMLDivElement>(null)

  const viewerId = auth.status === 'authenticated' ? auth.me.id : null
  // 작성자 판정은 회원 id 로. 닉네임은 바뀐다(화면정의서 1.5)
  const isOwner = viewerId !== null && viewerId === post.memberId
  const here = `${location.pathname}${location.search}`

  useDocumentTitle(post.title)

  // 헤더 `서비스 안내`를 여기서 누르면 목록으로 떠나지 않고 이 글의 이름표 안내를 연다
  usePageGuide(() => {
    const root = guideRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    root.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' })
    root.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    setGuideOpen(true)
  })

  // 댓글을 쓰는 도중 로그인이 끊겼다 — 쓰던 글자를 보관했으면 로그인 화면으로(돌아오면 이어서 쓸지 묻는다).
  // 로그인 화면이 이 글을 기록에서 대신한다. 로그인하면 `?redirect=` 로 이 글에 돌아온다
  function handleSessionExpiredWhileWriting(draftSaved: boolean) {
    const notice: LoginNoticeState = {
      notice: draftSaved
        ? '로그인이 만료됐어요. 다시 로그인하세요. 로그인하면 쓰던 댓글을 이어서 쓸 수 있어요.'
        : '로그인이 만료됐어요. 다시 로그인하세요.',
    }
    navigate(loginPath(here), { replace: true, state: notice })
  }

  function handleDeleted(message: string, tone: 'done' | 'info') {
    showFlash(message, tone)
    // 뒤로가기가 지워진 글로 돌아가지 않게 기록을 바꾼다. 내가 쓴 글에서 왔으면 보던 탭으로
    navigate(readPostDetailEntry(location.state).mineHref ?? paths.postList, { replace: true })
  }

  return (
    <div className={styles.page}>
      <div className={styles.back}>
        <BackToList />
      </div>

      <header className={styles.head}>
        <h1 className={styles.title} data-long={post.title.length > LONG_TITLE || undefined}>
          {post.title}
        </h1>
        <div className={styles.badges}>
          {/* 쉼표는 스크린리더가 "분실, 게시중" 으로 끊어 읽게 한다 */}
          <p className={styles.flags}>
            <TypeBadge type={post.type} />
            <span className="sr-only">, </span>
            <StatusBadge status={post.status} />
          </p>
          <div ref={guideRef} className={styles.guide}>
            <PostStatusGuide type={post.type} status={post.status} open={guideOpen} onOpenChange={setGuideOpen} />
          </div>
        </div>
      </header>

      <PostGallery
        className={styles.gallery}
        images={post.images}
        title={post.title}
        type={post.type}
        category={post.category}
        seed={post.id}
      />

      <div className={styles.info}>
        {/* "내 물건인가" 를 가르는 세 가지. 본문보다 먼저, 유형 색의 옅은 면 한 장에 모은다 */}
        <dl className={styles.facts} data-type={post.type}>
          <div className={styles.fact}>
            <dt>
              <MapPin />
              장소
            </dt>
            <dd>{post.location}</dd>
          </div>
          <div className={styles.fact}>
            <dt>
              <CalendarBlank />
              {lostFoundDateLabel(post.type)}
            </dt>
            <dd>
              <time dateTime={post.lostFoundDate}>{formatDate(post.lostFoundDate)}</time>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>
              <Tag />
              종류
            </dt>
            <dd>{POST_CATEGORY_LABEL[post.category]}</dd>
          </div>
        </dl>

        {/* 사용자 입력 원문 — 텍스트로만. 줄바꿈은 살리고 링크로 바꾸지 않는다(보안명세서 · XSS) */}
        <p className={styles.content}>{post.content}</p>

        <dl className={styles.meta}>
          <div>
            <dt>글쓴이</dt>
            <dd>{post.nickname}</dd>
          </div>
          <div>
            <dt>등록</dt>
            <dd>
              <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
            </dd>
          </div>
          <div>
            <dt>조회</dt>
            <dd data-numeric>{post.viewCount.toLocaleString('ko-KR')}</dd>
          </div>
        </dl>

        {isOwner ? <PostOwnerPanel post={post} editHref={paths.postEdit(post.id)} onDeleted={handleDeleted} /> : null}
      </div>

      <div className={styles.comments}>
        <CommentSection
          post={post}
          viewerId={viewerId}
          authPending={auth.status === 'unknown'}
          loginHref={loginPath(here)}
          onSessionExpiredWhileWriting={handleSessionExpiredWhileWriting}
        />
      </div>
    </div>
  )
}

/**
 * [목록으로] — 목록 카드로 들어왔으면 **뒤로 간다**(보던 필터 · 페이지 · 스크롤 그대로).
 * 공유 링크처럼 바로 들어왔으면 목록 첫 화면으로. 새 탭 열기(Ctrl · 가운데 버튼)는 링크 그대로 둔다.
 * 내가 쓴 글(SCR-07)의 카드로 들어왔으면 이름도 `내가 쓴 글` 이다 — 누르면 돌아갈 곳을 말한다
 */
function BackToList() {
  const location = useLocation()
  const navigate = useNavigate()
  const { fromList, mineHref } = readPostDetailEntry(location.state)

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!fromList || !isPlainClick(event)) return
    event.preventDefault()
    navigate(-1)
  }

  return (
    <Link to={mineHref ?? paths.postList} className={styles.backLink} onClick={handleClick}>
      <CaretLeft />
      {mineHref ? '내가 쓴 글' : '목록으로'}
    </Link>
  )
}
