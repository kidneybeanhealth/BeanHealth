/**
 * Request Utilities for BeanHealth
 * 
 * FIXES APPLIED:
 * - Add timeout handling for all async operations
 * - Implement retry logic with exponential backoff
 * - Provide AbortController utilities for cleanup
 * - Add request queue to prevent duplicate requests
 * 
 * WHY: Prevents infinite loading states and provides graceful handling of network issues
 */

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds (default: 30000)
 * @param errorMessage Custom error message
 * @returns Promise that rejects if timeout is reached
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000,
  errorMessage: string = 'Request timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Default retry predicate - retry on network errors and 5xx errors
 */
const defaultShouldRetry = (error: any): boolean => {
  // Don't retry auth errors
  if (error?.message?.includes('JWT') || error?.message?.includes('expired') || error?.message?.includes('invalid')) {
    return false;
  }
  
  // Retry network errors
  if (error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('timeout')) {
    return true;
  }
  
  // Retry 5xx server errors
  if (error?.status >= 500 && error?.status < 600) {
    return true;
  }
  
  return false;
};

/**
 * Retry a promise with exponential backoff
 * @param fn Function that returns a promise
 * @param config Retry configuration
 * @returns Promise that resolves/rejects after retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
  } = config;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      console.warn(`[RequestUtils] Attempt ${attempt}/${maxAttempts} failed:`, error);
      
      // Don't retry if we've exhausted attempts or if error is not retryable
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      console.log(`[RequestUtils] Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Combines timeout and retry for robust async operations
 * @param fn Function that returns a promise
 * @param timeoutMs Timeout in milliseconds
 * @param retryConfig Retry configuration
 * @returns Promise with timeout and retry handling
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000,
  retryConfig: RetryConfig = {}
): Promise<T> {
  return withRetry(
    () => withTimeout(fn(), timeoutMs),
    retryConfig
  );
}

/**
 * Request deduplication map to prevent duplicate in-flight requests
 */
const requestCache = new Map<string, Promise<any>>();

/**
 * Deduplicates identical requests that are in-flight
 * @param key Unique key for the request
 * @param fn Function that returns a promise
 * @returns Promise that resolves with the result
 */
export async function withDeduplication<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Check if request is already in-flight
  if (requestCache.has(key)) {
    console.log(`[RequestUtils] Reusing in-flight request: ${key}`);
    return requestCache.get(key);
  }

  // Start new request
  const promise = fn()
    .finally(() => {
      // Remove from cache when complete
      requestCache.delete(key);
    });

  requestCache.set(key, promise);
  return promise;
}

/**
 * AbortController manager for cleanup
 */
export class AbortManager {
  private controllers = new Map<string, AbortController>();

  /**
   * Create or get an AbortController for a key
   */
  getController(key: string): AbortController {
    if (!this.controllers.has(key)) {
      this.controllers.set(key, new AbortController());
    }
    return this.controllers.get(key)!;
  }

  /**
   * Abort a specific request
   */
  abort(key: string): void {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
      this.controllers.delete(key);
    }
  }

  /**
   * Abort all requests
   */
  abortAll(): void {
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear();
  }

  /**
   * Check if a request is aborted
   */
  isAborted(key: string): boolean {
    const controller = this.controllers.get(key);
    return controller ? controller.signal.aborted : false;
  }

  /**
   * Clean up a controller
   */
  cleanup(key: string): void {
    this.controllers.delete(key);
  }
}

/**
 * Create a fetch wrapper that respects AbortSignal
 */
export async function fetchWithAbort(
  url: string,
  options: RequestInit & { signal?: AbortSignal } = {}
): Promise<Response> {
  const response = await fetch(url, options);
  
  // Throw on non-OK responses
  if (!response.ok) {
    const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
    error.status = response.status;
    throw error;
  }
  
  return response;
}

/**
 * Debounce function for user input
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return function debounced(...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun;
    
    if (timeSinceLastRun >= limitMs) {
      fn(...args);
      lastRun = now;
    } else {
      // Schedule for later if not already scheduled
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          fn(...args);
          lastRun = Date.now();
          timeoutId = null;
        }, limitMs - timeSinceLastRun);
      }
    }
  };
}

/**
 * Safe async function wrapper that always resolves loading state
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  onFinally?: () => void
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    console.error('[safeAsync] Error:', error);
    return { data: null, error: error as Error };
  } finally {
    onFinally?.();
  }
}
