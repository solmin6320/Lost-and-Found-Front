import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

import { cx } from '@/shared/lib/cx'
import { Minus, Plus } from '@/shared/ui/icons'

import { distanceKm, type MapPoint } from './coords'
import styles from './LeafletMap.module.css'

/**
 * 지도 — Leaflet 1.9 + OpenStreetMap 타일(키 없음). 시안 전용(2026-10-19).
 *
 * **보안 정책(CSP · Trusted Types)과 맞춘 것** — 운영 빌드는 `require-trusted-types-for 'script'` · `trusted-types 'none'` 이라
 * 문자열을 `innerHTML` 에 넣으면 막힌다. Leaflet 은 기본 확대 버튼 · 출처 표시 · 문자열 아이콘에서 `innerHTML` 을 쓴다 →
 *   - 기본 확대 버튼(`zoomControl`) · 출처 표시(`attributionControl`)를 끄고 React 로 그린다(출처 표시는 OSM 이용 조건이라 반드시 둔다)
 *   - 핀 · 묶음은 `DivIcon` 에 **요소**(`html: HTMLElement`)를 넘긴다 — 문자열을 넘기지 않는다. 글자는 `textContent`
 *   - 팝업 · 툴팁(`bindPopup`)을 쓰지 않는다 — 고른 글은 지도 위 React 카드로
 * 운영에서 켜려면 CSP `img-src` 에 타일 출처(`https://tile.openstreetmap.org`)를 더한다(build/csp.ts · CloudFront 헤더 두 곳).
 *
 * 핀이 모인 곳은 묶음 숫자로 — 화면 위 56px 칸 안의 점을 한 묶음으로(줌마다 다시 묶는다). 묶음 테는 분실 · 습득 비율(원뿔 그러데이션).
 */

export type PinLook = 'dot' | 'tag' | 'signal'

interface LeafletMapProps {
  points: readonly MapPoint[]
  look: PinLook
  /** 지도 영역 이름(스크린리더) */
  label: string
  selectedId?: number | null
  highlightId?: number | null
  onSelect?: (id: number | null) => void
  /** 지도를 옮길 때마다 화면 안의 글 번호 */
  onViewChange?: (visibleIds: number[]) => void
  /** 처음에 점이 다 보이게 맞춘다 */
  fit?: boolean
  center?: [number, number]
  zoom?: number
  /** false 면 움직이지 않는 미리보기(누르면 부른 쪽이 크게 연다) */
  interactive?: boolean
  /** 지도가 준비되면(위치 찍기 — 가운데 좌표를 읽는다) */
  onReady?: (map: L.Map) => void
  onMove?: (map: L.Map) => void
  className?: string
  /** 지도 위에 얹는 것(고른 글 카드 · 안내) */
  children?: ReactNode
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const CLUSTER_PX = 56

interface Cluster {
  lat: number
  lng: number
  members: MapPoint[]
}

function clusterPoints(map: L.Map, points: readonly MapPoint[]): Cluster[] {
  const zoom = map.getZoom()
  const cells = new Map<string, Cluster>()
  for (const point of points) {
    const p = map.project([point.lat, point.lng], zoom)
    const key = `${Math.floor(p.x / CLUSTER_PX)}:${Math.floor(p.y / CLUSTER_PX)}`
    const cell = cells.get(key)
    if (cell) {
      cell.members.push(point)
      const n = cell.members.length
      cell.lat += (point.lat - cell.lat) / n
      cell.lng += (point.lng - cell.lng) / n
    } else cells.set(key, { lat: point.lat, lng: point.lng, members: [point] })
  }
  return [...cells.values()]
}

const TYPE_WORD = { LOST: '분실', FOUND: '습득' } as const

function pinElement(look: PinLook, point: MapPoint, active: boolean) {
  const el = document.createElement('span')
  el.className = cx(styles.pin, styles[look])
  el.dataset.type = point.post.type
  if (active) el.dataset.active = ''
  const word = TYPE_WORD[point.post.type]
  const text = document.createElement('span')
  text.className = styles.pinText
  // 색만으로 가르지 않는다 — 글자(분 · 습 / 분실 · 습득)를 같이 둔다
  text.textContent = look === 'tag' ? word : word.slice(0, 1)
  el.append(text)
  return el
}

/**
 * 처음 보여 줄 범위 — 글이 몰린 곳. 전부 맞추면 부산 · 인천공항 글 하나 때문에 서울이 손톱만 해진다.
 * 가운데값에서 25km 안의 점만 맞추고, 그런 점이 없으면 전부
 */
function denseBounds(points: readonly MapPoint[]) {
  const mid = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
  const center: [number, number] = [mid(points.map((p) => p.lat)), mid(points.map((p) => p.lng))]
  const near = points.filter((p) => distanceKm(center, [p.lat, p.lng]) <= 25)
  return L.latLngBounds((near.length > 0 ? near : points).map((p) => [p.lat, p.lng] as [number, number]))
}

function clusterElement(cluster: Cluster, look: PinLook) {
  const lost = cluster.members.filter((m) => m.post.type === 'LOST').length
  const el = document.createElement('span')
  el.className = styles.cluster
  el.dataset.look = look
  el.style.setProperty('--lost-share', `${Math.round((lost / cluster.members.length) * 100)}%`)
  const count = document.createElement('b')
  count.textContent = String(cluster.members.length)
  el.append(count)
  return el
}

export function LeafletMap({
  points,
  look,
  label,
  selectedId = null,
  highlightId = null,
  onSelect,
  onViewChange,
  fit = true,
  center,
  zoom = 12,
  interactive = true,
  onReady,
  onMove,
  className,
  children,
}: LeafletMapProps) {
  const holder = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const latest = useRef({ points, look, selectedId, highlightId, onSelect, onViewChange, onMove })
  useLayoutEffect(() => {
    latest.current = { points, look, selectedId, highlightId, onSelect, onViewChange, onMove }
  })

  // 지도 한 번 만들기
  useEffect(() => {
    const el = holder.current
    if (!el) return
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      center: center ?? [37.535, 126.99],
      zoom,
      minZoom: 6,
      maxZoom: 18,
      dragging: interactive,
      scrollWheelZoom: interactive ? 'center' : false,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: false,
      keyboard: interactive,
      zoomSnap: 0.5,
    })
    L.tileLayer(TILE_URL, { maxZoom: 19, detectRetina: false, className: styles.tiles }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    if (fit && latest.current.points.length > 0) {
      map.fitBounds(denseBounds(latest.current.points), { padding: [36, 36], maxZoom: 13 })
    }
    map.on('click', () => latest.current.onSelect?.(null))
    onReady?.(map)

    // 크기가 바뀌면(나란히 · 접힘 · 시트) 타일을 다시 맞춘다
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    resize.observe(el)
    return () => {
      resize.disconnect()
      map.remove()
      mapRef.current = null
    }
    // 처음 한 번만 — 점 · 고름은 아래에서 다시 그린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 점 · 묶음 다시 그리기(줌 · 이동 · 고름이 바뀔 때)
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    function draw() {
      if (!map || !layer) return
      const { points: pts, look: lk, selectedId: sel, highlightId: hi } = latest.current
      layer.clearLayers()
      for (const cluster of clusterPoints(map, pts)) {
        if (cluster.members.length === 1) {
          const point = cluster.members[0]!
          const active = point.id === sel || point.id === hi
          const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({ html: pinElement(lk, point, active), className: styles.icon, iconSize: undefined }),
            keyboard: interactive,
            riseOnHover: true,
            zIndexOffset: active ? 1000 : 0,
          })
          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e)
            latest.current.onSelect?.(point.id)
          })
          marker.addTo(layer)
          marker.getElement()?.setAttribute('aria-label', `${TYPE_WORD[point.post.type]} 글 ${point.post.title}`)
        } else {
          const marker = L.marker([cluster.lat, cluster.lng], {
            icon: L.divIcon({ html: clusterElement(cluster, lk), className: styles.icon, iconSize: undefined }),
            keyboard: interactive,
            zIndexOffset: 500,
          })
          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e)
            const bounds = L.latLngBounds(cluster.members.map((m) => [m.lat, m.lng] as [number, number]))
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            const next = Math.min(map.getBoundsZoom(bounds.pad(0.4)), map.getZoom() + 3, 17)
            if (reduce) map.setView(bounds.getCenter(), next)
            else map.flyTo(bounds.getCenter(), next, { duration: 0.35 })
          })
          marker.addTo(layer)
          marker.getElement()?.setAttribute('aria-label', `글 ${cluster.members.length}개가 모인 곳. 누르면 가까이 봐요`)
        }
      }
      const view = map.getBounds()
      latest.current.onViewChange?.(pts.filter((p) => view.contains([p.lat, p.lng])).map((p) => p.id))
      latest.current.onMove?.(map)
    }

    draw()
    map.on('zoomend moveend', draw)
    return () => {
      map.off('zoomend moveend', draw)
    }
  }, [points, look, selectedId, highlightId, interactive])

  const zoomBy = (delta: number) => {
    const map = mapRef.current
    if (map) map.setZoom(map.getZoom() + delta)
  }

  return (
    <div className={cx(styles.frame, className)} data-interactive={interactive || undefined}>
      <div ref={holder} className={styles.map} role="region" aria-label={label} />
      {interactive ? (
        <div className={styles.zoom}>
          <button type="button" className={styles.zoomButton} onClick={() => zoomBy(1)} aria-label="가까이">
            <Plus />
          </button>
          <button type="button" className={styles.zoomButton} onClick={() => zoomBy(-1)} aria-label="멀리">
            <Minus />
          </button>
        </div>
      ) : null}
      {children}
      {/* 지도 자료 출처 — OpenStreetMap 이용 조건(ODbL). 늘 보이게 둔다 */}
      <p className={styles.attribution}>
        ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>{' '}
        기여자
      </p>
    </div>
  )
}
