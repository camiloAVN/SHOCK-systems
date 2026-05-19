import Redis from 'ioredis'

interface RateLimitEntry {
  count: number
  resetTime: number
}

const memoryStore = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetTime) memoryStore.delete(key)
  }
}, 60000)

let redisClient: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    })
    redisClient.on('error', (err: Error) => {
      console.error('[RateLimit] Redis error:', err.message)
    })
  }
  return redisClient
}

export interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  blockDurationMs?: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  blocked: boolean
}

async function checkRedis(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const client = getRedis()!
  const key = `rl:${identifier}`
  const now = Date.now()

  const pipeline = client.pipeline()
  pipeline.incr(key)
  pipeline.pttl(key)
  const results = await pipeline.exec()

  const count = results![0][1] as number
  let ttl = results![1][1] as number

  if (count === 1) {
    await client.pexpire(key, config.windowMs)
    ttl = config.windowMs
  }

  if (count > config.maxAttempts) {
    if (config.blockDurationMs && count === config.maxAttempts + 1) {
      await client.pexpire(key, config.blockDurationMs)
      ttl = config.blockDurationMs
    }
    return {
      success: false,
      remaining: 0,
      resetTime: now + (ttl > 0 ? ttl : config.windowMs),
      blocked: true,
    }
  }

  return {
    success: true,
    remaining: Math.max(0, config.maxAttempts - count),
    resetTime: now + (ttl > 0 ? ttl : config.windowMs),
    blocked: false,
  }
}

function checkMemory(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(identifier)

  if (!entry || now > entry.resetTime) {
    memoryStore.set(identifier, { count: 1, resetTime: now + config.windowMs })
    return {
      success: true,
      remaining: config.maxAttempts - 1,
      resetTime: now + config.windowMs,
      blocked: false,
    }
  }

  if (entry.count >= config.maxAttempts) {
    return { success: false, remaining: 0, resetTime: entry.resetTime, blocked: true }
  }

  entry.count++
  if (entry.count >= config.maxAttempts && config.blockDurationMs) {
    entry.resetTime = now + config.blockDurationMs
  }
  memoryStore.set(identifier, entry)

  return {
    success: true,
    remaining: Math.max(0, config.maxAttempts - entry.count),
    resetTime: entry.resetTime,
    blocked: false,
  }
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const client = getRedis()
  if (!client) return checkMemory(identifier, config)
  try {
    return await checkRedis(identifier, config)
  } catch {
    console.error('[RateLimit] Redis unavailable, using in-memory fallback')
    return checkMemory(identifier, config)
  }
}

export async function resetRateLimit(identifier: string): Promise<void> {
  const client = getRedis()
  if (!client) {
    memoryStore.delete(identifier)
    return
  }
  try {
    await client.del(`rl:${identifier}`)
  } catch {
    memoryStore.delete(identifier)
  }
}

export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const client = getRedis()
  if (!client) {
    const now = Date.now()
    const entry = memoryStore.get(identifier)
    if (!entry || now > entry.resetTime) {
      return { success: true, remaining: config.maxAttempts, resetTime: now + config.windowMs, blocked: false }
    }
    return {
      success: entry.count < config.maxAttempts,
      remaining: Math.max(0, config.maxAttempts - entry.count),
      resetTime: entry.resetTime,
      blocked: entry.count >= config.maxAttempts,
    }
  }
  try {
    const key = `rl:${identifier}`
    const [countStr, ttl] = await Promise.all([client.get(key), client.pttl(key)])
    const count = countStr ? parseInt(countStr) : 0
    const now = Date.now()
    return {
      success: count < config.maxAttempts,
      remaining: Math.max(0, config.maxAttempts - count),
      resetTime: now + (ttl > 0 ? ttl : config.windowMs),
      blocked: count >= config.maxAttempts,
    }
  } catch {
    return { success: true, remaining: config.maxAttempts, resetTime: Date.now() + config.windowMs, blocked: false }
  }
}

export const RATE_LIMIT_CONFIGS = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 30 * 60 * 1000,
  },
  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000,
  },
  contact: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,
  },
  passwordReset: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,
  },
} as const
