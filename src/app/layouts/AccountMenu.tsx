import { useEffect, useId, useRef, useState, type FocusEvent } from 'react'
import { NavLink } from 'react-router-dom'

import { paths } from '@/app/paths'
import type { MemberResponse } from '@/features/members'
import { CaretDown, User } from '@/shared/ui/icons'

import styles from './AccountMenu.module.css'

interface AccountMenuProps {
  me: MemberResponse
  /** 던지지 않는다(`useAuth().logout`) */
  onLogout: () => Promise<void>
}

/**
 * 로그인한 사용자의 헤더 메뉴. 펼침 버튼 + 링크 목록(disclosure)이다.
 * `role="menu"` 를 쓰지 않는다 — 화살표 키 조작을 약속하게 되는데, 항목이 셋뿐인 링크 목록에는 Tab 이 맞다.
 *
 * 닫히는 때 : 다시 누름 · Esc(버튼으로 포커스 복귀) · 바깥 누름 · 포커스가 밖으로 나감 · 항목 선택
 */
export function AccountMenu({ me, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) {
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
  }, [open])

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && !event.currentTarget.contains(next)) {
      setOpen(false)
    }
  }

  async function handleLogout() {
    // 되돌릴 수 있는 동작이라 확인하지 않는다(화면정의서 1.10). 요청이 겹치지 않게 누름만 무시한다.
    // 끝나면 이 메뉴는 사라지고 헤더가 [로그인]으로 포커스를 옮긴다(RootLayout)
    if (loggingOut) return
    setLoggingOut(true)
    await onLogout()
    setLoggingOut(false)
    setOpen(false)
  }

  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className={styles.account} onBlur={handleBlur}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${me.nickname} 계정 메뉴`}
        onClick={() => setOpen((value) => !value)}
      >
        <User />
        <span className={styles.name}>{me.nickname}</span>
        <CaretDown className={styles.chevron} />
      </button>

      {open ? (
        <div id={panelId} className={styles.panel}>
          <p className={styles.who}>
            <strong>{me.nickname}</strong>
            <span>{me.email}</span>
          </p>
          <ul role="list">
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
          </ul>
          <div className={styles.divider} aria-hidden="true" />
          <button
            type="button"
            className={styles.item}
            onClick={handleLogout}
            // 잠그지 않는다 — 누르던 버튼이 잠기면 포커스가 문서 맨 앞으로 빠진다
            aria-disabled={loggingOut || undefined}
          >
            {loggingOut ? '로그아웃하는 중…' : '로그아웃'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
