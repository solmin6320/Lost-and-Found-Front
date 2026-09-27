import { useEffect, useMemo, useRef } from 'react'

/**
 * 파일 미리보기 주소(`blob:`)를 만들고, 파일 목록이 바뀌거나 화면을 떠나면 **해제**한다.
 * `revokeObjectURL` 을 빠뜨리면 탭을 닫을 때까지 원본 사진이 메모리에 남는다(보안명세서 7장).
 *
 * ```tsx
 * const previews = useObjectUrls(files)
 * files.map((file) => <img key={...} src={previews.get(file)} alt="" />)
 * ```
 *
 * - `files` 는 상태에 둔 배열을 그대로 넘긴다. 렌더마다 새 배열을 만들면 주소를 매번 다시 만든다
 * - 운영 CSP 의 `img-src` 에 `blob:` 이 있어야 보인다(보안명세서 4장)
 *
 * 해제를 한 박자 미룬다. 개발 모드 StrictMode 는 effect 를 "정리 → 다시 실행"으로 한 번 더 돌리는데,
 * 정리에서 바로 해제하면 다시 실행될 때 이미 죽은 주소가 화면에 남는다. 다시 실행되면 예약을 취소한다.
 */
export function useObjectUrls(files: readonly Blob[]): ReadonlyMap<Blob, string> {
  const urls = useMemo(() => {
    const created = new Map<Blob, string>()
    for (const file of files) {
      if (!created.has(file)) {
        created.set(file, URL.createObjectURL(file))
      }
    }
    return created
  }, [files])

  const pending = useRef<{ urls: ReadonlyMap<Blob, string>; timer: number } | null>(null)

  useEffect(() => {
    if (pending.current?.urls === urls) {
      window.clearTimeout(pending.current.timer)
      pending.current = null
    }

    return () => {
      const timer = window.setTimeout(() => {
        urls.forEach((url) => URL.revokeObjectURL(url))
      }, 0)
      pending.current = { urls, timer }
    }
  }, [urls])

  return urls
}
