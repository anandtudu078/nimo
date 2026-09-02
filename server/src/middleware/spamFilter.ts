// Basic content moderation / spam filter
// Checks for common spam patterns and profanity

const SPAM_PATTERNS = [
  /https?:\/\/[^\s]+\.(xyz|tk|ml|ga|cf|gq)\b/i, // Suspicious TLDs
  /\b(buy now|click here|limited time|act now|free money|make money fast|work from home|no cost|winner|congratulations you won)\b/i,
  /(.)\1{7,}/, // Repeated characters (8+)
  /(.{2,})\1{3,}/, // Repeated phrases (4+ times)
  /\b\d{10,}\b/, // Long digit sequences (phone number spam)
]

const PROFANITY_LIST: string[] = [
  // Basic profanity list - expand as needed
  // This is a minimal set; consider using a library like 'bad-words' for production
]

export interface SpamCheckResult {
  isSpam: boolean
  reasons: string[]
  confidence: number // 0-1
}

export function checkContent(content: string): SpamCheckResult {
  const reasons: string[] = []
  let confidence = 0

  if (!content || content.trim().length === 0) {
    return { isSpam: false, reasons: [], confidence: 0 }
  }

  // Check spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      reasons.push(`Matches spam pattern: ${pattern.source.slice(0, 30)}...`)
      confidence += 0.3
    }
  }

  // Check for excessive mentions (@)
  const mentions = content.match(/@\w+/g) || []
  if (mentions.length > 5) {
    reasons.push(`Excessive mentions: ${mentions.length}`)
    confidence += 0.2
  }

  // Check for excessive hashtags
  const hashtags = content.match(/#\w+/g) || []
  if (hashtags.length > 10) {
    reasons.push(`Excessive hashtags: ${hashtags.length}`)
    confidence += 0.2
  }

  // Check for all caps (more than 70% uppercase letters)
  const letters = content.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 10) {
    const upperCount = (content.match(/[A-Z]/g) || []).length
    if (upperCount / letters.length > 0.7) {
      reasons.push('Excessive use of uppercase')
      confidence += 0.15
    }
  }

  // Check for excessive emojis (more than 10)
  const emojiCount = (content.match(/[\u{1F600}-\u{1F9FF}]/gu) || []).length
  if (emojiCount > 10) {
    reasons.push(`Excessive emojis: ${emojiCount}`)
    confidence += 0.1
  }

  // Check for duplicate content patterns
  const words = content.split(/\s+/)
  if (words.length > 5) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase()))
    const uniqueness = uniqueWords.size / words.length
    if (uniqueness < 0.3) {
      reasons.push('Low word diversity (possible spam repetition)')
      confidence += 0.25
    }
  }

  // Cap confidence at 1
  confidence = Math.min(confidence, 1)

  return {
    isSpam: confidence >= 0.5,
    reasons,
    confidence,
  }
}

// Middleware to check post content
export function spamFilter(req: any, res: any, next: any) {
  const content = req.body.content || ''
  const result = checkContent(content)

  if (result.isSpam) {
    console.log(`[SpamFilter] Blocked content from user ${req.userId}:`, result.reasons)
    return res.status(400).json({
      message: 'Content flagged as potential spam',
      reasons: result.reasons,
      confidence: result.confidence,
    })
  }

  // Attach spam check result to request for logging
  req.spamCheck = result
  next()
}
