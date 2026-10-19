import { Button } from '@/shared/ui/Button'
import { CheckCircle, Clock, HandHeart, WarningCircle } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { LabState, LabVariant } from '../labSwitch'
import { emptyStats, mockStats, type StatsSummary } from '../mock'
import { useLabResource } from '../useLabResource'
import styles from './StatusStrip.module.css'

const DAY = ['일', '월', '화', '수', '목', '금', '토']
const fmt = (n: number) => n.toLocaleString('ko-KR')

/**
 * (가) 지금 서비스 현황 띠 — 첫 화면 맨 위, 제목 위. 숫자는 목 데이터(나중에 `GET /api/stats/summary`).
 *
 * 띠는 **조용해야 한다** — 바로 아래 분실 · 습득 두 색 면이 이 화면의 주인공이다(폰 레스토프). 색 면을 깔지 않고,
 * 개념 색은 작은 그림(나눔 막대 · 일주일 기둥)에만 쓴다. 누르는 것도 두지 않는다(힉스 — 첫 화면 선택지를 늘리지 않는다).
 *   a 문장 한 줄 : 숫자를 문장 안에 굵게. 가장 낮다(44px)
 *   b 세 칸 숫자 : 오늘 올라온 글(분실 · 습득 나눔 막대) | 이번 달 주인 찾음 | 평균 되찾기
 *   c 일주일 그림 : 이번 달 돌아간 수를 문장으로 + 최근 7일 날마다 올라온 글 기둥(분실 · 습득 쌓기)
 */
export function StatusStrip({ variant, state }: { variant: LabVariant; state?: LabState }) {
  const res = useLabResource(mockStats, emptyStats, state, { delay: 600 })

  return (
    <section className={styles.strip} data-variant={variant} aria-label="지금 서비스 현황" aria-busy={res.status === 'loading'}>
      {res.status === 'loading' ? (
        <StripSkeleton variant={variant} />
      ) : res.status === 'error' ? (
        // 띠는 덤이다 — 오류여도 화면을 막지 않고 한 줄로 말한다. 높이는 받은 띠와 같게(아래가 밀리지 않게)
        <p className={styles.error}>
          <WarningCircle className={styles.errorIcon} />
          <span>
            현황을 불러오지 못했어요. <span className={styles.errorDetail}>{res.message}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={res.retry} pending={res.retrying} pendingLabel="다시 불러오는 중">
            다시 시도
          </Button>
        </p>
      ) : variant === 'a' ? (
        <SentenceStrip data={res.data} />
      ) : variant === 'b' ? (
        <FiguresStrip data={res.data} />
      ) : (
        <WeekStrip data={res.data} />
      )}
    </section>
  )
}

function isQuiet(data: StatsSummary) {
  return data.today.lost + data.today.found === 0 && data.returnedThisMonth === 0
}

/* ── a 문장 한 줄 ── */

function SentenceStrip({ data }: { data: StatsSummary }) {
  const today = data.today.lost + data.today.found
  if (isQuiet(data)) {
    return (
      <p className={styles.sentence}>
        <HandHeart className={styles.lead} />
        <span>오늘은 아직 올라온 글이 없어요. 잃어버렸거나 주운 물건이 있으면 처음으로 올려 주세요.</span>
      </p>
    )
  }
  return (
    <p className={styles.sentence}>
      <HandHeart className={styles.lead} />
      <span>
        오늘 <strong data-numeric>{fmt(today)}건</strong>이 올라왔고, 이번 달{' '}
        <strong data-numeric>{fmt(data.returnedThisMonth)}건</strong>이 주인에게 돌아갔어요.{' '}
        <span className={styles.nowrap}>
          평균 <strong data-numeric>{data.avgDaysToReturn}일</strong> 걸렸어요.
        </span>
      </span>
    </p>
  )
}

/* ── b 세 칸 숫자 ── */

function FiguresStrip({ data }: { data: StatsSummary }) {
  const total = data.today.lost + data.today.found
  return (
    <dl className={styles.figures}>
      <div className={styles.figure}>
        <dt>오늘 올라온 글</dt>
        <dd className={styles.value}>
          <strong data-numeric>{fmt(total)}</strong>건
        </dd>
        <dd className={styles.sub}>
          {total > 0 ? (
            <>
              <span className={styles.split} aria-hidden="true">
                <span data-type="LOST" style={{ flexGrow: data.today.lost }} />
                <span data-type="FOUND" style={{ flexGrow: data.today.found }} />
              </span>
              <span className={styles.splitText}>
                분실 <b data-numeric>{data.today.lost}</b> 습득 <b data-numeric>{data.today.found}</b>
              </span>
            </>
          ) : (
            '아직 없어요'
          )}
        </dd>
      </div>
      <div className={styles.figure}>
        <dt>이번 달 주인 찾음</dt>
        <dd className={styles.value}>
          <strong data-numeric>{fmt(data.returnedThisMonth)}</strong>건
        </dd>
        <dd className={styles.sub}>
          <CheckCircle className={styles.subIcon} />
          완료로 바뀐 글
        </dd>
      </div>
      <div className={styles.figure}>
        <dt>평균 되찾기</dt>
        <dd className={styles.value}>
          {data.returnedThisMonth > 0 ? (
            <>
              <strong data-numeric>{data.avgDaysToReturn}</strong>일
            </>
          ) : (
            <strong>-</strong>
          )}
        </dd>
        <dd className={styles.sub}>
          <Clock className={styles.subIcon} />
          올린 날부터 완료까지
        </dd>
      </div>
    </dl>
  )
}

/* ── c 일주일 그림 ── */

function WeekStrip({ data }: { data: StatsSummary }) {
  const max = Math.max(1, ...data.last7Days.map((d) => d.lost + d.found))
  const quiet = isQuiet(data)
  return (
    <div className={styles.week}>
      <div className={styles.weekText}>
        <p className={styles.weekHead}>
          {quiet ? (
            '이번 주는 아직 조용해요.'
          ) : (
            <>
              이번 달 <strong data-numeric>{fmt(data.returnedThisMonth)}건</strong>이 주인에게 돌아갔어요.
            </>
          )}
        </p>
        <p className={styles.weekSub}>
          {quiet ? '새 글이 올라오면 여기에 날마다 쌓여요.' : `올린 날부터 평균 ${data.avgDaysToReturn}일 걸렸어요.`}
        </p>
      </div>
      <figure className={styles.chart}>
        <ol role="list" className={styles.columns} aria-label="최근 7일 날마다 올라온 글">
          {data.last7Days.map((day, i) => {
            const today = i === data.last7Days.length - 1
            const label = today ? '오늘' : DAY[new Date(`${day.date}T00:00:00`).getDay()]
            const sum = day.lost + day.found
            return (
              <li key={day.date} className={styles.column} data-today={today || undefined}>
                <span className={styles.bars} aria-hidden="true" style={{ height: `${(sum / max) * 100}%` }}>
                  {day.found > 0 ? <span data-type="FOUND" style={{ flexGrow: day.found }} /> : null}
                  {day.lost > 0 ? <span data-type="LOST" style={{ flexGrow: day.lost }} /> : null}
                </span>
                <span className={styles.day}>{label}</span>
                <span className={styles.tip} role="note">
                  {`${label} 분실 ${day.lost} · 습득 ${day.found}`}
                </span>
              </li>
            )
          })}
        </ol>
        <figcaption className={styles.legend}>
          <span data-type="LOST">분실</span>
          <span data-type="FOUND">습득</span>
          <span className={styles.legendToday}>
            오늘 <b data-numeric>{data.today.lost + data.today.found}</b>건
          </span>
        </figcaption>
      </figure>
    </div>
  )
}

/* ── 로딩 — 받은 띠와 같은 틀 · 같은 높이 ── */

function StripSkeleton({ variant }: { variant: LabVariant }) {
  if (variant === 'a') {
    return (
      <p className={styles.sentence}>
        <Skeleton className={styles.leadSkeleton} />
        <span className={styles.sentenceSkeleton}>
          <Skeleton shape="text" width="92%" />
        </span>
        <span className="sr-only">현황을 불러오는 중이에요</span>
      </p>
    )
  }
  if (variant === 'b') {
    // 칸 이름은 데이터와 상관없어 그대로 두고, 숫자 · 덧말만 자리표시 — 받은 띠와 줄 높이가 같다
    return (
      <dl className={styles.figures}>
        {['오늘 올라온 글', '이번 달 주인 찾음', '평균 되찾기'].map((label, i) => (
          <div key={label} className={styles.figure}>
            <dt>{label}</dt>
            <dd className={styles.value}>
              <strong>
                <Skeleton className={styles.valueSkeleton} />
              </strong>
            </dd>
            <dd className={styles.sub}>
              {i === 0 ? <span className={styles.split} aria-hidden="true" /> : null}
              <Skeleton shape="text" width="70%" className={styles.lineSkeleton} />
            </dd>
          </div>
        ))}
        <span className="sr-only">현황을 불러오는 중이에요</span>
      </dl>
    )
  }
  return (
    <div className={styles.week}>
      <div className={styles.weekText}>
        <p className={styles.weekHead}>
          <Skeleton shape="text" width="80%" className={styles.lineSkeleton} />
        </p>
        <p className={styles.weekSub}>
          <Skeleton shape="text" width="55%" className={styles.lineSkeleton} />
        </p>
      </div>
      <div className={styles.chart}>
        <div className={styles.columns}>
          {[50, 80, 45, 60, 100, 85, 70].map((h, i) => (
            <span key={i} className={styles.column}>
              <Skeleton className={styles.barSkeleton} height={`${h}%`} />
              <Skeleton shape="text" width="1.1em" className={styles.day} />
            </span>
          ))}
        </div>
        <div className={styles.legend}>
          <Skeleton shape="text" width="8rem" />
        </div>
      </div>
      <span className="sr-only">현황을 불러오는 중이에요</span>
    </div>
  )
}
