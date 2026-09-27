import { useEffect } from 'react'

/** 탭 제목 — `제목 | 분실물 찾기`. 여러 탭을 열어 두고 오갈 때 어느 화면인지 보인다. 떠나면 되돌린다 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = `${title} | 분실물 찾기`
    return () => {
      document.title = previous
    }
  }, [title])
}
