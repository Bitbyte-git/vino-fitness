// In-memory cache map
const memoryCache = new Map();

/**
 * In-memory cache-aside service
 */
const cacheService = {
  /**
   * Get value from cache (Memory -> null)
   */
  async get(key) {
    const entry = memoryCache.get(key);
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        return entry.value;
      }
      memoryCache.delete(key);
    }
    return null;
  },

  /**
   * Set value in cache with TTL in seconds (default 1 hour)
   */
  async set(key, value, ttlSeconds = 3600) {
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  },

  /**
   * Delete key from cache
   */
  async del(key) {
    memoryCache.delete(key);
  },

  /**
   * Invalidate multiple keys by pattern (e.g., 'gym:plans:*')
   */
  async delPattern(pattern) {
    const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) memoryCache.delete(key);
    }
  },

  /**
   * Wrap an async DB function with Cache-Aside pattern
   */
  async wrap(key, ttlSeconds, fetchFunction) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fresh = await fetchFunction();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  },
};

module.exports = cacheService;
