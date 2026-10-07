/** 쿼리스트링 값 하나. 비어 있는 값(`undefined` · `null` · `''`)은 빠진다 */
export type QueryScalar = string | number | boolean | null | undefined

/**
 * 쿼리스트링 값. **배열은 같은 이름을 되풀이한다** — `status=OPEN&status=IN_PROGRESS`.
 * 서버(Spring)가 `List<PostStatus>` 로 받는 모양이다. 쉼표로 잇지 않는다(값에 쉼표가 들어가면 갈라진다)
 */
export type QueryValue = QueryScalar | readonly QueryScalar[]

/** 조건 → `a=1&b=2`. 비어 있는 값 · 빈 배열은 싣지 않는다. 앞에 `?` 를 붙이지 않는다 */
export function buildQueryString(query: Record<string, QueryValue> | undefined): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    const values: readonly QueryScalar[] = Array.isArray(value) ? value : [value as QueryScalar]
    for (const item of values) {
      if (item === undefined || item === null || item === '') continue
      params.append(key, String(item))
    }
  }

  return params.toString()
}
