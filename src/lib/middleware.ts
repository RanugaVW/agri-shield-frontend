/**
 * Supabase Middleware System for Next.js
 *
 * This middleware layer provides:
 * - Request/Response logging and monitoring
 * - Error handling and retry logic
 * - Request validation
 * - Response transformation
 * - Performance tracking
 * - Rate limiting
 * - Request queuing
 */

import { supabase } from "./supabase";

// Backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// Types
export interface MiddlewareOptions {
  logRequests?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  timeout?: number;
  cache?: boolean;
  cacheDuration?: number;
}

export interface MiddlewareResponse<T> {
  data: T | null;
  error: Error | null;
  status: "success" | "error" | "timeout" | "retry_exhausted";
  timestamp: number;
  duration: number;
  retries: number;
}

export interface RequestMetrics {
  method: string;
  table: string;
  timestamp: number;
  duration: number;
  status: string;
  error?: string;
}

// Configuration
const DEFAULT_OPTIONS: MiddlewareOptions = {
  logRequests: true,
  enableRetry: true,
  maxRetries: 3,
  timeout: 30000, // 30 seconds
  cache: true,
  cacheDuration: 300000, // 5 minutes
};

// In-memory metrics and cache
const requestMetrics: RequestMetrics[] = [];
const requestCache: Map<string, { data: any; timestamp: number }> = new Map();
const requestQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;

// Rate limiting
const rateLimitMap: Map<string, number[]> = new Map();
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

/**
 * Generate cache key from operation details
 */
function generateCacheKey(
  table: string,
  operation: string,
  params?: any,
): string {
  return `${table}:${operation}:${JSON.stringify(params || {})}`;
}

/**
 * Check and enforce rate limiting
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];

  // Remove old timestamps
  const validTimestamps = timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW,
  );

  if (validTimestamps.length >= RATE_LIMIT_REQUESTS) {
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(key, validTimestamps);
  return true;
}

/**
 * Log request metrics
 */
function logMetric(
  method: string,
  table: string,
  duration: number,
  status: string,
  error?: string,
) {
  const metric: RequestMetrics = {
    method,
    table,
    timestamp: Date.now(),
    duration,
    status,
    error,
  };

  requestMetrics.push(metric);

  // Keep only last 1000 metrics
  if (requestMetrics.length > 1000) {
    requestMetrics.shift();
  }

  if (DEFAULT_OPTIONS.logRequests) {
    console.log(
      `[MIDDLEWARE] ${method} ${table} - ${status} (${duration}ms)`,
      error ? `Error: ${error}` : "",
    );
  }
}

/**
 * Log console message with middleware prefix
 */
function log(message: string, data?: any) {
  if (DEFAULT_OPTIONS.logRequests) {
    console.log(`[MIDDLEWARE] ${message}`, data || "");
  }
}

/**
 * With timeout wrapper
 */
async function withTimeout<T>(
  promise: Promise<T> | any,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs),
    ),
  ]);
}

/**
 * Retry logic with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_OPTIONS.maxRetries || 3,
): Promise<{ data: T | null; error: Error | null; retries: number }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn();
      if (attempt > 0) {
        log(`Retry successful after ${attempt} attempt(s)`);
      }
      return { data, error: null, retries: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const backoffDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
        log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${backoffDelay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  }

  return { data: null, error: lastError, retries: maxRetries };
}

/**
 * Cache decorator
 */
async function withCache<T>(
  cacheKey: string,
  fn: () => Promise<T>,
  duration: number = DEFAULT_OPTIONS.cacheDuration || 300000,
): Promise<T> {
  const now = Date.now();
  const cached = requestCache.get(cacheKey);

  if (cached && now - cached.timestamp < duration) {
    log(`Cache hit for ${cacheKey}`);
    return cached.data;
  }

  const data = await fn();
  requestCache.set(cacheKey, { data, timestamp: now });
  return data;
}

/**
 * SELECT - Fetch data
 */
export async function middlewareSelect<T>(
  table: string,
  columns: string = "*",
  filters?: Record<string, any>,
  options: MiddlewareOptions = {},
): Promise<MiddlewareResponse<T[]>> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Rate limit check
  if (!checkRateLimit(`${table}:select`)) {
    const error = new Error("Rate limit exceeded");
    logMetric("SELECT", table, 0, "rate_limited", error.message);
    return {
      data: null,
      error,
      status: "error",
      timestamp: startTime,
      duration: 0,
      retries: 0,
    };
  }

  const cacheKey = generateCacheKey(table, "select", filters);

  const executeQuery = async () => {
    let query = supabase.from(table).select(columns);

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      });
    }

    const { data, error } = await withTimeout<any>(
      query,
      mergedOptions.timeout || 30000,
    );

    if (error) throw error;
    return data;
  };

  try {
    const { data, error, retries } = await withRetry(
      mergedOptions.cache
        ? () => withCache(cacheKey, executeQuery, mergedOptions.cacheDuration)
        : executeQuery,
      mergedOptions.maxRetries,
    );

    const duration = Date.now() - startTime;

    if (error) {
      logMetric("SELECT", table, duration, "error", error.message);
      return {
        data: null,
        error,
        status:
          retries >= (mergedOptions.maxRetries || 3)
            ? "retry_exhausted"
            : "error",
        timestamp: startTime,
        duration,
        retries,
      };
    }

    logMetric("SELECT", table, duration, "success");
    return {
      data: data as T[],
      error: null,
      status: "success",
      timestamp: startTime,
      duration,
      retries,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    logMetric("SELECT", table, duration, "timeout", err.message);
    return {
      data: null,
      error: err,
      status: "timeout",
      timestamp: startTime,
      duration,
      retries: 0,
    };
  }
}

/**
 * INSERT - Create new records
 */
export async function middlewareInsert<T>(
  table: string,
  payload: any,
  options: MiddlewareOptions = {},
): Promise<MiddlewareResponse<T>> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Rate limit check
  if (!checkRateLimit(`${table}:insert`)) {
    const error = new Error("Rate limit exceeded");
    logMetric("INSERT", table, 0, "rate_limited", error.message);
    return {
      data: null,
      error,
      status: "error",
      timestamp: startTime,
      duration: 0,
      retries: 0,
    };
  }

  const executeInsert = async () => {
    const { data, error } = await withTimeout<any>(
      supabase.from(table).insert(payload).select(),
      mergedOptions.timeout || 30000,
    );

    if (error) throw error;
    return data;
  };

  try {
    const { data, error, retries } = await withRetry(
      executeInsert,
      mergedOptions.maxRetries,
    );

    const duration = Date.now() - startTime;

    if (error) {
      logMetric("INSERT", table, duration, "error", error.message);
      return {
        data: null,
        error,
        status:
          retries >= (mergedOptions.maxRetries || 3)
            ? "retry_exhausted"
            : "error",
        timestamp: startTime,
        duration,
        retries,
      };
    }

    logMetric("INSERT", table, duration, "success");

    // Clear cache for this table
    Array.from(requestCache.keys()).forEach((key) => {
      if (key.startsWith(`${table}:`)) {
        requestCache.delete(key);
      }
    });

    return {
      data: data as T,
      error: null,
      status: "success",
      timestamp: startTime,
      duration,
      retries,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    logMetric("INSERT", table, duration, "timeout", err.message);
    return {
      data: null,
      error: err,
      status: "timeout",
      timestamp: startTime,
      duration,
      retries: 0,
    };
  }
}

/**
 * UPDATE - Modify existing records
 */
export async function middlewareUpdate<T>(
  table: string,
  updates: any,
  filters: Record<string, any>,
  options: MiddlewareOptions = {},
): Promise<MiddlewareResponse<T>> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Rate limit check
  if (!checkRateLimit(`${table}:update`)) {
    const error = new Error("Rate limit exceeded");
    logMetric("UPDATE", table, 0, "rate_limited", error.message);
    return {
      data: null,
      error,
      status: "error",
      timestamp: startTime,
      duration: 0,
      retries: 0,
    };
  }

  const executeUpdate = async () => {
    let query = supabase.from(table).update(updates);

    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await withTimeout<any>(
      query.select(),
      mergedOptions.timeout || 30000,
    );

    if (error) throw error;
    return data;
  };

  try {
    const { data, error, retries } = await withRetry(
      executeUpdate,
      mergedOptions.maxRetries,
    );

    const duration = Date.now() - startTime;

    if (error) {
      logMetric("UPDATE", table, duration, "error", error.message);
      return {
        data: null,
        error,
        status:
          retries >= (mergedOptions.maxRetries || 3)
            ? "retry_exhausted"
            : "error",
        timestamp: startTime,
        duration,
        retries,
      };
    }

    logMetric("UPDATE", table, duration, "success");

    // Clear cache for this table
    Array.from(requestCache.keys()).forEach((key) => {
      if (key.startsWith(`${table}:`)) {
        requestCache.delete(key);
      }
    });

    return {
      data: data as T,
      error: null,
      status: "success",
      timestamp: startTime,
      duration,
      retries,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    logMetric("UPDATE", table, duration, "timeout", err.message);
    return {
      data: null,
      error: err,
      status: "timeout",
      timestamp: startTime,
      duration,
      retries: 0,
    };
  }
}

/**
 * DELETE - Remove records
 */
export async function middlewareDelete(
  table: string,
  filters: Record<string, any>,
  options: MiddlewareOptions = {},
): Promise<MiddlewareResponse<void>> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Rate limit check
  if (!checkRateLimit(`${table}:delete`)) {
    const error = new Error("Rate limit exceeded");
    logMetric("DELETE", table, 0, "rate_limited", error.message);
    return {
      data: null,
      error,
      status: "error",
      timestamp: startTime,
      duration: 0,
      retries: 0,
    };
  }

  const executeDelete = async () => {
    let query = supabase.from(table).delete();

    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    });

    const { error } = await withTimeout<any>(
      query,
      mergedOptions.timeout || 30000,
    );

    if (error) throw error;
  };

  try {
    const { error, retries } = await withRetry(
      executeDelete,
      mergedOptions.maxRetries,
    );

    const duration = Date.now() - startTime;

    if (error) {
      logMetric("DELETE", table, duration, "error", error.message);
      return {
        data: null,
        error,
        status:
          retries >= (mergedOptions.maxRetries || 3)
            ? "retry_exhausted"
            : "error",
        timestamp: startTime,
        duration,
        retries,
      };
    }

    logMetric("DELETE", table, duration, "success");

    // Clear cache for this table
    Array.from(requestCache.keys()).forEach((key) => {
      if (key.startsWith(`${table}:`)) {
        requestCache.delete(key);
      }
    });

    return {
      data: undefined,
      error: null,
      status: "success",
      timestamp: startTime,
      duration,
      retries,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    logMetric("DELETE", table, duration, "timeout", err.message);
    return {
      data: null,
      error: err,
      status: "timeout",
      timestamp: startTime,
      duration,
      retries: 0,
    };
  }
}

/**
 * AUTH - Sign in
 */
export async function middlewareAuthSignIn(
  email: string,
  password: string,
  options: MiddlewareOptions = {},
): Promise<MiddlewareResponse<any>> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const executeSignIn = async () => {
    // Call Backend API
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok || result.status === "error") {
      throw new Error(result.error || "Failed to sign in");
    }

    const { data } = result;

    // Sync session with local Supabase client
    if (data.session) {
      const { error } = await supabase.auth.setSession(data.session);
      if (error) throw error;
    }

    return data;
  };

  try {
    const { data, error, retries } = await withRetry(
      executeSignIn,
      mergedOptions.maxRetries,
    );

    const duration = Date.now() - startTime;

    if (error) {
      logMetric("AUTH:SIGNIN", "auth", duration, "error", error.message);
      return {
        data: null,
        error,
        status: "error",
        timestamp: startTime,
        duration,
        retries,
      };
    }

    logMetric("AUTH:SIGNIN", "auth", duration, "success");
    return {
      data,
      error: null,
      status: "success",
      timestamp: startTime,
      duration,
      retries,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    logMetric("AUTH:SIGNIN", "auth", duration, "timeout", err.message);
    return {
      data: null,
      error: err,
      status: "timeout",
      timestamp: startTime,
      duration,
      retries: 0,
    };
  }
}

/**
 * AUTH - Sign up
 */
export async function middlewareAuthSignUp(
  email: string,
  password: string,
  options: MiddlewareOptions = {},
): Promise<MiddlewareResponse<any>> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const executeSignUp = async () => {
    // Call Backend API
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok || result.status === "error") {
      throw new Error(result.error || "Failed to sign up");
    }

    const { data } = result;

    // Sync session if available
    if (data.session) {
      const { error } = await supabase.auth.setSession(data.session);
      if (error) throw error;
    }

    return data;
  };

  try {
    const { data, error, retries } = await withRetry(
      executeSignUp,
      mergedOptions.maxRetries,
    );

    const duration = Date.now() - startTime;

    if (error) {
      logMetric("AUTH:SIGNUP", "auth", duration, "error", error.message);
      return {
        data: null,
        error,
        status: "error",
        timestamp: startTime,
        duration,
        retries,
      };
    }

    logMetric("AUTH:SIGNUP", "auth", duration, "success");
    return {
      data,
      error: null,
      status: "success",
      timestamp: startTime,
      duration,
      retries,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    logMetric("AUTH:SIGNUP", "auth", duration, "timeout", err.message);
    return {
      data: null,
      error: err,
      status: "timeout",
      timestamp: startTime,
      duration,
      retries: 0,
    };
  }
}

/**
 * AUTH - Sign out
 */
export async function middlewareAuthSignOut(
  token?: string | null,
  options: MiddlewareOptions = {},
): Promise<MiddlewareResponse<void>> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const executeSignOut = async () => {
    // Call Backend API with auth token
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_URL}/auth/signout`, {
      method: "POST",
      headers,
    });

    const result = await response.json();

    if (!response.ok || result.status === "error") {
      throw new Error(result.error || "Failed to sign out");
    }

    // Sign out from local Supabase client
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  try {
    const { error, retries } = await withRetry(
      executeSignOut,
      mergedOptions.maxRetries,
    );

    const duration = Date.now() - startTime;

    if (error) {
      logMetric("AUTH:SIGNOUT", "auth", duration, "error", error.message);
      return {
        data: null,
        error,
        status: "error",
        timestamp: startTime,
        duration,
        retries,
      };
    }

    logMetric("AUTH:SIGNOUT", "auth", duration, "success");

    // Clear all caches on signout
    requestCache.clear();

    return {
      data: undefined,
      error: null,
      status: "success",
      timestamp: startTime,
      duration,
      retries,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    logMetric("AUTH:SIGNOUT", "auth", duration, "timeout", err.message);
    return {
      data: null,
      error: err,
      status: "timeout",
      timestamp: startTime,
      duration,
      retries: 0,
    };
  }
}

// Clear cache utility
export function clearCache() {
  requestCache.clear();
  log("Cache cleared");
}

// Get metrics utility
export function getMetrics(): RequestMetrics[] {
  return [...requestMetrics];
}
