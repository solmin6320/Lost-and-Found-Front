import { useEffect, useMemo } from 'react'

/*
 * 파일 하나에 미리보기 주소(`blob:`) 하나. 쓰는 곳을 센다.
 * 같은 파일을 두 곳(사진 격자 · 목록 미리보기 카드)이 보여 줘도 주소는 하나이고,
 * 순서만 바꿨을 때 주소를 다시 만들지 않는다 — 다시 만들면 사진이 한 번 깜빡인다.
 */
interface Entry {
  url: string
  holders: number
}

const entries = new WeakMap<Blob, Entry>()

/** 그리는 중에 부른다. 같은 파일이면 몇 번을 불러도 같은 주소다(StrictMode 의 두 번 그리기에도 하나) */
function entryOf(file: Blob): Entry {
  let entry = entries.get(file)
  if (!entry) {
    entry = { url: URL.createObjectURL(file), holders: 0 }
    entries.set(file, entry)
  }
  return entry
}

function hold(file: Blob) {
  entryOf(file).holders += 1
}

/**
 * 해제를 한 박자 미룬다. 순서를 바꾸면 "이전 배열 놓기 → 새 배열 잡기"가 한 번에 일어나고,
 * 개발 모드 StrictMode 는 effect 를 "정리 → 다시 실행"으로 한 번 더 돈다. 그 사이에 해제하면 살아 있는 사진이 깨진다.
 */
function release(file: Blob) {
  const entry = entries.get(file)
  if (!entry) return
  entry.holders -= 1
  window.setTimeout(() => {
    if (entry.holders <= 0 && entries.get(file) === entry) {
      URL.revokeObjectURL(entry.url)
      entries.delete(file)
    }
  }, 0)
}

/**
 * 파일 미리보기 주소(`blob:`)를 만들고, 목록에서 빠지거나 화면을 떠나면 **해제**한다.
 * `revokeObjectURL` 을 빠뜨리면 탭을 닫을 때까지 원본 사진이 메모리에 남는다(보안명세서 7장).
 *
 * ```tsx
 * const previews = useObjectUrls(files)
 * files.map((file) => <img key={...} src={previews.get(file)} alt="" />)
 * ```
 *
 * - `files` 는 상태에 둔 배열을 그대로 넘긴다
 * - 순서를 바꾸거나 한 장을 빼도 남은 파일의 주소는 그대로다(다시 받지 않는다 · 깜빡이지 않는다)
 * - 운영 CSP 의 `img-src` 에 `blob:` 이 있어야 보인다(보안명세서 4장)
 */
export function useObjectUrls(files: readonly Blob[]): ReadonlyMap<Blob, string> {
  const urls = useMemo(() => {
    const map = new Map<Blob, string>()
    for (const file of files) {
      map.set(file, entryOf(file).url)
    }
    return map
  }, [files])

  useEffect(() => {
    const held = [...new Set(files)]
    held.forEach(hold)
    return () => held.forEach(release)
  }, [files])

  return urls
}
