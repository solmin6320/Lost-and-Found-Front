import { Suspense, lazy, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import type { PostCategory, PostListResponse, PostType } from '@/features/posts'
import { readLab, type LabConfig, type LabElement, type LabVariant } from '@/features/design-lab/labSwitch'

/** 추천 카드가 기준으로 삼는 내 분실 글 */
export interface LabMatchSource {
  id: number
  type: PostType
  title: string
  category: PostCategory
  location: string
  lostFoundDate: string
}

export type LabSlotProps =
  | { name: 'strip' }
  | { name: 'map'; posts: readonly PostListResponse[] | undefined; children: ReactNode }
  | { name: 'match'; context: 'detail' | 'me'; source?: LabMatchSource }
  | { name: 'bell' }

export type LabSlotImplProps = LabSlotProps & { variant: LabVariant; lab: LabConfig }

/**
 * 시안 자리 — **개발 모드에서만** 시안 코드를 받아 그린다(`?lab=…`, `features/design-lab/labSwitch`).
 * 운영 빌드에서는 `import.meta.env.DEV` 가 false 로 바뀌어 아래 lazy import 째로 지워지고, 자리는 원래 내용(`children`)만 그린다.
 * 시안을 고른 뒤 확정 구현은 이 자리를 걷어 내고 제자리에 만든다.
 */
const Impl = import.meta.env.DEV ? lazy(() => import('@/features/design-lab/LabSlotImpl')) : null

export function LabSlot(props: LabSlotProps) {
  const fallback = props.name === 'map' ? props.children : null
  if (!import.meta.env.DEV || !Impl) return <>{fallback}</>
  return <DevLabSlot {...props} fallback={fallback} />
}

function DevLabSlot(props: LabSlotProps & { fallback: ReactNode }) {
  const location = useLocation()
  const lab = readLab(location.search)
  const variant = lab.variants[props.name as LabElement]
  if (!variant || !Impl) return <>{props.fallback}</>
  return (
    <Suspense fallback={props.fallback}>
      <Impl {...props} variant={variant} lab={lab} />
    </Suspense>
  )
}
