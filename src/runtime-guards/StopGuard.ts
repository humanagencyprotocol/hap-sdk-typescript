/**
 * StopGuard - Enforces Stop→Ask→Proceed protocol
 *
 * Core enforcement mechanism that:
 * 1. Detects when AI should stop and ask for clarification
 * 2. Requests blueprint from HAP Service (NEVER sends user context)
 * 3. Generates question using local Question Engine
 * 4. Returns question to integrator
 *
 * The context parameter contains semantic user data and NEVER leaves
 * the local system. Only structural metadata is sent to HAP Service.
 *
 * @packageDocumentation
 */

import type {
  InquiryRequest,
  InquiryBlueprint,
  QuestionEngine,
  QuestionSpec,
  HapProvider,
} from "../types";
import {
  QuestionSpecFactory,
  defaultQuestionSpecFactory,
} from "../question-spec/QuestionSpecFactory";

/**
 * Result of clarification check
 */
export interface ClarificationResult {
  /** Whether clarification is complete (stop not triggered or already resolved) */
  clarified: boolean;

  /** Question to ask user (only present if clarified=false) */
  question?: string;

  /** Blueprint ID used (for feedback correlation) */
  blueprintId?: string;
}

/**
 * Middleware for observing StopGuard invocations
 *
 * Useful for logging, metrics, and debugging.
 * Middleware receives ONLY structural data - no semantic content.
 */
export interface StopGuardMiddleware {
  /** Called when stop condition is detected */
  onStopDetected?(request: InquiryRequest): void;

  /** Called when blueprint is received from service */
  onBlueprintReceived?(blueprint: InquiryBlueprint): void;

  /** Called when question is generated */
  onQuestionGenerated?(questionId: string, spec: QuestionSpec): void;

  /** Called when clarification is skipped (no stop) */
  onClarificationSkipped?(): void;
}

/**
 * Configuration for StopGuard
 */
export interface StopGuardConfig {
  /** HAP Provider (production: HapClient, development: LocalHapProvider) */
  provider: HapProvider;

  /** Local question engine (provided by integrator) */
  questionEngine: QuestionEngine;

  /** Optional custom QuestionSpecFactory */
  questionSpecFactory?: QuestionSpecFactory;

  /** Optional middleware for logging/metrics */
  middleware?: StopGuardMiddleware[];
}

/**
 * StopGuard - Enforces Stop→Ask→Proceed
 *
 * This is the primary enforcement point in the SDK. When a stop condition
 * is detected, StopGuard:
 * 1. Requests an InquiryBlueprint from HAP Service (structural metadata only)
 * 2. Converts blueprint to QuestionSpec
 * 3. Uses local QuestionEngine to generate question (context used locally)
 * 4. Returns question to integrator
 *
 * The context parameter NEVER leaves the local system - only structural
 * metadata from the InquiryRequest is sent to HAP Service.
 */
export class StopGuard {
  private readonly provider: HapProvider;
  private readonly questionEngine: QuestionEngine;
  private readonly questionSpecFactory: QuestionSpecFactory;
  private readonly middleware: StopGuardMiddleware[];

  constructor(config: StopGuardConfig) {
    this.provider = config.provider;
    this.questionEngine = config.questionEngine;
    this.questionSpecFactory =
      config.questionSpecFactory ?? defaultQuestionSpecFactory;
    this.middleware = config.middleware ?? [];
  }

  /**
   * Ensure context is clarified before proceeding.
   *
   * If stopTrigger is false, returns { clarified: true } immediately.
   * If stopTrigger is true:
   * 1. Requests blueprint from HAP (structural metadata only)
   * 2. Generates question using local Question Engine
   * 3. Returns { clarified: false, question: "..." }
   *
   * @param context - Local context (NEVER sent to HAP)
   * @param request - Structural inquiry request (metadata only)
   * @returns Clarification result with optional question
   *
   * @throws NetworkError if blueprint request fails
   * @throws ValidationError if blueprint is invalid
   * @throws Error if Question Engine fails
   */
  async ensureClarified(
    context: unknown,
    request: InquiryRequest
  ): Promise<ClarificationResult> {
    // If no stop triggered, clarification not needed
    if (!request.stopTrigger) {
      this.invokeMiddleware((m) => m.onClarificationSkipped?.());
      return { clarified: true };
    }

    // Stop detected - invoke middleware
    this.invokeMiddleware((m) => m.onStopDetected?.(request));

    // Request blueprint from HAP Provider
    // CRITICAL: Only request (structural metadata) is sent, NOT context
    const blueprint = await this.provider.requestInquiryBlueprint(request);

    // Invoke middleware
    this.invokeMiddleware((m) => m.onBlueprintReceived?.(blueprint));

    // Convert blueprint to QuestionSpec
    const spec = this.questionSpecFactory.fromBlueprint(blueprint);

    // Generate question using local Question Engine
    // Context is used HERE (locally) but never sent to HAP
    const question = await this.questionEngine.generateQuestion(context, spec);

    // Invoke middleware (with structural data only)
    this.invokeMiddleware((m) => m.onQuestionGenerated?.(blueprint.id, spec));

    return {
      clarified: false,
      question,
      blueprintId: blueprint.id,
    };
  }

  /**
   * Add middleware dynamically
   */
  addMiddleware(middleware: StopGuardMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(middleware: StopGuardMiddleware): void {
    const index = this.middleware.indexOf(middleware);
    if (index !== -1) {
      this.middleware.splice(index, 1);
    }
  }

  /**
   * Invoke all middleware callbacks
   */
  private invokeMiddleware(
    callback: (middleware: StopGuardMiddleware) => void
  ): void {
    for (const middleware of this.middleware) {
      try {
        callback(middleware);
      } catch (error) {
        // Middleware errors should not break the flow
        // Log error but continue (integrator's responsibility to handle)
        console.error("StopGuard middleware error:", error);
      }
    }
  }
}
