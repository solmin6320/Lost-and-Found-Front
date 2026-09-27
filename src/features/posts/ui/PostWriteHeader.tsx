import type { Ref } from 'react'

import styles from './PostWriteHeader.module.css'
import { PostWriteGuide } from './PostWriteGuide'

interface PostWriteHeaderProps {
  title: string
  /** 제목 아래 한 줄 — 무엇을 적어야 하는지 */
  lead: string
  guideOpen: boolean
  onGuideOpenChange: (open: boolean) => void
  /** 헤더 `서비스 안내`가 안내를 열 때 데려올 자리 */
  guideRef?: Ref<HTMLDivElement>
}

/** 등록 · 수정 화면의 머리 — 제목(h1) · 한 줄 · 오른쪽 끝 `쓰는 요령` */
export function PostWriteHeader({ title, lead, guideOpen, onGuideOpenChange, guideRef }: PostWriteHeaderProps) {
  return (
    <header className={styles.head}>
      <div className={styles.row}>
        <h1 className={styles.title}>{title}</h1>
        <div ref={guideRef} className={styles.guide}>
          <PostWriteGuide open={guideOpen} onOpenChange={onGuideOpenChange} />
        </div>
      </div>
      <p className={styles.lead}>{lead}</p>
    </header>
  )
}
