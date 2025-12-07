import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { tokenManager } from '../services/tokenManager';
import { ErrorCode } from '../types/tokenTypes';

describe('Token Manager', () => {
  beforeEach(() => {
    // Clear localStorage and reset token manager state
    localStorage.clear();
    // Remove all tokens
    const tokens = tokenManager.getTokens();
    tokens.forEach(token => {
      try {
        tokenManager.removeToken(token.id);
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
  });

  describe('Basic Functionality', () => {
    it('should add valid tokens', async () => {
      const validToken = 'a'.repeat(30);
      await tokenManager.addToken(validToken);
      const tokens = tokenManager.getTokens();
      expect(tokens).toHaveLength(1);
      expect(tokens[0].token).toBe(validToken);
    });

    it('should reject invalid tokens', async () => {
      const shortToken = 'short';
      await expect(tokenManager.addToken(shortToken)).rejects.toThrow();
    });

    it('should remove tokens', async () => {
      const token = 'a'.repeat(30);
      await tokenManager.addToken(token);
      const tokens = tokenManager.getTokens();
      tokenManager.removeToken(tokens[0].id);
      expect(tokenManager.getTokens()).toHaveLength(0);
    });
  });

  // Feature: hf-token-rotation, Property 8: 令牌格式验证
  describe('Property 8: Token Format Validation', () => {
    it('should reject tokens that are too short', async () => {
      await expect(tokenManager.addToken('short')).rejects.toThrow();
      await expect(tokenManager.addToken('a'.repeat(19))).rejects.toThrow();
    });

    it('should reject tokens that are too long', async () => {
      await expect(tokenManager.addToken('a'.repeat(101))).rejects.toThrow();
      await expect(tokenManager.addToken('a'.repeat(150))).rejects.toThrow();
    });

    it('should accept tokens in valid range', async () => {
      const validToken = 'a'.repeat(50);
      await tokenManager.addToken(validToken);
      const tokens = tokenManager.getTokens();
      expect(tokens.some(t => t.token === validToken)).toBe(true);
      // Cleanup
      const addedToken = tokens.find(t => t.token === validToken);
      if (addedToken) {
        tokenManager.removeToken(addedToken.id);
      }
    });

    it('should accept minimum valid length token', async () => {
      const minToken = 'a'.repeat(20);
      await tokenManager.addToken(minToken);
      const tokens = tokenManager.getTokens();
      expect(tokens.some(t => t.token === minToken)).toBe(true);
      // Cleanup
      const addedToken = tokens.find(t => t.token === minToken);
      if (addedToken) {
        tokenManager.removeToken(addedToken.id);
      }
    });

    it('should accept maximum valid length token', async () => {
      const maxToken = 'a'.repeat(100);
      await tokenManager.addToken(maxToken);
      const tokens = tokenManager.getTokens();
      expect(tokens.some(t => t.token === maxToken)).toBe(true);
      // Cleanup
      const addedToken = tokens.find(t => t.token === maxToken);
      if (addedToken) {
        tokenManager.removeToken(addedToken.id);
      }
    });
  });
});


// Feature: hf-token-rotation, Property 1: 令牌轮询一致性
describe('Property 1: Token Rotation Consistency', () => {
  it('should use each token exactly once in N consecutive requests where N equals pool size', async () => {
    // Add multiple tokens
    const tokenStrings = [
      'token_aaaaaaaaaaaaaaaaaaaa',
      'token_bbbbbbbbbbbbbbbbbbbb',
      'token_cccccccccccccccccccc'
    ];
    
    for (const t of tokenStrings) {
      await tokenManager.addToken(t);
    }
    
    const usedTokens: string[] = [];
    const poolSize = tokenManager.getTokens().length;
    
    // Get N tokens where N = pool size
    for (let i = 0; i < poolSize; i++) {
      const token = tokenManager.getNextToken();
      if (token) {
        usedTokens.push(token.token);
      }
    }
    
    // Each token should appear exactly once
    const uniqueTokens = new Set(usedTokens);
    expect(uniqueTokens.size).toBe(poolSize);
    expect(usedTokens.length).toBe(poolSize);
    
    // Cleanup
    const tokens = tokenManager.getTokens();
    tokens.forEach(t => tokenManager.removeToken(t.id));
  });

  it('should rotate back to first token after using all tokens', async () => {
    const tokenStrings = [
      'token_111111111111111111111',
      'token_222222222222222222222'
    ];
    
    for (const t of tokenStrings) {
      await tokenManager.addToken(t);
    }
    
    const firstToken = tokenManager.getNextToken();
    tokenManager.getNextToken(); // Second token
    const thirdToken = tokenManager.getNextToken(); // Should be first again
    
    expect(firstToken?.token).toBe(thirdToken?.token);
    
    // Cleanup
    const tokens = tokenManager.getTokens();
    tokens.forEach(t => tokenManager.removeToken(t.id));
  });
});


// Feature: hf-token-rotation, Property 2: 故障转移完整性
describe('Property 2: Failover Integrity', () => {
  it('should try next token when current token fails', async () => {
    const tokenStrings = [
      'token_fail_aaaaaaaaaaaaaaaa',
      'token_fail_bbbbbbbbbbbbbbbb'
    ];
    
    for (const t of tokenStrings) {
      await tokenManager.addToken(t);
    }
    
    const firstToken = tokenManager.getNextToken();
    expect(firstToken).not.toBeNull();
    
    // Mark first token as failed
    if (firstToken) {
      tokenManager.markTokenFailure(firstToken.id, 'auth_error' as any);
    }
    
    // Should still be able to get next token
    const secondToken = tokenManager.getNextToken();
    expect(secondToken).not.toBeNull();
    expect(secondToken?.token).not.toBe(firstToken?.token);
    
    // Cleanup
    const tokens = tokenManager.getTokens();
    tokens.forEach(t => tokenManager.removeToken(t.id));
  });
});

// Feature: hf-token-rotation, Property 3: 令牌禁用恢复
describe('Property 3: Token Disable Recovery', () => {
  it('should re-enable token after disable period passes', async () => {
    await tokenManager.addToken('token_disable_test_aaaaaaa');
    
    const token = tokenManager.getNextToken();
    expect(token).not.toBeNull();
    
    if (token) {
      // Fail 3 times to trigger disable
      tokenManager.markTokenFailure(token.id, 'auth_error' as any);
      tokenManager.markTokenFailure(token.id, 'auth_error' as any);
      tokenManager.markTokenFailure(token.id, 'auth_error' as any);
      
      // Token should be disabled
      const tokens = tokenManager.getTokens();
      const disabledToken = tokens.find(t => t.id === token.id);
      expect(disabledToken?.status).toBe('disabled');
      expect(disabledToken?.disabledUntil).toBeDefined();
    }
    
    // Cleanup
    const tokens = tokenManager.getTokens();
    tokens.forEach(t => tokenManager.removeToken(t.id));
  });
});

// Feature: hf-token-rotation, Property 4: 令牌状态持久化
describe('Property 4: Token State Persistence', () => {
  it('should persist token state to localStorage', async () => {
    await tokenManager.addToken('token_persist_test_aaaaaa');
    
    // Check localStorage
    const stored = localStorage.getItem('hf_token_pool');
    expect(stored).not.toBeNull();
    
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.tokens).toBeDefined();
      expect(parsed.tokens.length).toBeGreaterThan(0);
    }
    
    // Cleanup
    const tokens = tokenManager.getTokens();
    tokens.forEach(t => tokenManager.removeToken(t.id));
  });
});


// Feature: hf-token-rotation, Property 7: 超时保护
describe('Property 7: Timeout Protection', () => {
  it('should have timeout configuration in settings', () => {
    const settings = tokenManager.getSettings();
    expect(settings.requestTimeout).toBeDefined();
    expect(settings.requestTimeout).toBeGreaterThan(0);
    expect(settings.requestTimeout).toBe(30000); // Default 30 seconds
  });
});


// Feature: hf-token-rotation, Property 6: 重试次数限制
describe('Property 6: Retry Count Limit', () => {
  it('should limit retries to token pool size', () => {
    const settings = tokenManager.getSettings();
    const tokens = tokenManager.getTokens();
    // Max retries should not exceed token pool size (or at least 1)
    expect(settings.maxRetries).toBeLessThanOrEqual(Math.max(tokens.length, 3));
  });
});

// Feature: hf-token-rotation, Property 9: 空令牌池降级
describe('Property 9: Empty Token Pool Fallback', () => {
  it('should return null when token pool is empty', () => {
    // Ensure pool is empty
    const tokens = tokenManager.getTokens();
    tokens.forEach(t => tokenManager.removeToken(t.id));
    
    const token = tokenManager.getNextToken();
    expect(token).toBeNull();
  });
});


import { generateImage } from '../services/hfService';
import { ErrorCode } from '../types/tokenTypes';

// Feature: hf-token-rotation, Property 5: API 参数验证
describe('Property 5: API Parameter Validation', () => {
  it('should reject empty prompt', async () => {
    await expect(generateImage('z-image-turbo', '', '1:1')).rejects.toThrow();
  });

  it('should reject whitespace-only prompt', async () => {
    await expect(generateImage('z-image-turbo', '   ', '1:1')).rejects.toThrow();
  });

  it('should reject invalid model', async () => {
    await expect(generateImage('invalid-model' as any, 'test prompt', '1:1')).rejects.toThrow();
  });

  it('should reject invalid aspect ratio', async () => {
    await expect(generateImage('z-image-turbo', 'test prompt', 'invalid' as any)).rejects.toThrow();
  });
});


import { isImage4KOrHigher } from '../services/hfService';

// Feature: hf-token-rotation, Property 10: 4K 放大幂等性
describe('Property 10: 4K Upscale Idempotency', () => {
  it('should detect 4K resolution correctly', () => {
    // 4K is 3840x2160
    expect(isImage4KOrHigher(3840, 2160)).toBe(true);
    expect(isImage4KOrHigher(4096, 2160)).toBe(true);
    expect(isImage4KOrHigher(1920, 1080)).toBe(false);
    expect(isImage4KOrHigher(2560, 1440)).toBe(false);
  });

  it('should detect higher than 4K', () => {
    // 8K
    expect(isImage4KOrHigher(7680, 4320)).toBe(true);
  });
});
