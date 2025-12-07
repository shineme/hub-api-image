// Token Types and Interfaces

export interface HFToken {
  id: string;
  token: string;
  status: 'active' | 'disabled' | 'quota_exceeded';
  failureCount: number;
  lastUsed: number;
  disabledUntil?: number;
  usageCount: number;
}

export interface TokenStats {
  tokenId: string;
  usageCount: number;
  successCount: number;
  failureCount: number;
  lastUsed: number;
  averageResponseTime: number;
}

export enum FailureReason {
  AUTH_ERROR = 'auth_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  SERVER_ERROR = 'server_error'
}

export enum ErrorCode {
  // Token related
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_QUOTA_EXCEEDED = 'TOKEN_QUOTA_EXCEEDED',
  ALL_TOKENS_FAILED = 'ALL_TOKENS_FAILED',
  NO_TOKENS_AVAILABLE = 'NO_TOKENS_AVAILABLE',
  
  // Network related
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  
  // Parameter related
  INVALID_PARAMS = 'INVALID_PARAMS',
  INVALID_IMAGE_URL = 'INVALID_IMAGE_URL',
  
  // Service related
  GENERATION_FAILED = 'GENERATION_FAILED',
  UPSCALE_FAILED = 'UPSCALE_FAILED'
}

export class APIError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Storage Interfaces
export interface TokenPoolStorage {
  tokens: HFToken[];
  currentIndex: number;
  lastUpdated: number;
}

export interface TokenStatsStorage {
  stats: Record<string, TokenStats>;
  lastUpdated: number;
}

export interface HFSettings {
  enableTokenRotation: boolean;
  maxRetries: number;
  retryDelay: number;
  tokenDisableDuration: number; // milliseconds
  requestTimeout: number; // milliseconds
}

// API Client Interfaces
export interface RequestConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  responseTime: number;
}
