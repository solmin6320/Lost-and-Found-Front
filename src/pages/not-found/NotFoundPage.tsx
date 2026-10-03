import { useLocation, useNavigate } from 'react-router-dom'

import { paths } from '@/app/paths'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { CaretLeft } from '@/shared/ui/icons'

import styles from './NotFoundPage.module.css'

/** 주소 줄에 보여 줄 최대 글자 수(회의 SE-7). 넘으면 끝을 말줄임으로 */
const ADDRESS_MAX = 40

/**
 * SCR-09 없는 화면 · `*` — 정의되지 않은 경로 · 오타 · 오래된 링크.
 *
 * 다른 화면처럼 **왼쪽 정렬 페이지 제목**으로 시작한다(설정 · 글 올리기와 같은 머리, 회의 UI-10 d). 회색 판 가운데의 작은 글은
 * 화면 아래 절반을 비워 "고장 난 화면"처럼 보였다.
 *
 * 어떤 주소로 왔는지 보여 준다 — 잘못 적힌 한 글자(`/post/12`)를 사용자가 직접 알아볼 수 있다. 다만 **경로만 · 한 줄 · 40자**까지다
 * (회의 SE-7). 쿼리까지 풀어 여러 줄로 보여 주면 `/고객센터-점검-중-02-000-0000으로-연락하세요` 같은 링크가
 * 우리 도메인 화면에 그 문장을 띄운다(콘텐츠 위조). 주소는 글자로만 보여 준다(링크로 만들지 않는다).
 *
 * 나갈 문 둘 : [목록으로](늘 있다) · [뒤로](앱 안에서 넘어왔을 때만 — 주소창으로 바로 열었으면 돌아갈 곳이 이 앱 밖이다)
 */
export function NotFoundPage() {
  const location = useLocation()
  const navigate = useNavigate()
  useDocumentTitle('없는 화면')

  const canGoBack = location.key !== 'default'
  const address = shorten(readable(location.pathname), ADDRESS_MAX)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>없는 화면이에요.</h1>
      <p className={styles.address}>
        <span className={styles.addressLabel}>주소</span>
        <span className={styles.addressValue}>{address}</span>
      </p>
      <p className={styles.description}>주소가 맞는지 확인하거나 목록에서 다시 찾아보세요.</p>
      <div className={styles.actions}>
        <ButtonLink to={paths.postList} variant="primary">
          목록으로
        </ButtonLink>
        {canGoBack ? (
          <Button onClick={() => navigate(-1)}>
            <CaretLeft />
            뒤로
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** `%EC%A7%80%EA%B0%91` 같은 주소를 사람이 읽는 글자로. 풀 수 없는 값이면 그대로 둔다 */
function readable(path: string): string {
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}

/** 글자(코드 포인트) 수로 자른다 — 한글 · 그림 글자가 반쪽으로 잘리지 않게 */
function shorten(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text
}
