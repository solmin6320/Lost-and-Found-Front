import { ErrorState } from '@/shared/ui/ErrorState'

import styles from './RouteLoadError.module.css'

/**
 * 나눠 받는 화면(등록 · 수정 · 상세 · 설정 · 내가 쓴 글)의 코드를 받지 못했을 때. 헤더는 그대로 두고 본문 자리만 바꾼다.
 *
 * 흔한 까닭은 둘이다 — 연결이 끊겼거나, 이 탭을 열어 둔 사이 새 버전이 올라가 예전 조각 파일이 없어졌다.
 * 둘 다 새로고침이 답이라 [다시 시도]가 페이지를 새로 받는다(같은 주소 그대로).
 * 서버 응답이 아니라서 받을 `message` 가 없다. 이 문장 하나만 쓴다.
 */
export function RouteLoadError() {
  return (
    <div className={styles.box}>
      <ErrorState
        titleAs="h1"
        message="화면을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요."
        onRetry={() => window.location.reload()}
      />
    </div>
  )
}
