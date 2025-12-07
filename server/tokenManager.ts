// Server-side token manager (file-based storage instead of localStorage)
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface HFToken {
  id: string;
  token: string;
  name?: string;
  isDisabled: boolean;
  disabledUntil: number | null;
  consecutiveFailures: number;
  createdAt: number;
}

export interface TokenStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  lastUsed: number | null;
  averageResponseTime: number;
}

export interface HFSettings {
  enableTokenRotation: boolean;
  requestTimeout: number;
  tokenDisableDuration: number;
  maxConsecutiveFailures: number;
}

export enum FailureReason {
  AUTH_ERROR = 'AUTH_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR'
}

const DEFAULT_SETTINGS: HFSettings = {
  enableTokenRotation: true,
  requestTimeout: 30000,
  tokenDisableDuration: 300000,
  maxConsecutiveFailures: 3
};

class ServerTokenManager {
  private tokens: HFToken[] = [];
  private stats: Record<string, TokenStats> = {};
  private settings: HFSettings = DEFAULT_SETTINGS;
  private currentIndex: number = 0;

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        this.tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
      }
      if (fs.existsSync(STATS_FILE)) {
        this.stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
      }
      if (fs.existsSync(SETTINGS_FILE)) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
      }
    } catch (error) {
      console.error('Failed to load token data:', error);
    }
  }

  private saveTokens(): void {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(this.tokens, null, 2));
  }

  private saveStats(): void {
    fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2));
  }

  private saveSettings(): void {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
  }

  addToken(token: string, name?: string): boolean {
    if (!token || token.length < 10 || token.length > 200) return false;
    if (this.tokens.some(t => t.token === token)) return false;

    const newToken: HFToken = {
      id: crypto.randomUUID(),
      token,
      name,
      isDisabled: false,
      disabledUntil: null,
      consecutiveFailures: 0,
      createdAt: Date.now()
    };

    this.tokens.push(newToken);
    this.stats[newToken.id] = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      lastUsed: null,
      averageResponseTime: 0
    };

    this.saveTokens();
    this.saveStats();
    return true;
  }

  removeToken(tokenId: string): boolean {
    const index = this.tokens.findIndex(t => t.id === tokenId);
    if (index === -1) return false;

    this.tokens.splice(index, 1);
    delete this.stats[tokenId];

    this.saveTokens();
    this.saveStats();
    return true;
  }

  getTokens(): HFToken[] {
    return [...this.tokens];
  }

  getNextToken(): HFToken | null {
    if (this.tokens.length === 0) return null;

    const now = Date.now();
    const availableTokens = this.tokens.filter(t => {
      if (!t.isDisabled) return true;
      if (t.disabledUntil && t.disabledUntil <= now) {
        t.isDisabled = false;
        t.disabledUntil = null;
        t.consecutiveFailures = 0;
        return true;
      }
      return false;
    });

    if (availableTokens.length === 0) return null;

    this.currentIndex = this.currentIndex % availableTokens.length;
    const token = availableTokens[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % availableTokens.length;

    return token;
  }

  markTokenSuccess(tokenId: string, responseTime: number): void {
    const token = this.tokens.find(t => t.id === tokenId);
    if (!token) return;

    token.consecutiveFailures = 0;
    token.isDisabled = false;
    token.disabledUntil = null;

    if (!this.stats[tokenId]) {
      this.stats[tokenId] = { totalRequests: 0, successCount: 0, failureCount: 0, lastUsed: null, averageResponseTime: 0 };
    }

    const stats = this.stats[tokenId];
    stats.totalRequests++;
    stats.successCount++;
    stats.lastUsed = Date.now();
    stats.averageResponseTime = (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;

    this.saveTokens();
    this.saveStats();
  }

  markTokenFailure(tokenId: string, reason: FailureReason): void {
    const token = this.tokens.find(t => t.id === tokenId);
    if (!token) return;

    token.consecutiveFailures++;

    if (token.consecutiveFailures >= this.settings.maxConsecutiveFailures) {
      token.isDisabled = true;
      token.disabledUntil = Date.now() + this.settings.tokenDisableDuration;
    }

    if (!this.stats[tokenId]) {
      this.stats[tokenId] = { totalRequests: 0, successCount: 0, failureCount: 0, lastUsed: null, averageResponseTime: 0 };
    }

    const stats = this.stats[tokenId];
    stats.totalRequests++;
    stats.failureCount++;
    stats.lastUsed = Date.now();

    this.saveTokens();
    this.saveStats();
  }

  getAllTokenStats(): Record<string, TokenStats> {
    return { ...this.stats };
  }

  getSettings(): HFSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<HFSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }
}

export const tokenManager = new ServerTokenManager();
