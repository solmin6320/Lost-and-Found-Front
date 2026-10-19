import { Link } from 'react-router-dom'

import { POST_DETAIL_FROM_LIST, paths } from '@/app/paths'
import { PostThumbnail, TypeBadge, lostFoundDateLabel, type PostListResponse } from '@/features/posts'
import { formatDate } from '@/shared/lib/date'
import { CaretRight, MapPin, X } from '@/shared/ui/icons'

import styles from './NearbyMap.module.css'

/** 지도에서 고른 글 — 지도 아래쪽에 얹는 가로 카드. 누르면 상세, [×]로 닫는다 */
export function MapPostCard({ post, onClose }: { post: PostListResponse; onClose: () => void }) {
  return (
    <article className={styles.picked} aria-label="지도에서 고른 글">
      <PostThumbnail className={styles.pickedThumb} category={post.category} type={post.type} src={post.thumbnailUrl ?? undefined} alt="" seed={post.id} />
      <div className={styles.pickedBody}>
        <TypeBadge type={post.type} />
        <h3 className={styles.pickedTitle}>
          <Link className={styles.pickedLink} to={paths.postDetail(post.id)} state={POST_DETAIL_FROM_LIST}>
            {post.title}
          </Link>
        </h3>
        <p className={styles.pickedMeta}>
          <MapPin />
          <span className={styles.pickedPlace}>{post.location}</span>
        </p>
        <p className={styles.pickedMeta}>
          {lostFoundDateLabel(post.type)} {formatDate(post.lostFoundDate)}
        </p>
      </div>
      <CaretRight className={styles.pickedGo} />
      <button type="button" className={styles.pickedClose} onClick={onClose} aria-label="고른 글 닫기">
        <X />
      </button>
    </article>
  )
}
