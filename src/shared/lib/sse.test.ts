import { describe, expect, it } from 'vitest'

import { createSseParser, type SseMessage } from './sse'

function parse(chunks: string[]) {
  const messages: SseMessage[] = []
  const retries: number[] = []
  const parser = createSseParser(
    (m) => messages.push(m),
    (ms) => retries.push(ms),
  )
  for (const chunk of chunks) parser.push(chunk)
  parser.end()
  return { messages, retries }
}

/** 서버(`NotificationStreamService`)가 실제로 내는 모양 */
const SERVER = [
  'event:connected\ndata:ok\n\n',
  ':heartbeat\n\n',
  'id:41\nevent:notification\ndata:{"id":41,"type":"CLAIM_REQUESTED","postTitle":"검은 지갑"}\n\n',
  'id:42\nevent:notification\ndata:{"id":42,"type":"CLAIM_APPROVED","postTitle":"에어팟"}\n\n',
].join('')

describe('SSE 해석', () => {
  it('서버 모양 — connected · 주석(heartbeat) 무시 · 알림 둘, 마지막 id 를 단다', () => {
    const { messages } = parse([SERVER])
    expect(messages.map((m) => [m.event, m.lastEventId])).toEqual([
      ['connected', ''],
      ['notification', '41'],
      ['notification', '42'],
    ])
    expect(JSON.parse(messages[1].data)).toMatchObject({ id: 41, postTitle: '검은 지갑' })
  })

  it('조각이 어디서 끊겨 와도 같은 결과(모든 자리에서 둘로 자름)', () => {
    const whole = parse([SERVER]).messages
    for (let i = 1; i < SERVER.length; i += 1) {
      expect(parse([SERVER.slice(0, i), SERVER.slice(i)]).messages).toEqual(whole)
    }
  })

  it('한 글자씩 와도 같다', () => {
    expect(parse([...SERVER]).messages).toEqual(parse([SERVER]).messages)
  })

  it('줄 끝 \\r\\n · \\r 도 같고, \\r\\n 이 두 조각으로 갈려도 빈 줄이 하나 더 생기지 않는다', () => {
    const crlf = SERVER.split('\n').join('\r\n')
    const cr = SERVER.split('\n').join('\r')
    const whole = parse([SERVER]).messages
    expect(parse([crlf]).messages).toEqual(whole)
    expect(parse([cr]).messages).toEqual(whole)
    for (let i = 1; i < crlf.length; i += 1) {
      expect(parse([crlf.slice(0, i), crlf.slice(i)]).messages).toEqual(whole)
    }
  })

  it('여러 data 줄은 \\n 으로 잇고, 콜론 뒤 빈칸 하나만 뗀다', () => {
    const { messages } = parse(['data: 첫 줄\ndata:  둘째\ndata\n\n'])
    expect(messages[0]).toEqual({ event: 'message', data: '첫 줄\n 둘째\n', lastEventId: '' })
  })

  it('data 없는 덩어리는 내지 않고, id 는 그 뒤 메시지에도 남는다', () => {
    const { messages } = parse(['id: 7\nevent: notification\n\n', 'data: x\n\n'])
    expect(messages).toEqual([{ event: 'message', data: 'x', lastEventId: '7' }])
  })

  it('빈 줄 없이 끝난 마지막 덩어리는 버린다(표준)', () => {
    expect(parse(['data: a\n\ndata: b']).messages.map((m) => m.data)).toEqual(['a'])
  })

  it('맨 앞 BOM 은 버리고, NUL 이 든 id 는 무시, retry 는 숫자만', () => {
    const { messages, retries } = parse(['﻿id: 3\ndata: a\n\nid: 4\u00005\nretry: 2500\nretry: x\ndata: b\n\n'])
    expect(messages.map((m) => [m.data, m.lastEventId])).toEqual([
      ['a', '3'],
      ['b', '3'],
    ])
    expect(retries).toEqual([2500])
  })
})
