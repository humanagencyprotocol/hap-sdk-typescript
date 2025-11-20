/**
 * Error taxonomy for the HAP SDK.
 *
 * These errors provide clear categorization for different failure modes
 * while ensuring no sensitive information (like API keys) leaks into error messages.
 *
 * @packageDocumentation
 */

// ============================================================================
// Base HAP Error
// ============================================================================

/**
 * Base class for all HAP SDK errors.
 */
export class HapError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// ============================================================================
// Network Errors
// ============================================================================

/**
 * Network-related errors (timeouts, connection failures, etc.).
 *
 * These errors are typically retryable.
 */
export class NetworkError extends HapError {
  /** Whether this error should trigger a retry */
  public readonly retryable: boolean;

  /** HTTP status code if available */
  public readonly statusCode?: number;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      retryable?: boolean;
      statusCode?: number;
    }
  ) {
    super(message, options?.cause);
    this.retryable = options?.retryable ?? true;
    this.statusCode = options?.statusCode;
  }
}

/**
 * Request timeout error.
 */
export class TimeoutError extends NetworkError {
  constructor(message: string = "Request timed out", cause?: unknown) {
    super(message, { cause, retryable: true });
  }
}

/**
 * Circuit breaker is open, preventing requests.
 */
export class CircuitOpenError extends NetworkError {
  constructor(
    message: string = "Circuit breaker is open - too many recent failures",
    cause?: unknown
  ) {
    super(message, { cause, retryable: false });
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Schema validation error.
 *
 * Thrown when data doesn't match expected Zod schema.
 * Includes the field path to help with debugging.
 */
export class ValidationError extends HapError {
  /** Path to the invalid field (e.g., "constraints.tone") */
  public readonly fieldPath?: string;

  /** The validation issues from Zod */
  public readonly issues?: unknown;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      fieldPath?: string;
      issues?: unknown;
    }
  ) {
    super(message, options?.cause);
    this.fieldPath = options?.fieldPath;
    this.issues = options?.issues;
  }
}

/**
 * Semantic content detected in structural payload.
 *
 * This is a critical error indicating someone is trying to leak
 * user content through the protocol.
 */
export class SemanticContentError extends ValidationError {
  constructor(
    message: string = "Semantic content detected in structural payload",
    options?: { cause?: unknown; fieldPath?: string }
  ) {
    super(message, options);
  }
}

// ============================================================================
// Protocol Errors
// ============================================================================

/**
 * Protocol-level errors from the HAP Service.
 *
 * These indicate issues with the protocol interaction itself,
 * not network problems.
 */
export class ProtocolError extends HapError {
  /** Protocol version this error relates to */
  public readonly protocolVersion?: string;

  /** HTTP status code from service */
  public readonly statusCode?: number;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      protocolVersion?: string;
      statusCode?: number;
    }
  ) {
    super(message, options?.cause);
    this.protocolVersion = options?.protocolVersion;
    this.statusCode = options?.statusCode;
  }
}

/**
 * Service returned an unexpected response format.
 */
export class InvalidResponseError extends ProtocolError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
  }
}

/**
 * Service returned an error response.
 */
export class ServiceError extends ProtocolError {
  constructor(
    message: string,
    options?: {
      cause?: unknown;
      statusCode?: number;
    }
  ) {
    super(message, options);
  }
}

// ============================================================================
// Stop Errors
// ============================================================================

/**
 * Stop condition enforcement errors.
 *
 * These indicate the protocol is preventing an action due to
 * unresolved meaning or direction.
 */
export class StopError extends HapError {
  /** Which stop condition was triggered */
  public readonly stopCondition: "meaning" | "direction" | "both";

  /** Which ladder stage we're at */
  public readonly ladderStage: string;

  constructor(
    message: string,
    options: {
      stopCondition: "meaning" | "direction" | "both";
      ladderStage: string;
      cause?: unknown;
    }
  ) {
    super(message, options.cause);
    this.stopCondition = options.stopCondition;
    this.ladderStage = options.ladderStage;
  }
}

/**
 * Attempted to proceed without resolving stop condition.
 */
export class UnresolvedStopError extends StopError {
  constructor(
    options: {
      stopCondition: "meaning" | "direction" | "both";
      ladderStage: string;
    }
  ) {
    super(
      `Cannot proceed: ${options.stopCondition} not resolved at ${options.ladderStage} stage`,
      options
    );
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

/**
 * SDK configuration error.
 */
export class ConfigurationError extends HapError {
  /** Which configuration field is invalid */
  public readonly field?: string;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      field?: string;
    }
  ) {
    super(message, options?.cause);
    this.field = options?.field;
  }
}

/**
 * Missing or invalid API key.
 *
 * IMPORTANT: This error message must NEVER include the actual API key.
 */
export class AuthenticationError extends ConfigurationError {
  constructor(message: string = "Invalid or missing API key", cause?: unknown) {
    super(message, { cause, field: "apiKey" });
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return error.retryable;
  }
  if (error instanceof TimeoutError) {
    return true;
  }
  // Service errors 5xx are retryable, 4xx are not
  if (error instanceof ServiceError && error.statusCode) {
    return error.statusCode >= 500 && error.statusCode < 600;
  }
  return false;
}

/**
 * Check if an error is related to stop condition enforcement.
 */
export function isStopError(error: unknown): error is StopError {
  return error instanceof StopError;
}

/**
 * Check if an error indicates authentication failure.
 */
export function isAuthError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}
