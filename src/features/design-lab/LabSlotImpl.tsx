import type { LabSlotImplProps } from '@/app/lab/LabSlot'

import { NotificationBell } from './notify/NotificationBell'
import { MatchRail } from './match/MatchRail'
import { NearbyMap } from './map/NearbyMap'
import { StatusStrip } from './strip/StatusStrip'

/** 시안 자리의 실제 내용(개발 모드 전용 조각). 자리 이름으로 고른다 */
export default function LabSlotImpl(props: LabSlotImplProps) {
  switch (props.name) {
    case 'strip':
      return <StatusStrip variant={props.variant} state={props.lab.state} />
    case 'map':
      return (
        <NearbyMap variant={props.variant} state={props.lab.state} posts={props.posts}>
          {props.children}
        </NearbyMap>
      )
    case 'match':
      return <MatchRail variant={props.variant} state={props.lab.state} context={props.context} source={props.source} />
    case 'bell':
      return <NotificationBell variant={props.variant} state={props.lab.state} />
  }
}
