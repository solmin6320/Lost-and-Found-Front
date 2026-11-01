/**
 * STOMP 1.2 프레임을 글자로 만들고(보내기) 글자 흐름을 프레임으로 자른다(받기) — 채팅(7.6 ③, SCR-13)의 WebSocket 위 말.
 *
 * 라이브러리(`@stomp/stompjs`)를 들이지 않고 작게 직접 쓴 까닭 — 쓰는 것이 CONNECT · SUBSCRIBE · UNSUBSCRIBE · SEND · DISCONNECT 와
 * 받는 CONNECTED · MESSAGE · ERROR · 심장박동뿐이고, 연결 관리(재발급 · 백오프 · 숨김/보임 · 온라인)는 알림 SSE 와 같은 규칙으로
 * 우리가 따로 맡는다(`features/chat/model/chatConnection`). 라이브러리의 재연결 · 타이머를 끄고 감싸면 겹치는 규칙이 둘이 된다.
 * 의존성이 늘지 않아 공급망 점검(보안명세서 7장)에 걸릴 것이 없다. SSE 해석(`shared/lib/sse`)과 같은 결정이다.
 *
 * 규칙(STOMP 1.2 명세)
 * - 프레임 = 명령 줄 · 머리글 줄들 · 빈 줄 · 본문 · NUL(`\0`). 줄 끝은 `\n` 또는 `\r\n`
 * - 프레임 사이의 빈 줄(`\n`)은 심장박동이다 — 프레임이 아니다
 * - 머리글 값의 `\\` · `\n` · `\r` · `:` 는 `\\\\` · `\\n` · `\\r` · `\\c` 로 바꿔 쓴다(CONNECT · CONNECTED 는 바꾸지 않는다)
 * - 같은 머리글이 둘이면 **앞의 것**을 쓴다
 * - 본문은 NUL 까지. `content-length` 는 바이트 수라 글자로 받은 흐름에서는 보지 않는다 — 우리 본문은 JSON 이라
 *   NUL 이 날것으로 들어 있을 수 없다(`JSON.stringify` 는 `\u0000` 으로 쓴다)
 */

export interface StompFrame {
  command: string
  headers: Record<string, string>
  body: string
}

const NUL = '\0'

/** 머리글 바꿔 쓰기를 하지 않는 명령(명세 — 1.0 과 맞추려고) */
const RAW_HEADER_COMMANDS = new Set(['CONNECT', 'CONNECTED'])

function escapeHeader(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/:/g, '\\c')
}

function unescapeHeader(value: string): string {
  return value.replace(/\\(.)/g, (match, ch: string) => {
    switch (ch) {
      case '\\':
        return '\\'
      case 'n':
        return '\n'
      case 'r':
        return '\r'
      case 'c':
        return ':'
      default:
        // 명세상 오류인 바꿔 쓰기 — 버리지 않고 그대로 둔다(프레임 하나 때문에 연결을 끊지 않는다)
        return match
    }
  })
}

/** 프레임 하나를 글자로. 끝에 NUL 이 붙는다 */
export function encodeFrame(command: string, headers: Record<string, string> = {}, body = ''): string {
  const raw = RAW_HEADER_COMMANDS.has(command)
  const lines = [command]
  for (const [name, value] of Object.entries(headers)) {
    lines.push(raw ? `${name}:${value}` : `${escapeHeader(name)}:${escapeHeader(value)}`)
  }
  return `${lines.join('\n')}\n\n${body}${NUL}`
}

/** 심장박동 — 줄 끝 하나 */
export const HEARTBEAT = '\n'

export interface StompParser {
  /** 받은 글자 조각을 넣는다(WebSocket 메시지 하나에 프레임이 여럿 · 반쪽일 수 있다) */
  push(chunk: string): void
}

/**
 * 글자 흐름 → 프레임. 프레임 사이 빈 줄(심장박동)은 `onHeartbeat` 로 알린다.
 * 모양이 틀린 덩어리(명령 줄이 없음)는 버린다
 */
export function createStompParser(onFrame: (frame: StompFrame) => void, onHeartbeat?: () => void): StompParser {
  let buffer = ''

  function drainLeadingEols() {
    // 프레임 앞의 빈 줄들 — 심장박동
    for (;;) {
      if (buffer.startsWith('\r\n')) {
        buffer = buffer.slice(2)
      } else if (buffer.startsWith('\n')) {
        buffer = buffer.slice(1)
      } else {
        return
      }
      onHeartbeat?.()
    }
  }

  function parse(text: string): StompFrame | null {
    const headEnd = text.search(/\r?\n\r?\n/)
    const head = headEnd === -1 ? text : text.slice(0, headEnd)
    const body = headEnd === -1 ? '' : text.slice(headEnd).replace(/^\r?\n\r?\n/, '')
    const lines = head.split(/\r?\n/)
    const command = lines[0]?.trim()
    if (!command) return null
    const raw = RAW_HEADER_COMMANDS.has(command)
    const headers: Record<string, string> = {}
    for (const line of lines.slice(1)) {
      const colon = line.indexOf(':')
      if (colon <= 0) continue
      const name = raw ? line.slice(0, colon) : unescapeHeader(line.slice(0, colon))
      const value = raw ? line.slice(colon + 1) : unescapeHeader(line.slice(colon + 1))
      if (!(name in headers)) headers[name] = value
    }
    return { command, headers, body }
  }

  return {
    push(chunk) {
      buffer += chunk
      for (;;) {
        drainLeadingEols()
        const end = buffer.indexOf(NUL)
        if (end === -1) return
        const text = buffer.slice(0, end)
        buffer = buffer.slice(end + 1)
        const frame = parse(text)
        if (frame) onFrame(frame)
      }
    },
  }
}

/**
 * 심장박동 맞추기(명세 "Heart-beating"). 내 값 `cx,cy` 와 서버 값 `sx,sy`(CONNECTED 의 `heart-beat`).
 * - 내가 보낼 간격 = cx 와 sy 가 둘 다 0 이 아니면 max(cx, sy), 아니면 0(보내지 않음)
 * - 서버가 보낼 간격 = sx 와 cy 가 둘 다 0 이 아니면 max(sx, cy), 아니면 0(기다리지 않음)
 */
export function negotiateHeartbeat(
  mine: readonly [number, number],
  serverHeader: string | undefined,
): { outgoing: number; incoming: number } {
  const [sx, sy] = (serverHeader ?? '0,0').split(',').map((v) => Number.parseInt(v.trim(), 10) || 0)
  const [cx, cy] = mine
  return {
    outgoing: cx > 0 && sy > 0 ? Math.max(cx, sy) : 0,
    incoming: sx > 0 && cy > 0 ? Math.max(sx, cy) : 0,
  }
}
