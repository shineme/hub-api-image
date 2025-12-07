import { RequestConfig, APIResponse, ErrorCode, APIError } from '../types/tokenTypes';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

export class APIClient {
  private currentToken: string | null = null;

  setToken(token: string | null): void {
    this.currentToken = token;
  }

  getToken(): string | null {
    return this.currentToken;
  }

  async request<T>(config: RequestConfig): Promise<APIResponse<T>> {
    const timeout = config.timeout || DEFAULT_TIMEOUT;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config.headers
      };

      if (this.currentToken) {
        headers['Authorization'] = `Bearer ${this.currentToken}`;
      }

      const response = await fetch(config.url, {
        method: config.method,
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // Handle different error status codes
      if (!response.ok) {
        const errorCode = this.mapStatusToErrorCode(response.status);
        throw new APIError(
          errorCode,
          `HTTP error: ${response.status} ${response.statusText}`,
          { status: response.status }
        );
      }

      const data = await response.json() as T;
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        data,
        status: response.status,
        headers: responseHeaders,
        responseTime
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof APIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new APIError(
            ErrorCode.TIMEOUT_ERROR,
            `Request timed out after ${timeout}ms`
          );
        }

        // Network error
        throw new APIError(
          ErrorCode.NETWORK_ERROR,
          error.message || 'Network error occurred'
        );
      }

      throw new APIError(
        ErrorCode.NETWORK_ERROR,
        'Unknown error occurred'
      );
    }
  }

  private mapStatusToErrorCode(status: number): ErrorCode {
    if (status === 401 || status === 403) {
      return ErrorCode.TOKEN_INVALID;
    }
    if (status === 429) {
      return ErrorCode.TOKEN_QUOTA_EXCEEDED;
    }
    if (status >= 500) {
      return ErrorCode.SERVER_ERROR;
    }
    return ErrorCode.NETWORK_ERROR;
  }
}

// Export singleton instance
export const apiClient = new APIClient();
