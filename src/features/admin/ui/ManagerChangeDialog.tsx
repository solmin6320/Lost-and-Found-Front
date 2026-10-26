import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'

import type { AdminMemberResponse, ManagerChange } from '../api/types'
import { managerChangeCopy } from '../model/managerChange'
import styles from './ManagerChangeDialog.module.css'

export interface ManagerChangeTarget {
  member: AdminMemberResponse
  change: ManagerChange
}

interface ManagerChangeDialogProps {
  /** 묻는 대상. `null` 이면 닫혀 있다 — 닫히는 동안에도 마지막 대상을 넘겨 문장이 비지 않게 한다(`open` 으로 가른다) */
  target: ManagerChangeTarget | null
  open: boolean
  pending: boolean
  /** 창을 열어 둔 채 보여 줄 서버 `message`(연결 끊김 · 서버 오류). 낡은 줄 · 권한 없음은 부른 쪽이 창을 닫고 따로 알린다 */
  error: string | null
  onConfirm: () => void
  onClose: () => void
  /** 닫힌 뒤 연 버튼이 사라졌으면(역할 탭에서 줄이 빠짐 · 회원이 없어짐) 포커스를 줄 곳 */
  fallbackFocus: () => HTMLElement | null
}

/**
 * 임명 · 해임 확인 — 누르기 **전에** 결과를 한 번, 숫자까지(화면정의서 1.6). 기본 포커스는 `[취소]`, 열린 직후 0.5초의 누름은 흘려보낸다(`ConfirmDialog`).
 * 확인 버튼은 잉크(`primary`) — 해임도 빨강이 아니다. 잃는 것이 없고 다시 임명할 수 있다(빨강은 되돌릴 수 없는 삭제 전용, 1.2).
 * 대상의 이메일을 함께 보인다 — 같은 닉네임 · 비슷한 닉네임을 잘못 고르지 않게
 */
export function ManagerChangeDialog({ target, open, pending, error, onConfirm, onClose, fallbackFocus }: ManagerChangeDialogProps) {
  const copy = target ? managerChangeCopy(target.member.nickname, target.change) : null
  return (
    <ConfirmDialog
      open={open && copy !== null}
      title={copy?.title ?? ''}
      confirmLabel={copy?.confirmLabel ?? ''}
      pendingLabel={copy?.pendingLabel}
      tone="primary"
      pending={pending}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
      fallbackFocus={fallbackFocus}
    >
      {target && copy ? (
        <>
          <p className={styles.who}>
            <span className={styles.whoLabel}>대상</span>
            <span className={styles.whoValue}>{target.member.email}</span>
          </p>
          <p>{copy.result}</p>
        </>
      ) : null}
    </ConfirmDialog>
  )
}
