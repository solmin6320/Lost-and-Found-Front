import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { loginPath } from '@/app/authRedirect'
import { usePageGuide } from '@/app/onboarding'
import {
  paths,
  POST_COMMENTS_HASH,
  readPostDetailEntry,
  toPostDetailEntry,
  type AuthReturnState,
  type LoginNoticeState,
} from '@/app/paths'
import { useAuth } from '@/features/auth'
import {
  COMMENTS_HEADING_ID,
  CommentEntryButton,
  CommentSection,
  useCommentTotal,
  type CommentEntryHandle,
} from '@/features/comments'
import {
  MissingPost,
  POST_CATEGORY_LABEL,
  PostGallery,
  PostOwnerPanel,
  PostStatusGuide,
  StatusBadge,
  TypeBadge,
  lostFoundDateLabel,
  postDetailQueryOptions,
  postKeys,
  toPostId,
  type PostDetailResponse,
} from '@/features/posts'
import { formatDate } from '@/shared/lib/date'
import { isPlainClick } from '@/shared/lib/events'
import { showFlash } from '@/shared/lib/flash'
import { getErrorMessage, hasErrorCode, isApiError } from '@/shared/lib/http'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { ErrorState } from '@/shared/ui/ErrorState'
import { CaretLeft, CheckCircle } from '@/shared/ui/icons'

import { findListPreview } from './listPreview'
import styles from './PostDetailPage.module.css'
import { LONG_TITLE, PostDetailSkeleton } from './PostDetailSkeleton'

/**
 * SCR-03 게시글 상세 · `/posts/:postId` — [4.3] 상세 · [4.6] 상태 변경 · [4.4] 삭제 · [5.1] 댓글
 *
 * 읽는 순서를 고정한다 : 제목 → 이름표(+ `댓글 쓰기 N`) → (글쓴이면 내 글 관리) → 사진 → 핵심 정보(장소 · 분실습득일 · 종류)
 * → 본문 → 메타 → 댓글.
 * 넓은 화면(64rem 이상)은 왼쪽에 사진 열을 세워 두고(따라 내려온다), 오른쪽 읽기 열(30~34rem)에 나머지를 둔다.
 *
 * 네 가지 상태 — 로딩(같은 모양의 스켈레톤, 목록 카드가 있으면 제목 · 이름표 · 첫 사진을 먼저) · 없는 글(404 · 잘못된 주소) ·
 * 오류(서버 message + 다시 시도) · 권한(내 글 관리 · 댓글 쓰기 · 내 댓글 수정/삭제는 조건이 맞을 때만 **그린다**).
 */
export function PostDetailPage() {
  const postId = toPostId(useParams().postId)
  const location = useLocation()
  const auth = useAuth()
  const queryClient = useQueryClient()

  // 로그인하고 댓글 자리로 돌아왔다(①-b). 받아 둔 상세가 있으면 다시 받지 않는다 — 상세 요청은 조회수를 센다(API2-1).
  // 없으면(5분이 지나 지워짐) 평소처럼 받는다
  const [arrivedForComments] = useState(() => location.hash === POST_COMMENTS_HASH)
  const detail = useQuery({
    ...postDetailQueryOptions(postId ?? 0),
    enabled: postId !== null,
    refetchOnMount: !arrivedForComments,
  })

  // 누른 카드의 머리 — 받아 둔 상세가 없을 때 처음 한 번만 찾는다(API-3)
  const [preview] = useState(() =>
    postId === null || queryClient.getQueryData(postDetailQueryOptions(postId).queryKey)
      ? null
      : findListPreview(queryClient, postId),
  )

  // 숫자가 아닌 주소는 요청하지 않는다. 서버에 없는 글(404) · 받아 주지 않는 id(400)도 같은 화면이다
  const notFound = hasErrorCode(detail.error, 'POST_NOT_FOUND')
  const missing = postId === null || notFound || (isApiError(detail.error) && detail.error.status === 400)

  // 없는 글이다 — 목록 캐시에 남은 그 카드도 다시 받게 한다(지운 글의 제목 · 사진을 머리로 또 그리지 않게)
  useEffect(() => {
    if (notFound) void queryClient.invalidateQueries({ queryKey: postKeys.lists() })
  }, [notFound, queryClient])

  if (missing) return <MissingPost listHref={paths.postList} className={styles.stateBox} />
  // 받아 둔 글이 있으면 다시 받다 실패해도 그대로 둔다(1분 뒤 다시 받는다)
  if (detail.data) return <PostDetail key={detail.data.id} post={detail.data} claimTitleFocus={preview !== null} />
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

  // 글쓴이일 것이 확실하면 내 글 관리 자리를 미리 잡는다 — 응답 뒤 사진 위에 끼어들어 사진이 밀리지 않게
  const fromMine = readPostDetailEntry(location.state).mineHref !== null
  const sameNickname = auth.status === 'authenticated' && preview !== null && preview.nickname === auth.me.nickname
  return <PostDetailSkeleton preview={preview} ownerLikely={fromMine || sameNickname} />
}

interface PostDetailProps {
  post: PostDetailResponse
  /**
   * 목록 카드로 머리를 먼저 그렸다가 진짜 화면으로 바뀌었다. 먼저 그린 제목은 `h1` 이 아니라(SE2-4) 화면 이동 포커스가
   * 진짜 제목을 기다리는데, 응답이 그 기다림(1.5초)보다 늦으면 포커스가 문서 맨 앞에 남는다. 그때 제목으로 데려온다
   */
  claimTitleFocus?: boolean
}

function PostDetail({ post, claimTitleFocus = false }: PostDetailProps) {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [guideOpen, setGuideOpen] = useState(false)
  const guideRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const entryRef = useRef<CommentEntryHandle>(null)
  const [flowEntry, setFlowEntry] = useState<HTMLButtonElement | null>(null)
  const commentTotal = useCommentTotal(post)

  const viewerId = auth.status === 'authenticated' ? auth.me.id : null
  // 작성자 판정은 회원 id 로. 닉네임은 바뀐다(화면정의서 1.5)
  const isOwner = viewerId !== null && viewerId === post.memberId
  const done = post.status === 'DONE'
  const here = `${location.pathname}${location.search}`
  // 로그인 화면이 돌려줄 이 상세의 진입 상태 — 돌아온 상세의 [목록으로]가 보던 목록으로 간다(API2-2)
  const returnState: AuthReturnState = { returnEntry: toPostDetailEntry(location.state) }

  useDocumentTitle(post.title)

  // 사용자가 그사이 다른 곳(Tab · 누름)으로 옮겼으면 두고, 아무 데도 없을 때만 제목으로
  useEffect(() => {
    if (!claimTitleFocus || location.hash === POST_COMMENTS_HASH) return
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement
      if (active && active !== document.body) return
      titleRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [claimTitleFocus, location.hash])

  // 헤더 `서비스 안내`를 여기서 누르면 목록으로 떠나지 않고 이 글의 이름표 안내를 연다
  usePageGuide(() => {
    const root = guideRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    root.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' })
    root.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    setGuideOpen(true)
  })

  // 로그인 권유 칸에서 로그인하고 돌아왔다(`#comments`, 문자열 비교) — "댓글" 제목으로 데려가 거기에 포커스를 둔다.
  // 입력칸이 아니다 : 사용자 동작이 아니라 키보드가 갑자기 화면을 덮을 이유가 없다. 쓰던 댓글을 이어 쓸지 묻는 칸이 먼저 데려갔으면 그쪽이 우선.
  // 조각은 바로 지운다 — 새로고침 · 공유에서 또 끌려가지 않게. 경로가 같아 스크롤 · 화면 이동 포커스는 건드리지 않는다
  useEffect(() => {
    if (location.hash !== POST_COMMENTS_HASH) return
    const frame = requestAnimationFrame(() => {
      const heading = document.getElementById(COMMENTS_HEADING_ID)
      const active = document.activeElement
      const offered = active instanceof HTMLElement && active !== document.body && heading?.closest('section')?.contains(active)
      if (heading && !offered) {
        heading.scrollIntoView({ block: 'start', behavior: 'instant' })
        heading.focus({ preventScroll: true })
      }
      navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true, state: location.state })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.hash, location.pathname, location.search, location.state, navigate])

  // 댓글을 쓰는 도중 로그인이 끊겼다 — 쓰던 글자를 보관했으면 로그인 화면으로(돌아오면 이어서 쓸지 묻는다).
  // 로그인 화면이 이 글을 기록에서 대신한다. 로그인하면 `?redirect=` 로 이 글에 돌아온다
  function handleSessionExpiredWhileWriting(draftSaved: boolean) {
    const notice: LoginNoticeState = {
      notice: draftSaved
        ? '로그인이 만료됐어요. 다시 로그인해 주세요. 로그인하면 쓰던 댓글을 이어서 쓸 수 있어요.'
        : '로그인이 만료됐어요. 다시 로그인해 주세요.',
      ...returnState,
    }
    navigate(loginPath(here), { replace: true, state: notice })
  }

  function handleDeleted(message: string, tone: 'done' | 'info') {
    showFlash(message, tone)
    // 뒤로가기가 지워진 글로 돌아가지 않게 기록을 바꾼다. 내가 쓴 글에서 왔으면 보던 탭으로
    navigate(readPostDetailEntry(location.state).mineHref ?? paths.postList, { replace: true })
  }

  return (
    <div className={styles.page} data-owner={isOwner || undefined}>
      <div className={styles.back}>
        <BackToList />
      </div>

      <header className={styles.head}>
        <h1 ref={titleRef} tabIndex={-1} className={styles.title} data-long={post.title.length > LONG_TITLE || undefined}>
          {post.title}
        </h1>
        <div className={styles.badges}>
          {/* 쉼표는 스크린리더가 "분실, 게시중" 으로 끊어 읽게 한다 */}
          <p className={styles.flags}>
            <TypeBadge type={post.type} />
            <span className="sr-only">, </span>
            <StatusBadge status={post.status} surface="detail" />
          </p>
          {/* 연락 입구(①) — 첫 화면 안, 판단하는 순간 손이 있는 사진 · 이름표 곁. 쓰는 칸으로 데려간다.
              이름표 안내와 한 묶음이라 좁으면 둘이 같이 다음 줄 오른쪽으로 내려간다 */}
          <div className={styles.tools}>
            <CommentEntryButton ref={setFlowEntry} count={commentTotal} onClick={() => entryRef.current?.open()} />
            <div ref={guideRef}>
              <PostStatusGuide type={post.type} status={post.status} open={guideOpen} onOpenChange={setGuideOpen} />
            </div>
          </div>
        </div>
        {/* 끝난 글 — 링크로 들어온 사람에게 가장 먼저 알린다(UI-11). 글쓴이에게는 바로 아래 내 글 관리가 같은 말을 한 번 한다 */}
        {done && !isOwner ? (
          <p className={styles.doneNote}>
            <CheckCircle />
            주인에게 돌아간 물건이에요.
          </p>
        ) : null}
      </header>

      {isOwner ? (
        <div className={styles.owner}>
          <PostOwnerPanel post={post} editHref={paths.postEdit(post.id)} onDeleted={handleDeleted} />
        </div>
      ) : null}

      <PostGallery
        className={styles.gallery}
        images={post.images}
        title={post.title}
        type={post.type}
        category={post.category}
        seed={post.id}
      />

      <div className={styles.info}>
        {/* "내 물건인가" 를 가르는 세 가지. 본문보다 먼저, 유형 색의 옅은 면 한 장에 모은다. 이름표는 글자만(UI-14) */}
        <dl className={styles.facts} data-type={post.type}>
          <div className={styles.fact}>
            <dt>장소</dt>
            <dd>{post.location}</dd>
          </div>
          <div className={styles.fact}>
            <dt>{lostFoundDateLabel(post.type)}</dt>
            <dd>
              <time dateTime={post.lostFoundDate}>{formatDate(post.lostFoundDate)}</time>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>종류</dt>
            <dd>{POST_CATEGORY_LABEL[post.category]}</dd>
          </div>
        </dl>

        {/* 사용자 입력 원문 — 텍스트로만. 줄바꿈은 살리고 링크로 바꾸지 않는다(보안명세서 · XSS) */}
        <p className={styles.content}>{post.content}</p>

        <dl className={styles.meta}>
          <div>
            <dt>글쓴이</dt>
            {/* 닉네임은 방향을 격리한다 — 뒤집는 글자가 옆 칸으로 번지지 않게(SE-6) */}
            <dd>
              <bdi>{post.nickname}</bdi>
            </dd>
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
      </div>

      <div className={styles.comments}>
        <CommentSection
          post={post}
          viewerId={viewerId}
          authPending={auth.status === 'unknown'}
          loginHref={loginPath(`${here}${POST_COMMENTS_HASH}`)}
          loginState={returnState}
          entryRef={entryRef}
          flowEntry={flowEntry}
          onSessionExpiredWhileWriting={handleSessionExpiredWhileWriting}
        />
      </div>
    </div>
  )
}

/**
 * [목록으로] — 목록 카드로 들어왔으면 **뒤로 간다**(보던 필터 · 페이지 · 스크롤 그대로).
 * 공유 링크처럼 바로 들어왔으면 목록 첫 화면으로. 새 탭 열기(Ctrl · 가운데 버튼)는 링크 그대로 둔다.
 * 내가 쓴 글(SCR-07)의 카드로 들어왔으면 이름도 `내가 쓴 글` 이다 — 누르면 돌아갈 곳을 말한다.
 * 로그인을 거쳐 돌아온 상세도 진입 상태를 되받아 뒤로 간다(API2-2)
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
