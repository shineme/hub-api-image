type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: any;
}

const MAX_LOG_ENTRIES = 100;
const LOG_STORAGE_KEY = 'hf_logs';

class Logger {
  private logs: LogEntry[] = [];
  private enabled: boolean = true;

  constructor() {
    this.loadLogs();
  }

  private loadLogs(): void {
    try {
      const stored = localStorage.getItem(LOG_STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      this.logs = [];
    }
  }

  private saveLogs(): void {
    try {
      // Keep only last MAX_LOG_ENTRIES
      if (this.logs.length > MAX_LOG_ENTRIES) {
        this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
      }
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (error) {
      // Ignore storage errors
    }
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data
    };

    this.logs.push(entry);
    this.saveLogs();

    // Also log to console in development
    const consoleMethod = level === 'error' ? console.error :
                          level === 'warn' ? console.warn :
                          level === 'debug' ? console.debug : console.log;
    
    consoleMethod(`[${level.toUpperCase()}] ${message}`, data || '');
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  // Token-specific logging
  logTokenUsage(tokenId: string, success: boolean, responseTime?: number): void {
    this.info('Token usage', {
      tokenId: tokenId.slice(0, 8) + '...',
      success,
      responseTime
    });
  }

  logApiCall(endpoint: string, success: boolean, duration: number): void {
    this.info('API call', {
      endpoint,
      success,
      duration
    });
  }

  logRetry(attempt: number, reason: string): void {
    this.warn('Retry attempt', {
      attempt,
      reason
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
    localStorage.removeItem(LOG_STORAGE_KEY);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

export const logger = new Logger();
