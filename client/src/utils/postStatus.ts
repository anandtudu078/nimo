import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export interface PostStatus {
  reposted: boolean
  reaction: string | null
}

interface StatusMap {
  [postId: string]: PostStatus
}

const EMPTY: PostStatus = { reposted: false, reaction: null }

// ---------------------------------------------------------------------------
// Batched "viewer status" fetcher.
//
// Each PostCard used to fire GET /reposts/check/:id + GET /reactions/:id on
// mount, i.e. 2 requests per card — 40+ requests for a 20-post feed, enough
// to trip the 100 req/min API rate limiter while scrolling. These helpers
// collapse that into 2 requests per feed page:
//   POST /reposts/check-multiple   { postIds }  -> { repostedPostIds }
//   POST /reactions/check-multiple { postIds }  -> { reactions: { id: emoji } }
//
// List pages call fetchPostStatuses once after loading a page of posts and
// hand the resulting map down to their PostCards.
// ---------------------------------------------------------------------------

const MAX_BATCH = 200

export async function fetchPostStatuses(postIds: string[]): Promise<StatusMap> {
  const status: StatusMap = {}
  if (postIds.length === 0) return status

  const ids = postIds.slice(0, MAX_BATCH)

  const [repostRes, reactionRes] = await Promise.all([
    api.post('/reposts/check-multiple', { postIds: ids }).catch(() => null),
    api.post('/reactions/check-multiple', { postIds: ids }).catch(() => null),
  ])

  for (const id of ids) {
    status[id] = { ...EMPTY }
  }
  for (const id of (repostRes?.data?.repostedPostIds as string[] | undefined) || []) {
    if (status[id]) status[id].reposted = true
  }
  const reactions = (reactionRes?.data?.reactions as Record<string, string> | undefined) || {}
  for (const [id, emoji] of Object.entries(reactions)) {
    if (status[id]) status[id].reaction = emoji
  }
  return status
}

// Ask every rendered PostCard to re-check its own status. Cheap: React
// re-runs the cards' status effect keyed on this number.
export function usePostStatusRefresh(): [number, () => void] {
  const [refreshTick, setRefreshTick] = useState(0)
  return [refreshTick, () => setRefreshTick((n) => n + 1)]
}

// PostCard hook: resolves the card's status from a preloaded map, or falls
// back to its own fetch for solo usage (post detail, search results, etc.).
// The fallback keeps PostCard drop-in compatible with pages that don't pass
// a map yet — but list pages SHOULD batch, which is the whole point.
export function usePostCardStatus(
  postId: string | undefined,
  statusMap: StatusMap | null | undefined,
  refreshTick: number
): PostStatus {
  const { user } = useAuth()
  const [status, setStatus] = useState<PostStatus>(EMPTY)
  const [selfLoaded, setSelfLoaded] = useState(false)

  const fromMap = postId ? statusMap?.[postId] : undefined
  const useMap = !!(user?._id && fromMap)

  useEffect(() => {
    if (useMap) {
      setStatus(fromMap!)
      return
    }
    // Solo fallback: single-card usage without a batch map
    if (!user?._id || !postId) return
    let cancelled = false
    setSelfLoaded(false)
    // Keyed on refreshTick: cards re-check after the viewer reposts/reacts
    Promise.all([
      api.get(`/reposts/check/${postId}`).catch(() => null),
      api.get(`/reactions/${postId}`).catch(() => null),
    ]).then(([repostRes, reactionRes]) => {
      if (cancelled) return
      const reposted = !!(repostRes?.data?.reposted)
      let reaction: string | null = null
      const grouped = reactionRes?.data?.reactions as Record<string, { _id: string }[]> | undefined
      if (grouped) {
        for (const [emoji, users] of Object.entries(grouped)) {
          if (users.some((u) => u._id === user?._id)) reaction = emoji
        }
      }
      setStatus({ reposted, reaction })
      setSelfLoaded(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?._id, refreshTick, useMap, selfLoaded])

  return status
}
