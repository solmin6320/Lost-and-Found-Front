import styles from './PostWriteHeader.module.css'
import { PostWriteGuide } from './PostWriteGuide'

interface PostWriteHeaderProps {
  title: string
  /** 제목 아래 한 줄 — 무엇을 적어야 하는지 */
  lead: string
}

/** 등록 · 수정 화면의 머리 — 제목(h1) · 한 줄 · 오른쪽 끝 `쓰는 요령` */
export function PostWriteHeader({ title, lead }: PostWriteHeaderProps) {
  return (
    <header className={styles.head}>
      <div className={styles.row}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.guide}>
          <PostWriteGuide />
        </div>
      </div>
      <p className={styles.lead}>{lead}</p>
    </header>
  )
}
