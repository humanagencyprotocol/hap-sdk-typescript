/**
 * HAP Client - HTTP client for HAP Service Provider
 *
 * Handles:
 * - Requesting Inquiry Blueprints
 * - Sending Feedback
 * - Schema validation (request/response)
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - API key authentication (with redaction in errors)
 *
 * @packageDocumentation
 */

import type { InquiryBlueprint, InquiryRequest, FeedbackPayload } from "../types";
import {
  InquiryBlueprintSchema,
  InquiryRequestSchema,
  FeedbackPayloadSchema,
} from "../types/schemas";
import {
  NetworkError,
  TimeoutError,
  ValidationError,
  ServiceError,
  CircuitOpenError,
  AuthenticationError,
} from "../types/errors";

/**
 * Configuration for HapClient
 */
export interface HapClientConfig {
  /** HAP Service Provider endpoint URL */
  endpoint: string;

  /** API key for authentication */
  apiKey: string;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /** Initial retry delay in milliseconds (default: 1000) */
  retryDelay?: number;

  /** Circuit breaker failure threshold (default: 5) */
  circuitBreakerThreshold?: number;

  /** Circuit breaker reset timeout in milliseconds (default: 60000) */
  circuitBreakerResetTimeout?: number;
}

/**
 * Circuit breaker state
 */
type CircuitState = "closed" | "open" | "half-open";

/**
 * HAP Client for interacting with HAP Service Provider
 */
export class HapClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerResetTimeout: number;

  // Circuit breaker state
  private circuitState: CircuitState = "closed";
  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(config: HapClientConfig) {
    // Validate configuration
    if (!config.endpoint) {
      throw new ValidationError("endpoint is required");
    }
    if (!config.apiKey) {
      throw new AuthenticationError("API key is required");
    }

    // Ensure HTTPS
    if (config.endpoint.startsWith("http://")) {
      config.endpoint = config.endpoint.replace("http://", "https://");
    }

    this.endpoint = config.endpoint.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.circuitBreakerThreshold = config.circuitBreakerThreshold ?? 5;
    this.circuitBreakerResetTimeout = config.circuitBreakerResetTimeout ?? 60000;
  }

  /**
   * Request an Inquiry Blueprint from the HAP Service
   *
   * @param request - Structural inquiry request
   * @returns Inquiry Blueprint
   * @throws NetworkError, ValidationError, ServiceError, CircuitOpenError
   */
  async requestInquiryBlueprint(request: InquiryRequest): Promise<InquiryBlueprint> {
    // Validate request BEFORE sending
    const validationResult = InquiryRequestSchema.safeParse(request);
    if (!validationResult.success) {
      throw new ValidationError("Invalid InquiryRequest", {
        issues: validationResult.error.issues,
      });
    }

    // Make request with retry logic
    const response = await this.makeRequest<InquiryBlueprint>(
      "/v1/inquiry/blueprints",
      "POST",
      request
    );

    // Validate response
    const blueprintValidation = InquiryBlueprintSchema.safeParse(response);
    if (!blueprintValidation.success) {
      throw new ValidationError("Invalid InquiryBlueprint response from service", {
        issues: blueprintValidation.error.issues,
      });
    }

    return blueprintValidation.data;
  }

  /**
   * Send structural feedback to the HAP Service
   *
   * @param payload - Structural feedback payload
   * @throws NetworkError, ValidationError, ServiceError, CircuitOpenError
   */
  async sendFeedback(payload: FeedbackPayload): Promise<void> {
    // Validate payload BEFORE sending
    const validationResult = FeedbackPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError("Invalid FeedbackPayload", {
        issues: validationResult.error.issues,
      });
    }

    // Make request
    await this.makeRequest("/v1/feedback/instances", "POST", payload);
  }

  /**
   * Make HTTP request with retry and circuit breaker logic
   */
  private async makeRequest<T>(
    path: string,
    method: string,
    body?: unknown
  ): Promise<T> {
    // Check circuit breaker
    this.checkCircuitBreaker();

    let lastError: Error | null = null;
    const maxAttempts = this.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.fetchWithTimeout(path, method, body);

        // Success - reset circuit breaker
        this.onSuccess();

        return response as T;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === maxAttempts;

        if (!isRetryable || isLastAttempt) {
          // Non-retryable error or last attempt - record failure and throw
          this.onFailure();
          throw this.normalizeError(error);
        }

        // Retryable error - wait before retry
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        await this.sleep(delay);
      }
    }

    // Should never reach here, but just in case
    this.onFailure();
    throw this.normalizeError(lastError);
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    path: string,
    method: string,
    body?: unknown
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check HTTP status
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new ServiceError(`HTTP ${response.status}: ${errorText}`, {
          statusCode: response.status,
        });
      }

      // Parse JSON response
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if ((error as Error).name === "AbortError") {
        throw new TimeoutError(`Request timed out after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Check if circuit breaker allows requests
   */
  private checkCircuitBreaker(): void {
    if (this.circuitState === "open") {
      const now = Date.now();
      const timeSinceOpened = now - (this.circuitOpenedAt ?? now);

      if (timeSinceOpened >= this.circuitBreakerResetTimeout) {
        // Try half-open state
        this.circuitState = "half-open";
      } else {
        throw new CircuitOpenError();
      }
    }
  }

  /**
   * Record successful request
   */
  private onSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.circuitState === "half-open") {
      this.circuitState = "closed";
    }
  }

  /**
   * Record failed request
   */
  private onFailure(): void {
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      this.circuitState = "open";
      this.circuitOpenedAt = Date.now();
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof TimeoutError) {
      return true;
    }
    if (error instanceof NetworkError) {
      return error.retryable;
    }
    if (error instanceof ServiceError) {
      // Retry 5xx errors, not 4xx
      return (error.statusCode ?? 0) >= 500;
    }
    // Network errors from fetch
    if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("network"))) {
      return true;
    }
    return false;
  }

  /**
   * Normalize error to HAP error types
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      // Already a HAP error
      if (
        error instanceof NetworkError ||
        error instanceof ValidationError ||
        error instanceof ServiceError
      ) {
        // Redact API key from error message
        error.message = this.redactApiKey(error.message);
        return error;
      }

      // Timeout
      if (error.name === "AbortError") {
        return new TimeoutError(this.redactApiKey(error.message));
      }

      // Network error
      if (error instanceof TypeError) {
        return new NetworkError(this.redactApiKey(error.message), {
          cause: error,
        });
      }
    }

    // Unknown error
    return new NetworkError("Unknown error occurred", { cause: error });
  }

  /**
   * Redact API key from string (security requirement)
   */
  private redactApiKey(str: string): string {
    if (!this.apiKey) return str;
    return str.replace(new RegExp(this.apiKey, "g"), "[REDACTED]");
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker state (for testing)
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Get consecutive failure count (for testing)
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Reset circuit breaker (for testing)
   */
  resetCircuitBreaker(): void {
    this.circuitState = "closed";
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = null;
  }
}
