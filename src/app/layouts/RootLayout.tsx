import { useEffect, useRef, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, matchPath, useLocation } from 'react-router-dom'

import { isAuthScreen } from '@/app/authRedirect'
import { paths } from '@/app/paths'
import { RouteFocus } from '@/app/RouteFocus'
import { ScrollMemory } from '@/app/ScrollMemory'
import { useAuth } from '@/features/auth'
import { intentShowing, postTypeFromQuery } from '@/features/posts'
import { cx } from '@/shared/lib/cx'
import { useDirtyLeaveGuard } from '@/shared/lib/dirtyRegistry'
import { ButtonLink } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { FlashViewport } from '@/shared/ui/Flash'
import { Gear, House, Plus } from '@/shared/ui/icons'
import tip from '@/shared/ui/Tooltip.module.css'

import { AccountMenu } from './AccountMenu'
import { BrandMark, SERVICE_NAME } from './BrandMark'
import styles from './RootLayout.module.css'

/**
 * 모든 화면이 공유하는 껍데기. 헤더 · 본문 · 이탈 확인 하나. 푸터는 두지 않는다(2026-10-07).
 *
 * 헤더 — 로고(목록으로), 오른쪽에 [글 올리기] · [홈](처음 목록으로), 그리고
 *   비로그인 : 설정(톱니) · [로그인](글자 버튼). 화면 모드는 누구나 바꾼다(SCR-08)
 *   로그인   : 계정 메뉴 하나. 설정은 메뉴의 "설정"으로만 간다 — 같은 목적지가 두 곳이면 목표가 넷이 된다(회의 UI-6 c)
 * 누르는 면 사이는 8px(회의 UI-6 a). 휴대폰 폭은 로고 글자를 접어 [홈]에 자리를 내준다(아래 CSS).
 * 서비스 안내(물음표 · 가입 직후 안내)는 2026-10-11 뺐다(본인 결정) — 그 자리는 관리자 권한이 생긴 뒤 공지사항(관리자만 작성)이 받는다.
 * [글 올리기]는 비로그인에게도 보인다. 수정·삭제와 달리 서비스로 들어오는 동선이다(SCR-01).
 *
 * 이탈 확인은 **여기 하나**다(쓰던 칸 등록부). 화면의 칸들은 "쓰던 글자 있음"만 알린다 — `useBlocker` 는 한 번에 하나라
 * 칸마다 붙이면 서로 덮어쓴다(회의 AR2-3). 로그아웃 확인(SE-5)도 같은 등록부를 읽는다.
 */
export function RootLayout() {
  const leave = useDirtyLeaveGuard()

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.wordmark} to={paths.postList}>
            <BrandMark className={styles.mark} />
            <span className={styles.wordmarkText}>{SERVICE_NAME}</span>
          </Link>

          <HeaderActions />
        </div>
      </header>

      <main className={styles.main} id="main">
        <Outlet />
      </main>

      {/* 화면이 바뀌어도 남는 것 — 스크롤 위치 기억 · 새 화면 제목으로 포커스 · 짧은 알림(글 삭제 뒤 목록에서) */}
      <ScrollMemory />
      <RouteFocus />
      <FlashViewport />

      {/* 쓰던 글자를 두고 다른 화면으로 — 로고 · [홈] · 메뉴 · 뒤로가기 모든 출구를 한 번에 막는다. 기본 포커스는 [계속 쓰기] */}
      <ConfirmDialog
        open={leave.blocker.state === 'blocked'}
        title={leave.copy.title}
        confirmLabel="나가기"
        cancelLabel="계속 쓰기"
        onConfirm={() => leave.blocker.proceed?.()}
        onClose={() => {
          if (leave.blocker.state === 'blocked') leave.blocker.reset()
        }}
      >
        <p>{leave.copy.body}</p>
      </ConfirmDialog>
    </div>
  )
}

/**
 * 헤더 오른쪽 묶음 — [글 올리기] · [홈] · 설정 · [로그인](비로그인) 또는 계정 메뉴(로그인). [홈]은 [글 올리기] 바로 뒤(본인 피드백 2026-10-08).
 *
 * **로그인 · 가입 화면에서도 자리는 그대로다**(본인 결정 2026-10-11, 화면정의서 1.10). 그 화면에서는 [글 올리기] · [로그인]을
 * 숨기되 자리를 남긴다(`data-away` — 보이지 않고, 누를 수 없고, 읽히지도 않는다). 그래서 [홈] · 설정이 목록과 **같은 x** 에 선다 —
 * 목록에서 [로그인]을 두 번 눌러도 둘째 누름은 빈자리에 떨어진다(누르는 것이 옮겨 오지 않으니 막 들어온 0.5초를 막을 까닭도 없다).
 * 스크롤바가 생기고 없어지는 것(로그인 ↔ 가입)으로 헤더가 밀리지 않게 하는 것은 `reset.css` 의 `scrollbar-gutter` 다
 */
export function HeaderActions() {
  return (
    <div className={styles.actions}>
      <CreatePostLink />
      <HomeLink />
      <HeaderAuth />
    </div>
  )
}

/**
 * 홈 — 조건 없는 처음 목록(`/`)으로. 로고도 같은 곳으로 가지만, 로고가 눌리는 줄 모르면 처음으로 돌아갈 길이 없다
 * (본인 피드백 2026-10-07 "로고를 눌러야만 홈으로 간다").
 *
 * 오른쪽 묶음의 [글 올리기] 바로 뒤에 둔다(본인 피드백 2026-10-08 — 처음엔 로고 바로 오른쪽이었다).
 * 집 아이콘 + `홈` 글자를 **모든 폭에서** 둔다. 아이콘만이면 터치에서 이름표가 뜨지 않아 무엇인지 모른다.
 * 목록 화면이면(조건이 걸려 있어도) `aria-current="page"` + "지금 여기" 옅은 면 — 설정 톱니의 현재 표시와 같은 말투.
 *
 * 목록에서 누르면 맨 위로 올린다(모션 줄이기면 즉시). 조건 없는 목록이면 주소를 다시 쓰지 않는다 —
 * 같은 주소로 가면 아무 일도 없어 보인다. 새 탭 열기(⌘ · Ctrl · 가운데 누름)는 브라우저에 맡긴다
 */
function HomeLink() {
  const location = useLocation()
  const onList = location.pathname === paths.postList

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!onList || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (location.search === '' && location.hash === '') event.preventDefault()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' })
  }

  return (
    <Link
      to={paths.postList}
      className={styles.home}
      aria-current={onList ? 'page' : undefined}
      onClick={handleClick}
    >
      <House />
      <span>홈</span>
    </Link>
  )
}

/**
 * 비로그인이면 로그인을 거쳐 등록 화면으로 돌아온다.
 * 휴대폰 폭(28rem 미만)에서는 [+] 만 남긴다. 글자는 화면에서만 숨겨 이름으로 남고, 이름표(툴팁)가 대신 보인다.
 * 휴대폰 폭에서는 선만 두른 버튼이다 — 첫 화면의 두 색 면(의도 선택)과 무게를 다투지 않게.
 *
 * **보던 의도를 싣는다**(회의 ②). 목록에서 `잃어버렸어요`를 골라 두었으면(주워진 물건 = `?type=FOUND` 를 보는 중)
 * 이름이 `분실 글 올리기`, 가는 곳이 `?type=LOST` 다 — 결과 끝의 등록 권유와 같은 이름 · 같은 유형(같은 의도는 같은 이름).
 * 휴대폰에서는 스크린리더 이름 · 이름표로, 넓은 화면에서는 글자로 보인다.
 *
 * 등록 · 수정 화면에서는 "지금 여기" 옅은 면을 깐다. 등록 화면에서는 `aria-current="page"` 이고 눌러도 무시한다 —
 * 같은 경로라 이탈 확인을 타지 않고 폼은 `?type` 을 처음 한 번만 읽어, 누르면 주소만 바뀌고 아무 일도 없었다(AR2-9)
 *
 * 로그인 · 가입 화면에서는 **숨기되 자리를 남긴다**([로그인]과 같이, 본인 결정 2026-10-11) — 그 화면에서 할 일은 폼 하나이고,
 * 튀는 것은 폼의 큰 [로그인] · [가입하기] 하나여야 한다(폰 레스토프). 비로그인이 누르면 로그인을 거쳐 오는 입구라 이 화면에선 겉돈다.
 * 자리는 조건 없는 목록과 같은 이름(`글 올리기`)의 폭이다 — [홈] · 설정이 목록과 같은 x 에 선다(`HeaderActions`).
 * `inert` + `aria-hidden` + `visibility: hidden`(CSS `data-away`) — 보이지도, 눌리지도, Tab 으로 닿지도, 읽히지도 않는다
 */
function CreatePostLink() {
  const auth = useAuth()
  const location = useLocation()
  const onList = location.pathname === paths.postList
  const intent = onList ? intentShowing(postTypeFromQuery(new URLSearchParams(location.search).get('type')) ?? undefined) : undefined
  const target = intent ? paths.postCreateAs(intent.concept) : paths.postCreate
  const to = auth.status === 'anonymous' ? paths.loginThenReturn(target) : target
  const label = intent?.next.action ?? '글 올리기'

  const onCreate = location.pathname === paths.postCreate
  const onEdit = matchPath(paths.postEdit(':postId'), location.pathname) !== null

  if (isAuthScreen(location.pathname)) {
    return (
      <ButtonLink
        to={paths.postCreate}
        variant="secondary"
        size="sm"
        className={styles.create}
        data-away=""
        aria-hidden="true"
        tabIndex={-1}
        inert
      >
        <Plus />
        <span className={styles.createLabel}>글 올리기</span>
      </ButtonLink>
    )
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (onCreate) event.preventDefault()
  }

  return (
    <ButtonLink
      to={to}
      variant="secondary"
      size="sm"
      className={cx(styles.create, tip.host)}
      data-here={onCreate || onEdit ? '' : undefined}
      aria-current={onCreate ? 'page' : undefined}
      onClick={handleClick}
    >
      <Plus />
      <span className={styles.createLabel}>{label}</span>
      <span className={cx(tip.tip, styles.createTip)} aria-hidden="true">
        {label}
      </span>
    </ButtonLink>
  )
}

/**
 * 설정 — 톱니. 휴대폰 폭에서는 아이콘만(이름은 aria-label, 마우스 · 키보드에는 이름표), 48rem 이상은 글자도 둔다.
 * 지금 설정 화면이면 NavLink 가 `aria-current="page"` 를 붙인다
 */
function SettingsLink() {
  return (
    <NavLink to={paths.settings} className={cx(styles.settings, tip.host)} aria-label="설정">
      <Gear />
      <span className={styles.settingsLabel}>설정</span>
      <span className={cx(tip.tip, styles.settingsTip)} aria-hidden="true">
        설정
      </span>
    </NavLink>
  )
}

/**
 * 세션 복구 중(`unknown`)에는 자리만 잡는다. [로그인]을 먼저 그렸다가 닉네임으로 바꾸면
 * 로그인한 사용자에게 매번 "로그아웃됐나?" 하는 깜빡임이 보인다.
 *
 * 비로그인 : 설정(톱니) + [로그인]. [로그인]은 테두리 없는 글자 버튼(누르는 면 44px) — 선 상자는 [+] 하나만 남는다(회의 UI-6 b).
 *   로그인 · 가입 화면에서는 [로그인]을 숨기되 자리를 남긴다(지금 그 화면이다 — 같은 목적지를 또 두지 않는다). [+ 글 올리기]도
 *   같이 숨긴다 — [홈] · 설정이 목록과 같은 x 에 선다(본인 결정 2026-10-11, 화면정의서 1.10).
 *
 * 계정 메뉴에서 로그아웃하면 메뉴(와 누르던 버튼)가 사라진다. 그 자리에 생긴 [로그인]으로 포커스를 옮긴다 —
 * 그냥 두면 문서 맨 앞으로 빠진다. 로그아웃하며 다른 화면으로 옮겨지면(내가 쓴 글 → 로그인) 새 화면의 제목이 가져간다(RouteFocus)
 */
function HeaderAuth() {
  const auth = useAuth()
  const location = useLocation()
  const loginRef = useRef<HTMLAnchorElement>(null)
  const focusLogin = useRef(false)

  useEffect(() => {
    if (auth.status !== 'anonymous' || !focusLogin.current) return
    focusLogin.current = false
    // 헤더는 sticky 다. 그냥 focus() 하면 Chrome 이 헤더의 제자리로 스크롤을 끌어 올려 읽던 곳을 잃는다
    loginRef.current?.focus({ preventScroll: true })
  }, [auth.status])

  async function logout() {
    focusLogin.current = true
    await auth.logout()
  }

  // 로그인 · 가입 화면 — 설정 + [로그인] 빈자리(같은 글자 · 같은 폭이라 목록의 [로그인]과 꼭 같은 칸). 세션 복구 중에도 같은 모양으로
  // 바로 그린다(자리 잡기 → 설정으로 바뀌며 [홈]이 밀리지 않게). 로그인돼 있으면 화면이 곧 돌려보내므로 아래 계정 메뉴로 간다
  if (isAuthScreen(location.pathname) && auth.status !== 'authenticated') {
    return (
      <>
        <SettingsLink />
        <span className={styles.login} data-away="" aria-hidden="true">
          로그인
        </span>
      </>
    )
  }

  if (auth.status === 'unknown') {
    return <span className={styles.authPending} aria-hidden="true" />
  }

  if (auth.status === 'anonymous') {
    const here = `${location.pathname}${location.search}`
    const to = here === paths.postList ? paths.login : paths.loginThenReturn(here)

    return (
      <>
        <SettingsLink />
        <Link ref={loginRef} to={to} className={styles.login}>
          로그인
        </Link>
      </>
    )
  }

  // 화면을 옮기면 펼친 메뉴를 닫는다
  return <AccountMenu key={location.pathname} me={auth.me} onLogout={logout} />
}
