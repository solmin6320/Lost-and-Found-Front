import { describe, expect, it } from 'vitest'

import { createStompParser, encodeFrame, negotiateHeartbeat, type StompFrame } from './stomp'

function collect() {
  const frames: StompFrame[] = []
  let beats = 0
  const parser = createStompParser(
    (frame) => frames.push(frame),
    () => {
      beats += 1
    },
  )
  return { parser, frames, beats: () => beats }
}

describe('encodeFrame', () => {
  it('명령 · 머리글 · 빈 줄 · 본문 · NUL', () => {
    expect(encodeFrame('SEND', { destination: '/app/rooms/7' }, '{"content":"안녕"}')).toBe(
      'SEND\ndestination:/app/rooms/7\n\n{"content":"안녕"}\0',
    )
  })

  it('CONNECT 머리글은 바꿔 쓰지 않는다(토큰 · 심장박동 그대로)', () => {
    expect(encodeFrame('CONNECT', { 'accept-version': '1.2', Authorization: 'Bearer a.b.c', 'heart-beat': '10000,10000' })).toBe(
      'CONNECT\naccept-version:1.2\nAuthorization:Bearer a.b.c\nheart-beat:10000,10000\n\n\0',
    )
  })

  it('그 밖의 명령은 머리글 값의 : · 줄바꿈 · \\ 를 바꿔 쓴다', () => {
    expect(encodeFrame('SUBSCRIBE', { id: 'a:b\nc\\' })).toBe('SUBSCRIBE\nid:a\\cb\\nc\\\\\n\n\0')
  })
})

describe('createStompParser', () => {
  it('프레임 하나를 자른다 — 머리글 · 본문(한글)', () => {
    const { parser, frames } = collect()
    parser.push('MESSAGE\ndestination:/topic/rooms/7\ncontent-length:20\n\n{"content":"만나요"}\0')
    expect(frames).toEqual([
      { command: 'MESSAGE', headers: { destination: '/topic/rooms/7', 'content-length': '20' }, body: '{"content":"만나요"}' },
    ])
  })

  it('조각난 흐름 · 한 메시지에 프레임 둘 · 사이 심장박동', () => {
    const { parser, frames, beats } = collect()
    parser.push('\nCONNECTED\nversion:1.2\nheart-')
    expect(frames).toHaveLength(0)
    parser.push('beat:10000,10000\n\n\0\nMESSAGE\ndestination:/x\n\nA\0MESS')
    parser.push('AGE\n\nB\0')
    expect(frames.map((f) => f.command)).toEqual(['CONNECTED', 'MESSAGE', 'MESSAGE'])
    expect(frames[0].headers['heart-beat']).toBe('10000,10000')
    expect(frames.map((f) => f.body)).toEqual(['', 'A', 'B'])
    expect(beats()).toBe(2)
  })

  it('심장박동만 온 메시지(\\n · \\r\\n)', () => {
    const { parser, frames, beats } = collect()
    parser.push('\n')
    parser.push('\r\n')
    expect(frames).toHaveLength(0)
    expect(beats()).toBe(2)
  })

  it('\\r\\n 줄 끝도 받는다', () => {
    const { parser, frames } = collect()
    parser.push('ERROR\r\nmessage:bad\r\n\r\nbody\0')
    expect(frames[0]).toEqual({ command: 'ERROR', headers: { message: 'bad' }, body: 'body' })
  })

  it('머리글 바꿔 쓰기를 되돌리고, 같은 이름은 앞의 것을 쓴다', () => {
    const { parser, frames } = collect()
    parser.push('MESSAGE\nsubscription:sub\\c1\nx:first\nx:second\n\n\0')
    expect(frames[0].headers).toEqual({ subscription: 'sub:1', x: 'first' })
  })

  it('CONNECTED 머리글은 되돌리지 않는다', () => {
    const { parser, frames } = collect()
    parser.push('CONNECTED\nuser-name:a\\cb\n\n\0')
    expect(frames[0].headers['user-name']).toBe('a\\cb')
  })
})

describe('negotiateHeartbeat', () => {
  it('둘 다 10초면 보내기 · 받기 모두 10초', () => {
    expect(negotiateHeartbeat([10_000, 10_000], '10000,10000')).toEqual({ outgoing: 10_000, incoming: 10_000 })
  })

  it('큰 쪽을 따른다 · 한쪽이 0이면 그 방향은 없다', () => {
    expect(negotiateHeartbeat([10_000, 10_000], '20000,5000')).toEqual({ outgoing: 10_000, incoming: 20_000 })
    expect(negotiateHeartbeat([10_000, 10_000], '0,0')).toEqual({ outgoing: 0, incoming: 0 })
    expect(negotiateHeartbeat([10_000, 10_000], undefined)).toEqual({ outgoing: 0, incoming: 0 })
  })
})
