import {
  HFToken,
  TokenStats,
  FailureReason,
  TokenPoolStorage,
  TokenStatsStorage,
  HFSettings,
  ErrorCode,
  APIError
} from '../types/tokenTypes';

const STORAGE_KEY_POOL = 'hf_token_pool';
const STORAGE_KEY_STATS = 'hf_token_stats';
const STORAGE_KEY_SETTINGS = 'hf_settings';

const DEFAULT_SETTINGS: HFSettings = {
  enableTokenRotation: true,
  maxRetries: 3,
  retryDelay: 2000,
  tokenDisableDuration: 5 * 60 * 1000, // 5 minutes
  requestTimeout: 30000 // 30 seconds
};

class TokenManager {
  private tokens: HFToken[] = [];
  private currentIndex: number = 0;
  private stats: Record<string, TokenStats> = {};
  private settings: HFSettings = DEFAULT_SETTINGS;

  constructor() {
    this.loadFromStorage();
  }

  // Load data from localStorage
  private loadFromStorage(): void {
    try {
      // Load token pool
      const poolData = localStorage.getItem(STORAGE_KEY_POOL);
      if (poolData) {
        const pool: TokenPoolStorage = JSON.parse(poolData);
        this.tokens = pool.tokens;
        this.currentIndex = pool.currentIndex;
      }

      // Load stats
      const statsData = localStorage.getItem(STORAGE_KEY_STATS);
      if (statsData) {
        const statsStorage: TokenStatsStorage = JSON.parse(statsData);
        this.stats = statsStorage.stats;
      }

      // Load settings
      const settingsData = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (settingsData) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsData) };
      }
    } catch (error) {
      console.error('Failed to load token manager data:', error);
    }
  }

  // Save token pool to localStorage
  private savePool(): void {
    try {
      const pool: TokenPoolStorage = {
        tokens: this.tokens,
        currentIndex: this.currentIndex,
        lastUpdated: Date.now()
      };
      localStorage.setItem(STORAGE_KEY_POOL, JSON.stringify(pool));
    } catch (error) {
      console.error('Failed to save token pool:', error);
    }
  }

  // Save stats to localStorage
  private saveStats(): void {
    try {
      const statsStorage: TokenStatsStorage = {
        stats: this.stats,
        lastUpdated: Date.now()
      };
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(statsStorage));
    } catch (error) {
      console.error('Failed to save token stats:', error);
    }
  }

  // Validate token format
  private validateToken(token: string): boolean {
    return typeof token === 'string' && token.trim().length >= 20 && token.trim().length <= 100;
  }

  // Add a new token
  async addToken(token: string): Promise<void> {
    const trimmedToken = token.trim();
    
    if (!this.validateToken(trimmedToken)) {
      throw new APIError(
        ErrorCode.TOKEN_INVALID,
        'Invalid token format. Token must be between 20 and 100 characters.'
      );
    }

    // Check for duplicates
    if (this.tokens.some(t => t.token === trimmedToken)) {
      throw new APIError(
        ErrorCode.TOKEN_INVALID,
        'Token already exists in the pool.'
      );
    }

    const newToken: HFToken = {
      id: crypto.randomUUID(),
      token: trimmedToken,
      status: 'active',
      failureCount: 0,
      lastUsed: 0,
      usageCount: 0
    };

    this.tokens.push(newToken);
    
    // Initialize stats
    this.stats[newToken.id] = {
      tokenId: newToken.id,
      usageCount: 0,
      successCount: 0,
      failureCount: 0,
      lastUsed: 0,
      averageResponseTime: 0
    };

    this.savePool();
    this.saveStats();
  }

  // Remove a token
  removeToken(tokenId: string): void {
    const index = this.tokens.findIndex(t => t.id === tokenId);
    if (index === -1) {
      throw new APIError(ErrorCode.TOKEN_INVALID, 'Token not found.');
    }

    this.tokens.splice(index, 1);
    delete this.stats[tokenId];

    // Adjust current index if necessary
    if (this.currentIndex >= this.tokens.length) {
      this.currentIndex = 0;
    }

    this.savePool();
    this.saveStats();
  }

  // Update a token
  updateToken(tokenId: string, newToken: string): void {
    const trimmedToken = newToken.trim();
    
    if (!this.validateToken(trimmedToken)) {
      throw new APIError(
        ErrorCode.TOKEN_INVALID,
        'Invalid token format. Token must be between 20 and 100 characters.'
      );
    }

    const token = this.tokens.find(t => t.id === tokenId);
    if (!token) {
      throw new APIError(ErrorCode.TOKEN_INVALID, 'Token not found.');
    }

    // Check for duplicates (excluding current token)
    if (this.tokens.some(t => t.id !== tokenId && t.token === trimmedToken)) {
      throw new APIError(
        ErrorCode.TOKEN_INVALID,
        'Token already exists in the pool.'
      );
    }

    token.token = trimmedToken;
    this.savePool();
  }

  // Get all tokens
  getTokens(): HFToken[] {
    return [...this.tokens];
  }

  // Get next available token
  getNextToken(): HFToken | null {
    if (this.tokens.length === 0) {
      return null;
    }

    const now = Date.now();
    let attempts = 0;
    const maxAttempts = this.tokens.length;

    while (attempts < maxAttempts) {
      const token = this.tokens[this.currentIndex];

      // Check if token is temporarily disabled
      if (token.disabledUntil && token.disabledUntil > now) {
        // Skip this token
        this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
        attempts++;
        continue;
      }

      // Re-enable token if disable period has passed
      if (token.disabledUntil && token.disabledUntil <= now) {
        token.disabledUntil = undefined;
        token.status = 'active';
        token.failureCount = 0;
      }

      // Move to next token for next call
      this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
      
      return token;
    }

    // All tokens are disabled
    return null;
  }

  // Mark token as successful
  markTokenSuccess(tokenId: string, responseTime?: number): void {
    const token = this.tokens.find(t => t.id === tokenId);
    if (!token) return;

    token.failureCount = 0;
    token.status = 'active';
    token.lastUsed = Date.now();
    token.usageCount++;
    delete token.disabledUntil;

    // Update stats
    const stats = this.stats[tokenId];
    if (stats) {
      stats.successCount++;
      stats.usageCount++;
      stats.lastUsed = token.lastUsed;
      
      if (responseTime !== undefined) {
        // Calculate running average
        const totalTime = stats.averageResponseTime * (stats.successCount - 1) + responseTime;
        stats.averageResponseTime = totalTime / stats.successCount;
      }
    }

    this.savePool();
    this.saveStats();
  }

  // Mark token as failed
  markTokenFailure(tokenId: string, reason: FailureReason): void {
    const token = this.tokens.find(t => t.id === tokenId);
    if (!token) return;

    token.failureCount++;
    token.lastUsed = Date.now();

    // Update status based on failure reason
    if (reason === FailureReason.QUOTA_EXCEEDED) {
      token.status = 'quota_exceeded';
    } else if (reason === FailureReason.AUTH_ERROR) {
      token.status = 'disabled';
    }

    // Temporarily disable token if it fails too many times
    if (token.failureCount >= 3) {
      token.status = 'disabled';
      token.disabledUntil = Date.now() + this.settings.tokenDisableDuration;
    }

    // Update stats
    const stats = this.stats[tokenId];
    if (stats) {
      stats.failureCount++;
      stats.usageCount++;
      stats.lastUsed = token.lastUsed;
    }

    this.savePool();
    this.saveStats();
  }

  // Get token stats
  getTokenStats(tokenId: string): TokenStats | null {
    return this.stats[tokenId] || null;
  }

  // Get all token stats
  getAllTokenStats(): TokenStats[] {
    return Object.values(this.stats);
  }

  // Reset token stats
  resetTokenStats(tokenId: string): void {
    const stats = this.stats[tokenId];
    if (stats) {
      stats.usageCount = 0;
      stats.successCount = 0;
      stats.failureCount = 0;
      stats.averageResponseTime = 0;
      this.saveStats();
    }
  }

  // Get settings
  getSettings(): HFSettings {
    return { ...this.settings };
  }

  // Update settings
  updateSettings(newSettings: Partial<HFSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();
