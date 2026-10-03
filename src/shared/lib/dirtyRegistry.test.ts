import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_LEAVE_COPY,
  allowLeave,
  hasDirtyFields,
  isSelfLogout,
  leaveCopy,
  markSelfLogout,
  removeDirtyField,
  resetDirtyRegistry,
  resetLeaveRelease,
  setDirtyField,
} from './dirtyRegistry'

const EDIT_COPY = { title: '고치던 글을 두고 나갈까요?', body: '나가면 고친 내용은 저장되지 않아요.' }

describe('쓰던 칸 등록부', () => {
  beforeEach(() => resetDirtyRegistry())

  it('아무 칸도 쓰던 중이 아니면 막지 않는다', () => {
    expect(hasDirtyFields()).toBe(false)
    setDirtyField('nickname', false)
    setDirtyField('password', false)
    expect(hasDirtyFields()).toBe(false)
  })

  it('칸 하나라도 쓰던 중이면 막는다 — 화면마다 막는 곳은 하나, 칸은 알리기만 한다', () => {
    setDirtyField('nickname', false)
    setDirtyField('password', true)
    expect(hasDirtyFields()).toBe(true)
    setDirtyField('password', false)
    expect(hasDirtyFields()).toBe(false)
  })

  it('칸이 사라지면 그 칸의 글자는 더 지키지 않는다', () => {
    setDirtyField('comment', true)
    removeDirtyField('comment')
    expect(hasDirtyFields()).toBe(false)
  })

  it('떠나도 된다고 풀면 그 이동은 막지 않고, 경로가 바뀌면 다시 막는다', () => {
    setDirtyField('form', true)
    allowLeave()
    expect(hasDirtyFields()).toBe(false)
    resetLeaveRelease()
    expect(hasDirtyFields()).toBe(true)
  })

  it('막을 때 문장은 먼저 등록한 쓰던 칸의 것, 없으면 공통 문장', () => {
    setDirtyField('form', false, EDIT_COPY)
    setDirtyField('comment', true)
    expect(leaveCopy()).toBe(DEFAULT_LEAVE_COPY)
    setDirtyField('form', true, EDIT_COPY)
    expect(leaveCopy()).toBe(EDIT_COPY)
  })

  it('공통 문장은 해요체이고 글자 기호를 쓰지 않는다', () => {
    expect(DEFAULT_LEAVE_COPY.body.endsWith('요.')).toBe(true)
    expect(`${DEFAULT_LEAVE_COPY.title}${DEFAULT_LEAVE_COPY.body}`).not.toMatch(/[↓→✓]/)
  })

  it('이 탭에서 고른 로그아웃은 여러 칸이 읽어도 같고, 경로가 바뀌면 지워진다 — 다음 로그아웃(다른 창)과 섞이지 않게', () => {
    expect(isSelfLogout()).toBe(false)
    markSelfLogout()
    expect(isSelfLogout()).toBe(true)
    expect(isSelfLogout()).toBe(true)
    resetLeaveRelease()
    expect(isSelfLogout()).toBe(false)
  })
})
