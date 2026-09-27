import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { openPageGuide, requestGuide } from '@/app/onboarding'
import { paths } from '@/app/paths'
import { ScrollMemory } from '@/app/ScrollMemory'
import { useAuth } from '@/features/auth'
import { cx } from '@/shared/lib/cx'
import { ButtonLink } from '@/shared/ui/Button'
import { FlashViewport } from '@/shared/ui/Flash'
import { Gear, Plus, Question } from '@/shared/ui/icons'
import tip from '@/shared/ui/Tooltip.module.css'

import { AccountMenu } from './AccountMenu'
import styles from './RootLayout.module.css'

/**
 * 모든 화면이 공유하는 껍데기. 헤더 · 본문 · 푸터.
 *
 * 헤더는 다섯만 둔다 — 로고(목록으로), [글 올리기], 서비스 안내(물음표), 설정(톱니), 로그인/계정.
 * [글 올리기]는 비로그인에게도 보인다. 수정·삭제와 달리 서비스로 들어오는 동선이다(SCR-01).
 * 서비스 안내 · 설정도 비로그인에게 보인다 — 안내는 누구나 다시 보고, 화면 모드는 누구나 바꾼다(SCR-08).
 */
export function RootLayout() {
  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.wordmark} to={paths.postList}>
            <BrandMark />
            <span className={styles.wordmarkText}>분실물 찾기</span>
          </Link>

          <div className={styles.actions}>
            <CreatePostLink />
            <GuideButton />
            <SettingsLink />
            <HeaderAuth />
          </div>
        </div>
      </header>

      <main className={styles.main} id="main">
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>분실물 찾기 · 개인 프로젝트</div>
      </footer>

      {/* 화면이 바뀌어도 남는 것 — 스크롤 위치 기억 · 짧은 알림(글 삭제 뒤 목록에서) */}
      <ScrollMemory />
      <FlashViewport />
    </div>
  )
}

/**
 * 비로그인이면 로그인을 거쳐 등록 화면으로 돌아온다.
 * 좁은 화면(24rem 미만)에서는 [+] 만 남긴다. 글자는 화면에서만 숨겨 이름으로 남고, 이름표(툴팁)가 대신 보인다.
 * 휴대폰 폭에서는 선만 두른 버튼이다 — 첫 화면의 두 색 면(의도 선택)과 무게를 다투지 않게.
 */
function CreatePostLink() {
  const auth = useAuth()
  const to =
    auth.status === 'anonymous' ? paths.loginThenReturn(paths.postCreate) : paths.postCreate

  return (
    <ButtonLink
      to={to}
      variant="secondary"
      size="sm"
      className={cx(styles.create, tip.host)}
      // 온보딩 3단계가 가리키는 자리
      data-guide="create"
    >
      <Plus />
      <span className={styles.createLabel}>글 올리기</span>
      <span className={cx(tip.tip, styles.createTip)} aria-hidden="true">
        글 올리기
      </span>
    </ButtonLink>
  )
}

/**
 * 서비스 안내 — 온보딩 1층을 언제든 다시 연다(docs/온보딩설계.md 2장). 안내는 목록 위에 뜬다 —
 * 다른 화면이면 목록으로 가면서 요청을 남기고, 목록이 요청을 가져가며 연다. 닫으면 이 버튼으로 포커스가 돌아온다.
 * 그 화면에 자기 안내가 있으면(상세의 `이름표 안내`) 목록으로 떠나지 않고 그것을 연다 — 보던 글을 잃지 않는다.
 * 모양은 설정과 같다 — 휴대폰 폭에서는 물음표만(이름은 aria-label, 마우스 · 키보드에는 이름표), 48rem 이상은 글자도.
 */
function GuideButton() {
  const location = useLocation()
  const navigate = useNavigate()

  function handleClick() {
    if (location.pathname !== paths.postList && openPageGuide()) return
    requestGuide()
    if (location.pathname !== paths.postList) navigate(paths.postList)
  }

  return (
    <button type="button" className={cx(styles.settings, tip.host)} aria-label="서비스 안내" onClick={handleClick}>
      <Question />
      <span className={styles.settingsLabel}>서비스 안내</span>
      <span className={cx(tip.tip, styles.settingsTip)} aria-hidden="true">
        서비스 안내
      </span>
    </button>
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
 */
function HeaderAuth() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'unknown') {
    return <span className={styles.authPending} aria-hidden="true" />
  }

  if (auth.status === 'anonymous') {
    const here = `${location.pathname}${location.search}`
    const onAuthScreen = location.pathname === paths.login || location.pathname === paths.signup
    const to = here === paths.postList || onAuthScreen ? paths.login : paths.loginThenReturn(here)

    return (
      <ButtonLink to={to} variant="secondary" size="sm" className={styles.login}>
        로그인
      </ButtonLink>
    )
  }

  // 화면을 옮기면 펼친 메뉴를 닫는다
  return <AccountMenu key={location.pathname} me={auth.me} onLogout={auth.logout} />
}

/**
 * 꼬리표 두 장. 보관소에서 물건에 다는 이름표다 — 잃어버린 쪽(마리골드)과 주운 쪽(코발트)이 겹친다.
 * 서비스의 표지라 이 자리(와 파비콘)에만 쓴다. 다른 화면의 장식으로 되풀이하지 않는다.
 */
function BrandMark() {
  const tag =
    'M12 1.8 17.3 6.3a1.6 1.6 0 0 1 .6 1.23V20.4a1.6 1.6 0 0 1-1.6 1.6H7.7a1.6 1.6 0 0 1-1.6-1.6V7.53a1.6 1.6 0 0 1 .6-1.23Z'
  return (
    <svg className={styles.mark} viewBox="0 0 30 24" aria-hidden="true" focusable="false">
      <g transform="translate(7.5 0.4) rotate(14 12 12)">
        <path d={tag} fill="var(--found-face)" />
        <circle cx="12" cy="7.9" r="1.65" fill="var(--surface)" />
      </g>
      <g transform="translate(-0.5 0.6) rotate(-12 12 12)">
        <path d={tag} fill="var(--lost-face)" stroke="var(--surface)" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="7.9" r="1.65" fill="var(--surface)" />
      </g>
    </svg>
  )
}
