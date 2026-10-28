import { useId } from 'react'

import { formatDate } from '@/shared/lib/date'
import { ShieldCheck } from '@/shared/ui/icons'

import type { ReturnRecordResponse } from '../api/types'
import styles from './claims.module.css'

interface OwnerVerifiedNoteProps {
  ownerVerified: boolean
  returnRecord: ReturnRecordResponse | null
}

/**
 * SCR-12 ⑦ 주인 확인 완료 — 확인 요청으로 주인을 확인하고 건넨 글에만(`ownerVerified`). 상세 정보 칸의 핵심 정보 바로 아래.
 * 되찾기 기록(요청 · 승인 · 받음 날짜)을 같이 둔다 — 누구나 보는 공개 기록이라 이름 · 답은 싣지 않는다(서버도 주지 않는다).
 * 색 없이 잉크 테 한 줄 + 방패 아이콘 + 글자로. 끝남 표시의 채운 ✓는 머리 줄이 이미 쓴다.
 * **무엇을 거쳐 끝났는지는 말하지 않는다** — 상세 머리 줄(`OWNER_VERIFIED_SENTENCE`)이 한 번 말한다(C11, 같은 사실을 세 번 말하지 않게).
 * 글쓴이에게는 내 글 관리가 끝났다고 말하므로 이 칸은 이름 + 날짜만이다
 */
export function OwnerVerifiedNote({ ownerVerified, returnRecord }: OwnerVerifiedNoteProps) {
  const headingId = useId()
  if (!ownerVerified) return null

  const steps = returnRecord
    ? [
        { label: '요청', value: returnRecord.requestedAt },
        { label: '승인', value: returnRecord.approvedAt },
        { label: '받음', value: returnRecord.receivedAt },
      ].filter((step): step is { label: string; value: string } => step.value !== null)
    : []

  return (
    <section className={styles.verified} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.verifiedTitle}>
        <ShieldCheck />
        주인 확인 완료
      </h2>
      {steps.length > 0 ? (
        <dl className={styles.record}>
          {steps.map((step) => (
            <div key={step.label}>
              <dt>{step.label}</dt>
              <dd>
                <time dateTime={step.value}>{formatDate(step.value)}</time>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}
