import { Toggletip } from '@/shared/ui/Toggletip'

import styles from './PostWriteGuide.module.css'

interface PostWriteGuideProps {
  /** 헤더 `서비스 안내`가 열 때(제어) */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * 등록 · 수정 화면의 `쓰는 요령` — 온보딩 2층(docs/온보딩설계.md 4장). 제목 줄 끝에서 **누르면** 펼친다.
 * 헤더 `서비스 안내`를 이 화면에서 누르면 목록으로 떠나지 않고 이것이 열린다 — 쓰던 글을 두고 나가지 않는다.
 * 없는 기능(쪽지 · 알림)을 약속하지 않는다. 연락은 댓글뿐이다.
 */
export function PostWriteGuide({ open, onOpenChange }: PostWriteGuideProps) {
  return (
    <Toggletip label="쓰는 요령" align="end" open={open} onOpenChange={onOpenChange}>
      <p className={styles.title}>이렇게 쓰면 찾기 쉬워요</p>
      <ul className={styles.list}>
        <li>잃어버렸는지 주웠는지부터 골라요. 반대쪽 사람이 목록에서 이 글을 찾아봐요.</li>
        <li>사진 첫 장이 목록의 대표 사진이 돼요. 사진이 없으면 고른 종류의 그림이 대신 보여요.</li>
        <li>설명에는 사진에 안 보이는 특징을 적어요.</li>
        <li>누구나 보는 글이라 전화번호는 적지 말고 댓글로 이야기해요.</li>
      </ul>
      <p className={styles.note}>올린 뒤에도 고치거나 지울 수 있어요.</p>
    </Toggletip>
  )
}
