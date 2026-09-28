import { describe, expect, it } from 'vitest'

import { clearWriteDrafts } from './writeDrafts'

/** 순서가 있는 작은 Storage. `key(i)` 는 지우면 번호가 당겨진다(브라우저와 같다) */
function memoryStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    keys: () => [...map.keys()],
  }
}

describe('clearWriteDrafts — 직접 로그아웃하면 쓰던 글 · 댓글 보관을 지운다', () => {
  it('두 접두사만 지우고 다른 키는 남긴다', () => {
    const storage = memoryStorage({
      'scroll:v1': '[]',
      'post-draft:v1:create': '{}',
      'post-draft:v1:edit:12': '{}',
      'comment-draft:v1:12': '{}',
      'comment-draft:v1:40': '{}',
      'post-draft:v2:create': '{}',
      'theme:v1': 'dark',
    })
    clearWriteDrafts(storage)
    expect(storage.keys()).toEqual(['scroll:v1', 'post-draft:v2:create', 'theme:v1'])
  })

  it('저장소가 던져도 앱을 멈추지 않는다', () => {
    const broken = {
      get length(): number {
        throw new Error('SecurityError')
      },
      key: () => null,
      removeItem: () => undefined,
    }
    expect(() => clearWriteDrafts(broken)).not.toThrow()
  })
})
