// Redis Caching Layer
// Requires REDIS_URL env var (e.g., redis://localhost:6379)
// Falls back to in-memory cache if Redis is not available

const REDIS_URL = process.env.REDIS_URL

interface CacheEntry {
  value: any
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key)
      }
    }
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return JSON.stringify(entry.value)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds
      ? Date.now() + ttlSeconds * 1000
      : Date.now() + 3600 * 1000 // Default 1 hour
    this.store.set(key, { value: JSON.parse(value), expiresAt })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async delPattern(pattern: string): Promise<void> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key)
      }
    }
  }

  async flush(): Promise<void> {
    this.store.clear()
  }

  disconnect() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

class RedisCache {
  private client: any = null
  connected = false

  async connect(): Promise<void> {
    if (!REDIS_URL) return

    try {
      // Dynamic import to avoid hard dependency
      const redis = await import('redis')
      this.client = redis.createClient({ url: REDIS_URL })

      this.client.on('error', (err: any) => {
        console.error('[Redis] Error:', err.message)
        this.connected = false
      })

      this.client.on('connect', () => {
        this.connected = true
        console.log('[Redis] Connected')
      })

      await this.client.connect()
    } catch (error: any) {
      console.warn('[Redis] Failed to connect, using memory cache:', error.message)
      this.client = null
      this.connected = false
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected || !this.client) return null
    try {
      return await this.client.get(key)
    } catch {
      return null
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.connected || !this.client) return
    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value)
      } else {
        await this.client.set(key, value)
      }
    } catch {}
  }

  async del(key: string): Promise<void> {
    if (!this.connected || !this.client) return
    try {
      await this.client.del(key)
    } catch {}
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.connected || !this.client) return
    try {
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(keys)
      }
    } catch {}
  }

  async flush(): Promise<void> {
    if (!this.connected || !this.client) return
    try {
      await this.client.flushDb()
    } catch {}
  }

  disconnect() {
    if (this.client) {
      this.client.quit()
    }
  }
}

// Use Redis if available, otherwise fall back to memory cache
const redisCache = new RedisCache()
const memoryCache = new MemoryCache()

export const cache = redisCache.connected ? redisCache : memoryCache

export async function initCache(): Promise<void> {
  if (REDIS_URL) {
    await redisCache.connect()
    if (redisCache.connected) {
      console.log('[Cache] Using Redis')
    } else {
      console.log('[Cache] Redis unavailable, using in-memory cache')
    }
  } else {
    console.log('[Cache] No REDIS_URL, using in-memory cache')
  }
}

// Cache helper: get or compute
export async function cached<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSeconds: number = 300 // 5 minutes default
): Promise<T> {
  const cachedValue = await cache.get(key)
  if (cachedValue) {
    return JSON.parse(cachedValue) as T
  }

  const value = await compute()
  await cache.set(key, JSON.stringify(value), ttlSeconds)
  return value
}

// Cache key generators
export const cacheKeys = {
  trendingHashtags: () => 'trending:hashtags',
  userProfile: (userId: string) => `user:${userId}:profile`,
  userPosts: (userId: string, page: number) => `user:${userId}:posts:${page}`,
  postDetail: (postId: string) => `post:${postId}`,
  feed: (page: number) => `feed:${page}`,
  exploreFeed: (page: number) => `explore:${page}`,
  searchResults: (query: string, type: string) => `search:${type}:${query}`,
}
