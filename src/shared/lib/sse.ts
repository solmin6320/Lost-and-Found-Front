/**
 * SSE(`text/event-stream`) 글자 흐름을 메시지로 자른다 — HTML 표준 "event stream interpretation" 그대로.
 *
 * `EventSource` 를 못 써서(`Authorization` 머리글을 실을 수 없다 — `http/openStream`) 브라우저가 해 주던 해석을 직접 한다.
 * 조각(chunk)은 아무 데서나 끊겨 온다 — 줄 가운데, `\r\n` 의 `\r` 과 `\n` 사이, 한글 바이트 가운데(이것은 `TextDecoder` 의 `stream` 이 맡는다).
 *
 * - 줄 끝은 `\r\n` · `\n` · `\r` 셋 다
 * - `:` 로 시작하는 줄은 주석(서버의 15초 heartbeat) — 버린다
 * - `data` 는 여러 줄이면 `\n` 으로 잇는다. 빈 줄에서 메시지 하나를 낸다. `data` 가 없으면 내지 않는다(`event` 만 있는 덩어리)
 * - `id` 는 다음 메시지들에도 남는다(마지막 이벤트 id — 다시 붙을 때 `Last-Event-ID` 로 보낸다). NUL 이 든 `id` 는 무시
 * - `retry` 는 숫자일 때만 알린다
 * - 맨 앞 BOM 하나는 버린다
 */
export interface SseMessage {
  /** 없으면 `message` */
  event: string
  data: string
  /** 이 메시지를 낼 때의 마지막 이벤트 id. 한 번도 없었으면 `''` */
  lastEventId: string
}

export interface SseParser {
  /** 디코드한 글자 조각을 넣는다 */
  push(chunk: string): void
  /** 흐름이 끝났다 — 빈 줄 없이 끝난 마지막 덩어리는 표준대로 버린다 */
  end(): void
}

export function createSseParser(onMessage: (message: SseMessage) => void, onRetry?: (ms: number) => void): SseParser {
  let rest = ''
  let started = false
  // 앞 조각이 `\r` 로 끝났다 — 다음 조각 맨 앞의 `\n` 은 같은 줄 끝이다
  let afterCR = false
  let data: string[] = []
  let hasData = false
  let event = ''
  let lastEventId = ''

  function line(text: string) {
    if (text === '') {
      if (hasData) onMessage({ event: event || 'message', data: data.join('\n'), lastEventId })
      data = []
      hasData = false
      event = ''
      return
    }
    if (text.startsWith(':')) return
    const colon = text.indexOf(':')
    const field = colon === -1 ? text : text.slice(0, colon)
    let value = colon === -1 ? '' : text.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    switch (field) {
      case 'event':
        event = value
        break
      case 'data':
        data.push(value)
        hasData = true
        break
      case 'id':
        if (!value.includes('\u0000')) lastEventId = value
        break
      case 'retry':
        if (/^\d+$/.test(value)) onRetry?.(Number(value))
        break
      default:
        break
    }
  }

  return {
    push(chunk) {
      let text = chunk
      if (!started && text.length > 0) {
        started = true
        if (text.startsWith('﻿')) text = text.slice(1)
      }
      if (afterCR && text.startsWith('\n')) text = text.slice(1)
      afterCR = false
      let buffer = rest + text
      let start = 0
      for (let i = 0; i < buffer.length; i += 1) {
        const ch = buffer[i]
        if (ch !== '\n' && ch !== '\r') continue
        line(buffer.slice(start, i))
        if (ch === '\r') {
          if (i + 1 < buffer.length) {
            if (buffer[i + 1] === '\n') i += 1
          } else {
            afterCR = true
          }
        }
        start = i + 1
      }
      buffer = buffer.slice(start)
      rest = buffer
    },
    end() {
      rest = ''
      data = []
      hasData = false
      event = ''
    },
  }
}
