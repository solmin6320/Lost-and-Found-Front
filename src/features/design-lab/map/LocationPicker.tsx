import type L from 'leaflet'
import { useId, useRef, useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Crosshair, MapPin, ShieldCheck, WarningCircle } from '@/shared/ui/icons'
import { LoadingDots } from '@/shared/ui/LoadingDots'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { LabState } from '../labSwitch'
import { nearestArea } from './coords'
import { LeafletMap } from './LeafletMap'
import styles from './LocationPicker.module.css'

const START: [number, number] = [37.5445, 127.056]
const NO_POINTS: never[] = []
/** 글에 보이는 범위 — 정확한 점 대신 이 반경의 원 */
const FUZZ_M = 150

/**
 * (나) 글 쓸 때 위치 찍기 — 시안 1개. 지도를 움직여 가운데 핀에 맞춘다(핀을 끌지 않는다 — 손가락이 핀을 가리지 않게).
 * 글에는 정확한 점이 아니라 **반경 150m 원**으로 보인다(집 · 회사가 드러나지 않게). 위치는 선택 — 없이도 올릴 수 있다.
 * 실제 저장은 `POST.latitude · longitude`(+ 공개용으로 흐린 값은 서버가 만든다).
 * state=loading → 지도 받는 중, state=error → 현재 위치를 못 받은 경우
 */
export function LocationPicker({ state }: { state?: LabState }) {
  const [center, setCenter] = useState<[number, number]>(START)
  const [ringPx, setRingPx] = useState(0)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(state === 'error' ? '위치 권한이 꺼져 있어 지금 위치를 찾지 못했어요. 지도를 직접 움직여 맞춰 주세요.' : null)
  const [chosen, setChosen] = useState(false)
  const mapRef = useRef<L.Map | null>(null)
  const fieldId = useId()

  function onMove(map: L.Map) {
    const c = map.getCenter()
    setCenter([c.lat, c.lng])
    // 반경 150m 가 지금 줌에서 몇 px 인지(웹 메르카토르)
    const metersPerPx = (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / 2 ** map.getZoom()
    setRingPx(Math.round(FUZZ_M / metersPerPx))
    setChosen(false)
  }

  function locate() {
    setGeoError(null)
    if (!('geolocation' in navigator)) {
      setGeoError('이 브라우저는 위치 찾기를 지원하지 않아요. 지도를 직접 움직여 맞춰 주세요.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 16)
      },
      () => {
        setLocating(false)
        setGeoError('위치 권한이 꺼져 있어 지금 위치를 찾지 못했어요. 지도를 직접 움직여 맞춰 주세요.')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <p className={styles.step}>글 올리기</p>
        <h1 className={styles.title}>어디서 잃어버렸나요?</h1>
        <p className={styles.lead}>지도를 움직여 가운데 핀을 그 자리에 맞춰 주세요. 정확하지 않아도 괜찮아요.</p>
      </div>

      {state === 'loading' ? (
        <div className={styles.mapSkeleton} aria-busy="true">
          <Skeleton className={styles.fill} />
          <span className={styles.dots}>
            <LoadingDots label="지도를 불러오는 중" />
          </span>
        </div>
      ) : (
        <LeafletMap
          className={styles.map}
          points={NO_POINTS}
          look="dot"
          label="위치를 고르는 지도. 지도를 움직이면 가운데가 고른 자리예요"
          fit={false}
          center={START}
          zoom={16}
          onReady={(map) => {
            mapRef.current = map
            onMove(map)
          }}
          onMove={onMove}
        >
          {/* 가운데 고정 핀 + 공개 범위 원(지도를 움직여도 화면 가운데) */}
          <span className={styles.ring} style={{ width: ringPx * 2, height: ringPx * 2 }} aria-hidden="true" />
          <span className={styles.pin} aria-hidden="true">
            <MapPin weight="fill" />
          </span>
          <Button size="sm" className={styles.locate} onClick={locate} pending={locating} pendingLabel="위치 찾는 중">
            <Crosshair />
            지금 위치
          </Button>
        </LeafletMap>
      )}

      {geoError ? (
        <p className={styles.geoError} role="alert">
          <WarningCircle />
          {geoError}
        </p>
      ) : null}

      <div className={styles.readout}>
        <p className={styles.area}>
          <MapPin />
          <span>
            <b>{state === 'loading' ? '지도를 불러오는 중이에요' : nearestArea(center[0], center[1])}</b>
            {chosen ? <span className={styles.chosen}> 이 위치로 정했어요</span> : null}
          </span>
        </p>
        <p className={styles.privacy}>
          <ShieldCheck />
          글에는 정확한 점 대신 반경 {FUZZ_M}m 원으로 보여요.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor={fieldId} className={styles.label}>
          장소 설명
        </label>
        <input id={fieldId} className={styles.input} defaultValue="서울숲 3번 출입구 벤치" maxLength={100} />
        <p className={styles.help}>지도와 함께, 찾는 사람이 알아볼 수 있게 적어 주세요.</p>
      </div>

      <div className={styles.actions}>
        <Button variant="primary" onClick={() => setChosen(true)} unavailable={state === 'loading'}>
          이 위치로 정하기
        </Button>
        <Button variant="ghost">위치 없이 올리기</Button>
      </div>
    </div>
  )
}
