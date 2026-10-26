import { useEffect, useId, useRef, useState, type FocusEvent } from 'react'
import { NavLink } from 'react-router-dom'

import { paths } from '@/app/paths'
import { useMyRole } from '@/features/auth'
import type { MemberResponse } from '@/features/members'
import { useNotificationCenter } from '@/features/notifications'
import { cx } from '@/shared/lib/cx'
import { CaretDown, User } from '@/shared/ui/icons'
import { LoadingDots } from '@/shared/ui/LoadingDots'

import styles from './AccountMenu.module.css'
import { STAY_SIGNED_IN_NOTE, useGuardedLogout } from './useGuardedLogout'

interface AccountMenuProps {
  me: MemberResponse
  /** 던지지 않는다(`useAuth().logout`) */
  onLogout: () => Promise<void>
}

/**
 * 로그인한 사용자의 헤더 메뉴. 펼침 버튼 + 링크 목록(disclosure)이다.
 * `role="menu"` 를 쓰지 않는다 — 화살표 키 조작을 약속하게 되는데, 항목이 셋뿐인 링크 목록에는 Tab 이 맞다.
 *
 * 로그인하면 헤더에 설정 톱니가 없다 — 설정은 이 메뉴의 "설정" 하나로 간다(회의 UI-6 c, 같은 목적지가 두 곳이면 헤더 목표가 넷).
 * [로그아웃] 바로 아래 흐린 한 줄이 7일 로그인 유지를 알린다(SE-9). 쓰던 글자가 있으면 로그아웃 전에 묻는다(SE-5).
 *
 * 닫히는 때 : 다시 누름 · Esc(버튼으로 포커스 복귀) · 바깥 누름 · 포커스가 밖으로 나감 · 항목 선택
 */
export function AccountMenu({ me, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const role = useMyRole()
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const noteId = useId()
  // 끝나면 이 메뉴는 사라지고 헤더가 [로그인]으로 포커스를 옮긴다(RootLayout)
  const logout = useGuardedLogout(onLogout)
  // 알림 — 헤더가 아주 좁을 때(종이 숨을 때) 이 메뉴가 입구다(본인 결정 2026-10-25, SCR-10). 로그인했으면 늘 있다
  const notice = useNotificationCenter()
  const { loggingOut, confirmOpen } = logout

  useEffect(() => {
    // 로그아웃을 묻는 창이 떠 있는 동안은 창이 Esc · 바깥 누름을 맡는다(메뉴는 그대로 두어 닫히면 [로그아웃]으로 돌아온다)
    if (!open || confirmOpen) {
      return
    }
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, confirmOpen])

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (confirmOpen) return
    const next = event.relatedTarget
    if (next instanceof Node && !event.currentTarget.contains(next)) {
      setOpen(false)
    }
  }

  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className={styles.account} onBlur={handleBlur}>
      {/*
        이름은 글자에서 나온다(aria-label 이 아니다) — 헤더가 아주 좁을 때만 보이는 조각(`.compactOnly`)이 이름에도 들고 나야
        배지와 같은 수를 읽는다. 넓을 때 그 조각은 display: none 이라 이름에서도 빠진다
      */}
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <User />
        <span className={styles.name} aria-hidden="true">
          {me.nickname}
        </span>
        {notice && notice.total ? (
          <>
            {/* 이름 조각을 통째로 둘 — 넓을 때 · 좁을 때 하나만 남는다(따로 떨어진 조각을 이으면 "메뉴 , 안 읽은"처럼 빈칸이 끼었다) */}
            <span className={cx('sr-only', styles.wideOnly)}>{`${me.nickname} 계정 메뉴`}</span>
            <span className={cx('sr-only', styles.compactOnly)}>{`${me.nickname} 계정 메뉴, ${notice.label.replace(/^알림, /, '')}`}</span>
            <span className={cx(styles.badge, styles.compactOnly)} aria-hidden="true">
              {notice.badge}
            </span>
          </>
        ) : (
          <span className="sr-only">{`${me.nickname} 계정 메뉴`}</span>
        )}
        <CaretDown className={styles.chevron} />
      </button>

      {open ? (
        <div id={panelId} className={styles.panel}>
          <p className={styles.who}>
            <strong>{me.nickname}</strong>
            <span>{me.email}</span>
          </p>
          <ul role="list">
            {notice ? (
              // 헤더가 아주 좁을 때만 — 종 대신 여기서 같은 알림 칸을 연다. 닫으면 계정 단추로 포커스가 돌아온다
              <li className={styles.compactOnly}>
                <button
                  type="button"
                  className={styles.item}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setOpen(false)
                    notice.toggle(toggleRef.current)
                  }}
                >
                  알림
                  {notice.badge ? (
                    <>
                      <span className={styles.itemCount} aria-hidden="true">
                        {notice.badge}
                      </span>
                      <span className="sr-only">{`, ${notice.label.replace(/^알림, /, '')}`}</span>
                    </>
                  ) : null}
                </button>
              </li>
            ) : null}
            <li>
              <NavLink className={styles.item} to={paths.myPage} end onClick={close}>
                내가 쓴 글
              </NavLink>
            </li>
            <li>
              <NavLink className={styles.item} to={paths.settings} onClick={close}>
                설정
              </NavLink>
            </li>
            {/* 관리자에게만(토큰의 역할 — 화면 표시용, 막는 것은 서버). 섹션이 늘어도 입구는 이것 하나다(SCR-19) */}
            {role === 'ADMIN' ? (
              <li>
                <NavLink className={styles.item} to={paths.admin.index} onClick={close}>
                  관리자
                </NavLink>
              </li>
            ) : null}
          </ul>
          <div className={styles.divider} aria-hidden="true" />
          <button
            type="button"
            className={styles.item}
            onClick={logout.request}
            // 잠그지 않는다 — 누르던 버튼이 잠기면 포커스가 문서 맨 앞으로 빠진다
            aria-disabled={loggingOut || undefined}
            aria-describedby={noteId}
          >
            {loggingOut ? (
              // 기다리는 동안 — 글자는 그대로, 0.3초가 넘으면 뒤에 점 셋(버튼과 같은 표시). 이름은 "로그아웃하는 중"
              <>
                <span aria-hidden="true">로그아웃</span>
                <span className="sr-only">로그아웃하는 중</span>
                <LoadingDots announce={false} className={styles.itemDots} />
              </>
            ) : (
              '로그아웃'
            )}
          </button>
          <p id={noteId} className={styles.note}>
            {STAY_SIGNED_IN_NOTE}
          </p>
        </div>
      ) : null}
      {logout.dialog}
    </div>
  )
}
