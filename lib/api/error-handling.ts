// @MX:NOTE [AUTO] API error handling utilities for Traceability integration.
// @MX:SPEC SPEC-INTEGRATION-001 (issue #169)

/**
 * Standard error types for API operations
 */
export class TraceabilityApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
  ) {
    super(message);
    this.name = 'TraceabilityApiError';
  }
}

/**
 * Parse error response from API
 */
export function parseApiError(response: Response): Promise<TraceabilityApiError> {
  return response
    .json()
    .then((data) => {
      const message = data.error || data.message || 'Unknown API error';
      return new TraceabilityApiError(message, response.status, response.url);
    })
    .catch(() => {
      return new TraceabilityApiError(
        'Failed to parse error response',
        response.status,
        response.url,
      );
    });
}

/**
 * Handle API errors with user-friendly messages
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof TraceabilityApiError) {
    if (error.statusCode === 401) {
      return '인증이 필요합니다. 다시 로그인해 주세요.';
    }
    if (error.statusCode === 403) {
      return '접근 권한이 없습니다.';
    }
    if (error.statusCode === 404) {
      return '요청하신 리소스를 찾을 수 없습니다.';
    }
    if (error.statusCode === 500) {
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '알 수 없는 오류가 발생했습니다.';
}

/**
 * Retry configuration for API requests
 */
export interface RetryConfig {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Execute API call with retry logic
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 2 } = config;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry client errors (4xx)
      if (
        error instanceof TraceabilityApiError &&
        error.statusCode &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        throw error;
      }

      // Wait before retry with exponential backoff
      const delay = delayMs * backoffMultiplier ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after retries');
}
