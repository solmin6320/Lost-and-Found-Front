import { describe, expect, it, vi } from 'vitest'

import {
  AUTH_CHANNEL_NAME,
  notifySignedOutElsewhere,
  openAuthChannel,
  parseAuthBroadcast,
  subscribeSignedOutElsewhere,
  type ChannelFactory,
} from './authChannel'

describe('parseAuthBroadcast — 정해진 모양만 받는다', () => {
  it.each([[{ type: 'logout' }], [{ type: 'session-ended' }]])('%j 는 받는다', (data) => {
    expect(parseAuthBroadcast(data)).toEqual(data)
  })

  it.each([
    [null],
    [undefined],
    ['logout'],
    [1],
    [[{ type: 'logout' }]],
    [{}],
    [{ type: 'LOGOUT' }],
    [{ type: 'login' }],
    [{ type: 'logout', token: 'eyJ...' }],
    [{ type: 'session-ended', memberId: 3 }],
    [{ type: ['logout'] }],
    [{ kind: 'logout' }],
    [Object.assign(Object.create({ type: 'logout' }) as object)],
    [new (class { type = 'logout' })()],
  ])('%j 는 버린다', (data) => {
    expect(parseAuthBroadcast(data)).toBeNull()
  })

  it('받은 객체를 그대로 돌려주지 않는다(새로 만든 값)', () => {
    const data = { type: 'logout' }
    expect(parseAuthBroadcast(data)).not.toBe(data)
  })
})

/** 한 탭의 채널을 흉내 낸다. `deliver` 가 다른 탭에서 온 메시지다 */
function fakeChannel() {
  const channel = {
    postMessage: vi.fn(),
    close: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
  }
  const create = vi.fn<ChannelFactory>(() => channel as unknown as BroadcastChannel)
  const deliver = (data: unknown) => channel.onmessage?.({ data } as MessageEvent)
  return { channel, create, deliver }
}

describe('openAuthChannel', () => {
  it('정해진 이름으로 연다', () => {
    const { create } = fakeChannel()
    openAuthChannel(() => {}, create)
    expect(create).toHaveBeenCalledWith(AUTH_CHANNEL_NAME)
  })

  it('모양 검사를 통과한 신호만 넘긴다', () => {
    const { create, deliver } = fakeChannel()
    const onMessage = vi.fn()
    openAuthChannel(onMessage, create)

    deliver({ type: 'logout', token: 'secret' })
    deliver('logout')
    deliver({ type: 'login' })
    expect(onMessage).not.toHaveBeenCalled()

    deliver({ type: 'session-ended' })
    expect(onMessage).toHaveBeenCalledExactlyOnceWith({ type: 'session-ended' })
  })

  it('보낼 때는 고정된 모양만 싣는다', () => {
    const { channel, create } = fakeChannel()
    const opened = openAuthChannel(() => {}, create)

    opened.post({ type: 'logout', extra: 'x' } as unknown as { type: 'logout' })
    expect(channel.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'logout' })
  })

  it('닫으면 더 받지 않는다', () => {
    const { channel, create, deliver } = fakeChannel()
    const onMessage = vi.fn()
    const opened = openAuthChannel(onMessage, create)

    opened.close()
    deliver({ type: 'logout' })
    expect(channel.close).toHaveBeenCalledOnce()
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('닫힌 채널로 보내도 던지지 않는다', () => {
    const { channel, create } = fakeChannel()
    channel.postMessage.mockImplementation(() => {
      throw new DOMException('closed', 'InvalidStateError')
    })
    const opened = openAuthChannel(() => {}, create)
    expect(() => opened.post({ type: 'logout' })).not.toThrow()
  })

  it.each<[string, ChannelFactory]>([
    ['지원하지 않음', () => null],
    [
      '여는 데 실패',
      () => {
        throw new DOMException('denied', 'SecurityError')
      },
    ],
  ])('채널을 열 수 없으면(%s) 조용히 아무것도 하지 않는다', (_, create) => {
    const opened = openAuthChannel(() => {}, create)
    expect(() => {
      opened.post({ type: 'logout' })
      opened.close()
    }).not.toThrow()
  })

  // Node 에도 BroadcastChannel 이 있다 — 진짜 채널로 "보낸 탭은 못 받고 다른 탭만 받는다"를 확인한다
  it('진짜 BroadcastChannel — 다른 탭만 받고, 보낸 쪽에는 오지 않는다', async () => {
    const tabA = vi.fn()
    const tabB = vi.fn()
    const a = openAuthChannel(tabA)
    const b = openAuthChannel(tabB)
    try {
      a.post({ type: 'logout' })
      await vi.waitFor(() => expect(tabB).toHaveBeenCalledWith({ type: 'logout' }))
      expect(tabA).not.toHaveBeenCalled()
    } finally {
      a.close()
      b.close()
    }
  })
})

describe('subscribeSignedOutElsewhere', () => {
  it('알림을 받고, 해제하면 더 받지 않는다', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSignedOutElsewhere(listener)
    notifySignedOutElsewhere()
    unsubscribe()
    notifySignedOutElsewhere()
    expect(listener).toHaveBeenCalledOnce()
  })
})
