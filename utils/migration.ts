import { tokenManager } from '../services/tokenManager';

const OLD_TOKEN_KEY = 'huggingFaceToken';
const MIGRATION_FLAG_KEY = 'hf_token_migration_done';

/**
 * Migrate old single token to new token pool format
 */
export async function migrateOldToken(): Promise<boolean> {
  // Check if migration already done
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) {
    return false;
  }

  try {
    const oldToken = localStorage.getItem(OLD_TOKEN_KEY);
    
    if (oldToken && oldToken.trim()) {
      // Check if token is valid length
      const trimmedToken = oldToken.trim();
      if (trimmedToken.length >= 20 && trimmedToken.length <= 100) {
        // Check if token already exists in pool
        const existingTokens = tokenManager.getTokens();
        const alreadyExists = existingTokens.some(t => t.token === trimmedToken);
        
        if (!alreadyExists) {
          await tokenManager.addToken(trimmedToken);
          console.log('Successfully migrated old HF token to new token pool');
        }
      }
      
      // Remove old token
      localStorage.removeItem(OLD_TOKEN_KEY);
    }
    
    // Mark migration as done
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return true;
  } catch (error) {
    console.error('Failed to migrate old token:', error);
    // Still mark as done to prevent repeated attempts
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return false;
  }
}

/**
 * Run migration on app startup
 */
export function runMigration(): void {
  migrateOldToken().catch(console.error);
}
