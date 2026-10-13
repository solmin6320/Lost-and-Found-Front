/**
 * 시트 · 사진 크게 보기가 뒤 화면의 스크롤을 잠그고 푼다(`html` 인라인 `overflow: hidden`).
 *
 * **잠근 동안 스크롤바 자리에 그 창의 바탕을 칠한다**(QA-D-24, 2026-10-13). `html { scrollbar-gutter: stable }`(reset.css)이라
 * 잠가서 막대가 사라져도 자리(데스크톱 15px)는 남는데, 그 자리에는 문서의 어떤 것도 그려지지 않고 **`html` 바탕색만** 칠해진다
 * (고정 위치 · `::backdrop` 도 그 앞에서 끝난다 — Chrome 실측, 화면정의서 1.10). 그래서 밝게 화면에서 어두운 사진 보기를 열면
 * 오른쪽 끝에 흰 띠 15px 이 남았다. 잠그는 동안 `html` 바탕을 덮개의 색(반투명이면 종이 위에 겹친 색)으로 두고, 풀면 되돌린다.
 * 스크롤바가 겹쳐 뜨는 휴대폰은 자리가 0 이라 보이는 것이 없다.
 *
 * 둘이 겹쳐 열리지는 않지만, 잠그기 전 값을 한 번만 적어 두어 겹쳐도 처음 값으로 돌아간다
 */
let saved: { overflow: string; backgroundColor: string } | null = null

export function lockPageScroll(paint: string | null) {
  const style = document.documentElement.style
  if (!saved) saved = { overflow: style.overflow, backgroundColor: style.backgroundColor }
  style.overflow = 'hidden'
  if (paint) style.backgroundColor = paint
}

export function unlockPageScroll() {
  if (!saved) return
  const style = document.documentElement.style
  style.overflow = saved.overflow
  style.backgroundColor = saved.backgroundColor
  saved = null
}

/**
 * 덮개(`element`, `::backdrop` 이면 `pseudo`)가 화면에 칠하는 색. 반투명이면 종이(`body` 바탕) 위에 겹친 색으로 바꾼다 —
 * 스크롤바 자리는 덮개 아래가 아니라 `html` 바탕 하나만 보이기 때문이다. 읽지 못하면 `null`(칠하지 않는다)
 */
export function coverPaint(element: Element, pseudo?: '::backdrop'): string | null {
  return paintOver(getComputedStyle(element, pseudo).backgroundColor, getComputedStyle(document.body).backgroundColor)
}

/** 계산된 색 `top` 을 `under` 위에 겹친 불투명 색. 다 비치면(투명) · 읽지 못하면 `null` */
export function paintOver(top: string, under: string): string | null {
  const t = parseRgb(top)
  if (!t || t.a === 0) return null
  if (t.a >= 1) return rgb(t)
  const u = parseRgb(under)
  if (!u) return null
  const mix = (a: number, b: number) => Math.round(a * t.a + b * (1 - t.a))
  return rgb({ r: mix(t.r, u.r), g: mix(t.g, u.g), b: mix(t.b, u.b) })
}

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** 계산된 색(`rgb(…)` · `rgba(…)` · `rgb(r g b / a)`)만 읽는다 */
function parseRgb(value: string): Rgba | null {
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(value.trim())
  if (!match) return null
  const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number(match[4])
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha }
}

function rgb({ r, g, b }: { r: number; g: number; b: number }) {
  return `rgb(${r}, ${g}, ${b})`
}
