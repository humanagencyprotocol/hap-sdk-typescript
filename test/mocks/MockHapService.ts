/**
 * Mock HAP Service Provider for testing.
 *
 * Provides a test double for the HAP Service that can:
 * - Return registered blueprints
 * - Record received feedback
 * - Simulate network errors, timeouts, validation errors
 * - Track request counts
 *
 * @packageDocumentation
 */

import type { InquiryBlueprint, FeedbackPayload, InquiryRequest } from "../../src/types";

export type FailureMode = "none" | "timeout" | "network" | "validation" | "server";

/**
 * Mock HAP Service for testing.
 *
 * Simulates the behavior of a real HAP Service Provider without
 * making actual network calls.
 */
export class MockHapService {
  private blueprints = new Map<string, InquiryBlueprint>();
  private feedbackLog: FeedbackPayload[] = [];
  private requestCounts = new Map<string, number>();
  private responseDelay = 0;
  private failureMode: FailureMode = "none";
  private failureCount = 0;
  private consecutiveFailures = 0;

  // ========================================================================
  // Setup Methods
  // ========================================================================

  /**
   * Register a blueprint that can be returned by requests.
   */
  registerBlueprint(id: string, blueprint: InquiryBlueprint): void {
    this.blueprints.set(id, blueprint);
  }

  /**
   * Set response delay in milliseconds.
   */
  setResponseDelay(ms: number): void {
    this.responseDelay = ms;
  }

  /**
   * Simulate a network error.
   */
  simulateNetworkError(): void {
    this.failureMode = "network";
  }

  /**
   * Simulate a timeout.
   */
  simulateTimeout(): void {
    this.failureMode = "timeout";
  }

  /**
   * Simulate a validation error (400).
   */
  simulateValidationError(): void {
    this.failureMode = "validation";
  }

  /**
   * Simulate a server error (500).
   */
  simulateServerError(): void {
    this.failureMode = "server";
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.blueprints.clear();
    this.feedbackLog = [];
    this.requestCounts.clear();
    this.responseDelay = 0;
    this.failureMode = "none";
    this.failureCount = 0;
    this.consecutiveFailures = 0;
  }

  // ========================================================================
  // Verification Methods
  // ========================================================================

  /**
   * Get all feedback that was received.
   */
  getReceivedFeedback(): FeedbackPayload[] {
    return [...this.feedbackLog];
  }

  /**
   * Get count of blueprint requests for a specific ID.
   */
  getBlueprintRequestCount(id: string): number {
    return this.requestCounts.get(id) ?? 0;
  }

  /**
   * Get count of all blueprint requests.
   */
  getTotalRequestCount(): number {
    return Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Get count of consecutive failures (for circuit breaker testing).
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  // ========================================================================
  // HTTP Handlers
  // ========================================================================

  /**
   * Handle an inquiry blueprint request.
   *
   * @throws Error if failure mode is active
   */
  async handleInquiryRequest(req: InquiryRequest): Promise<InquiryBlueprint> {
    // Apply delay if configured
    if (this.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
    }

    // Check for failure mode
    if (this.failureMode !== "none") {
      this.failureCount++;
      this.consecutiveFailures++;
      this.throwFailure();
    }

    // Success - reset consecutive failures
    this.consecutiveFailures = 0;

    // Find matching blueprint
    const blueprint = this.findMatchingBlueprint(req);

    if (!blueprint) {
      throw new Error(
        `No blueprint registered for stage=${req.ladderStage} mode=${req.agencyMode}`
      );
    }

    // Track request
    const count = this.requestCounts.get(blueprint.id) ?? 0;
    this.requestCounts.set(blueprint.id, count + 1);

    return blueprint;
  }

  /**
   * Handle a feedback submission.
   */
  async handleFeedback(payload: FeedbackPayload): Promise<void> {
    // Apply delay if configured
    if (this.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
    }

    // Check for failure mode
    if (this.failureMode !== "none") {
      this.failureCount++;
      this.consecutiveFailures++;
      this.throwFailure();
    }

    // Success - reset consecutive failures
    this.consecutiveFailures = 0;

    // Store feedback
    this.feedbackLog.push(payload);
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private findMatchingBlueprint(req: InquiryRequest): InquiryBlueprint | undefined {
    for (const blueprint of this.blueprints.values()) {
      if (
        blueprint.ladderStage === req.ladderStage &&
        blueprint.agencyMode === req.agencyMode
      ) {
        return blueprint;
      }
    }
    return undefined;
  }

  private throwFailure(): never {
    switch (this.failureMode) {
      case "timeout":
        throw new Error("TIMEOUT");

      case "network":
        throw new Error("NETWORK_ERROR");

      case "validation":
        throw new Error("VALIDATION_ERROR: Invalid request format");

      case "server":
        throw new Error("SERVER_ERROR: Internal server error");

      default:
        throw new Error("Unknown failure mode");
    }
  }
}

/**
 * Create a mock service with common blueprints pre-registered.
 */
export function createMockServiceWithFixtures(): MockHapService {
  const service = new MockHapService();

  // Register convergent meaning blueprint
  service.registerBlueprint("convergent-meaning-01", {
    id: "convergent-meaning-01",
    intent: "reduce semantic drift",
    ladderStage: "meaning",
    agencyMode: "convergent",
    targetStructures: ["object_of_discussion", "in_out_boundary"],
    constraints: {
      tone: "facilitative",
      addressing: "individual",
    },
    renderHint: "ask for the thing, not for opinions about the thing",
    examples: ["Are we talking about the same issue?"],
    stopCondition: "meaning",
  });

  // Register reflective meaning blueprint
  service.registerBlueprint("reflective-meaning-01", {
    id: "reflective-meaning-01",
    intent: "deepen understanding",
    ladderStage: "meaning",
    agencyMode: "reflective",
    targetStructures: ["object_of_discussion", "nuance"],
    constraints: {
      tone: "probing",
      addressing: "individual",
    },
    renderHint: "explore the meaning more deeply",
    examples: ["What does this really mean to you?"],
    stopCondition: "meaning",
  });

  return service;
}
