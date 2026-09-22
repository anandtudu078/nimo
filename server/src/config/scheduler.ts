import cron from 'node-cron'
import Draft from '../models/Draft'
import Post from '../models/Post'
import Hashtag from '../models/Hashtag'
import { checkContent } from '../middleware/spamFilter'

// ---------------------------------------------------------------------------
// Scheduled drafts publisher
//
// Drafts with status 'scheduled' and a scheduledAt in the past are published
// here by a background job. Runs every minute. Claim-and-publish is guarded
// by an atomic findOneAndUpdate so concurrent server instances (or the next
// tick) can never publish the same draft twice.
// ---------------------------------------------------------------------------

function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g)
  return matches ? [...new Set(matches.map((h) => h.slice(1).toLowerCase()))] : []
}

async function publishDueDrafts(): Promise<void> {
  try {
    // Claim up to 10 due drafts atomically (status flips to 'published'
    // immediately, so no other worker can pick them up).
    for (let i = 0; i < 10; i++) {
      const draft = await Draft.findOneAndUpdate(
        { status: 'scheduled', scheduledAt: { $lte: new Date() } },
        { $set: { status: 'published' } },
        { new: true, sort: { scheduledAt: 1 } }
      )
      if (!draft) break

      // The compose routes validate content before persisting; a scheduled
      // draft gets the same treatment at publish time.
      const content = (draft.content || '').trim()
      const images = Array.isArray(draft.images) ? draft.images : []
      if (!content && images.length === 0) {
        console.warn(`[Scheduler] Draft ${draft._id} is empty — skipped`)
        continue
      }
      if (content.length > 280) {
        console.warn(`[Scheduler] Draft ${draft._id} exceeds 280 chars — published truncated-free but flagged`)
      }
      if (checkContent(content).isSpam) {
        console.warn(`[Scheduler] Draft ${draft._id} flagged as spam — skipped`)
        continue
      }

      const post = await Post.create({
        author: draft.author,
        content: draft.content,
        images,
      })
      await post.populate('author', 'username displayName avatar')

      // Track hashtags so trending counts stay consistent with normal posting
      const tags = extractHashtags(content)
      for (const tag of tags) {
        await Hashtag.findOneAndUpdate(
          { tag },
          { $inc: { count: 1 }, $set: { lastUsed: new Date() } },
          { upsert: true }
        )
      }

      console.log(`[Scheduler] Published scheduled draft ${draft._id} as post ${post._id}`)
    }
  } catch (error: any) {
    console.error('[Scheduler] publishDueDrafts failed:', error.message)
  }
}

export function startScheduler(): void {
  cron.schedule('* * * * *', publishDueDrafts)
  console.log('[Scheduler] Scheduled-draft publisher started (runs every minute)')
}

// Exported for tests / manual triggers
export { publishDueDrafts }
