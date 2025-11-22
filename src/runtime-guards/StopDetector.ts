/**
 * StopDetector - Helpers for detecting when AI should stop and ask
 *
 * Provides utilities to determine when a stop condition should be triggered.
 * Integrators can use the default detector or implement custom detection logic.
 *
 * @packageDocumentation
 */

import type { InquiryRequest, LadderStage, AgencyMode } from "../types";
import { ValidationError } from "../types/errors";

/**
 * Context analysis result
 */
export interface StopAnalysis {
  /** Whether a stop should be triggered */
  shouldStop: boolean;

  /** Current ladder stage */
  ladderStage: LadderStage;

  /** Agency mode (convergent or reflective) */
  agencyMode: AgencyMode;

  /** Optional reason for stop (for debugging/logging) */
  reason?: string;
}

/**
 * Stop detection strategy
 *
 * Integrators implement this to define custom stop detection logic.
 */
export interface StopDetectionStrategy {
  /**
   * Analyze context and determine if stop should be triggered
   *
   * @param context - Local context (semantic data, not sent to HAP)
   * @returns Analysis result with stop decision
   */
  analyze(context: unknown): StopAnalysis | Promise<StopAnalysis>;
}

/**
 * Configuration for StopDetector
 */
export interface StopDetectorConfig {
  /** Detection strategy (defaults to manual strategy) */
  strategy?: StopDetectionStrategy;
}

/**
 * StopDetector - Helper for detecting stop conditions
 *
 * Provides utilities to determine when AI should stop and request clarification.
 * Integrators can use default detection or provide custom strategies.
 *
 * @example
 * ```typescript
 * // Manual detection (integrator sets stopTrigger)
 * const detector = new StopDetector();
 * const request = detector.createRequest({
 *   ladderStage: "meaning",
 *   agencyMode: "convergent",
 *   stopTrigger: true
 * });
 *
 * // Custom detection strategy
 * const customDetector = new StopDetector({
 *   strategy: {
 *     analyze: (context: any) => ({
 *       shouldStop: context.ambiguous === true,
 *       ladderStage: "meaning",
 *       agencyMode: "convergent",
 *       reason: "Ambiguous input detected"
 *     })
 *   }
 * });
 * const request = await customDetector.detect(context);
 * ```
 */
export class StopDetector {
  private readonly strategy?: StopDetectionStrategy;

  constructor(config: StopDetectorConfig = {}) {
    this.strategy = config.strategy;
  }

  /**
   * Detect stop condition using configured strategy
   *
   * @param context - Local context to analyze
   * @returns InquiryRequest with stopTrigger set based on analysis
   * @throws ValidationError if analysis result is invalid
   */
  async detect(context: unknown): Promise<InquiryRequest> {
    if (!this.strategy) {
      throw new ValidationError(
        "No detection strategy configured. Use createRequest() for manual detection or provide a strategy."
      );
    }

    const analysis = await this.strategy.analyze(context);
    this.validateAnalysis(analysis);

    return {
      ladderStage: analysis.ladderStage,
      agencyMode: analysis.agencyMode,
      stopTrigger: analysis.shouldStop,
    };
  }

  /**
   * Create InquiryRequest manually (for integrators with custom logic)
   *
   * @param params - Request parameters
   * @returns InquiryRequest
   * @throws ValidationError if parameters are invalid
   */
  createRequest(params: {
    ladderStage: LadderStage;
    agencyMode: AgencyMode;
    stopTrigger: boolean;
  }): InquiryRequest {
    this.validateRequest(params);
    return params;
  }

  /**
   * Create InquiryRequest with optional metadata (v0.2+)
   *
   * Allows apps to provide structural metadata that helps LocalHapProvider
   * select better blueprints. Metadata is privacy-safe - no semantic content.
   *
   * @param params - Request parameters with optional metadata
   * @returns InquiryRequest with validated metadata
   * @throws ValidationError if parameters are invalid
   *
   * @example
   * ```typescript
   * const detector = new StopDetector();
   *
   * // With stop pattern
   * const request = detector.createRequestWithMetadata({
   *   ladderStage: "meaning",
   *   agencyMode: "convergent",
   *   stopTrigger: true,
   *   stopPattern: "ambiguous-pronoun"
   * });
   *
   * // With complexity and domain
   * const request = detector.createRequestWithMetadata({
   *   ladderStage: "purpose",
   *   agencyMode: "convergent",
   *   stopTrigger: true,
   *   complexitySignal: 4,  // High complexity (scale 1-5)
   *   domain: "software-development"
   * });
   *
   * // With session context
   * const request = detector.createRequestWithMetadata({
   *   ladderStage: "meaning",
   *   agencyMode: "convergent",
   *   stopTrigger: true,
   *   sessionContext: {
   *     previousStops: 3,
   *     consecutiveStops: 2,
   *     averageResolutionTurns: 2.5
   *   }
   * });
   * ```
   */
  createRequestWithMetadata(params: {
    ladderStage: LadderStage;
    agencyMode: AgencyMode;
    stopTrigger: boolean;
    stopPattern?: string;
    domain?: string;
    complexitySignal?: number;
    sessionContext?: {
      previousStops: number;
      consecutiveStops: number;
      averageResolutionTurns: number;
    };
  }): InquiryRequest {
    // Validate required fields
    this.validateRequest({
      ladderStage: params.ladderStage,
      agencyMode: params.agencyMode,
      stopTrigger: params.stopTrigger,
    });

    // Validate optional metadata
    if (params.stopPattern !== undefined) {
      this.validateStopPattern(params.stopPattern);
    }

    if (params.domain !== undefined) {
      this.validateDomain(params.domain);
    }

    if (params.complexitySignal !== undefined) {
      this.validateComplexitySignal(params.complexitySignal);
    }

    if (params.sessionContext !== undefined) {
      this.validateSessionContext(params.sessionContext);
    }

    // Build request with metadata
    const request: InquiryRequest = {
      ladderStage: params.ladderStage,
      agencyMode: params.agencyMode,
      stopTrigger: params.stopTrigger,
    };

    if (params.stopPattern) {
      request.stopPattern = params.stopPattern;
    }

    if (params.domain) {
      request.domain = params.domain;
    }

    if (params.complexitySignal !== undefined) {
      request.complexitySignal = params.complexitySignal;
    }

    if (params.sessionContext) {
      request.sessionContext = params.sessionContext;
    }

    return request;
  }

  /**
   * Validate analysis result
   */
  private validateAnalysis(analysis: StopAnalysis): void {
    if (!analysis.ladderStage) {
      throw new ValidationError("Analysis must include ladderStage");
    }

    if (!analysis.agencyMode) {
      throw new ValidationError("Analysis must include agencyMode");
    }

    if (typeof analysis.shouldStop !== "boolean") {
      throw new ValidationError("Analysis must include shouldStop boolean");
    }

    this.validateLadderStage(analysis.ladderStage);
    this.validateAgencyMode(analysis.agencyMode);
  }

  /**
   * Validate request parameters
   */
  private validateRequest(params: {
    ladderStage: LadderStage;
    agencyMode: AgencyMode;
    stopTrigger: boolean;
  }): void {
    if (!params.ladderStage) {
      throw new ValidationError("Request must include ladderStage");
    }

    if (!params.agencyMode) {
      throw new ValidationError("Request must include agencyMode");
    }

    if (typeof params.stopTrigger !== "boolean") {
      throw new ValidationError("Request must include stopTrigger boolean");
    }

    this.validateLadderStage(params.ladderStage);
    this.validateAgencyMode(params.agencyMode);
  }

  /**
   * Validate ladder stage value
   */
  private validateLadderStage(stage: LadderStage): void {
    const validStages: LadderStage[] = [
      "meaning",
      "purpose",
      "intention",
      "action",
    ];

    if (!validStages.includes(stage)) {
      throw new ValidationError(
        `Invalid ladderStage: "${stage}". Must be one of: ${validStages.join(", ")}`
      );
    }
  }

  /**
   * Validate agency mode value
   */
  private validateAgencyMode(mode: AgencyMode): void {
    const validModes: AgencyMode[] = ["convergent", "reflective"];

    if (!validModes.includes(mode)) {
      throw new ValidationError(
        `Invalid agencyMode: "${mode}". Must be one of: ${validModes.join(", ")}`
      );
    }
  }

  /**
   * Validate stop pattern (optional metadata)
   */
  private validateStopPattern(pattern: string): void {
    if (typeof pattern !== "string") {
      throw new ValidationError("stopPattern must be a string");
    }

    if (pattern.trim().length === 0) {
      throw new ValidationError("stopPattern cannot be empty");
    }

    // Pattern should be kebab-case (no spaces, lowercase with hyphens)
    if (!/^[a-z0-9-]+$/.test(pattern)) {
      throw new ValidationError(
        `stopPattern must be kebab-case (lowercase, hyphens only): "${pattern}"`
      );
    }
  }

  /**
   * Validate domain (optional metadata)
   */
  private validateDomain(domain: string): void {
    if (typeof domain !== "string") {
      throw new ValidationError("domain must be a string");
    }

    if (domain.trim().length === 0) {
      throw new ValidationError("domain cannot be empty");
    }

    // Domain should be kebab-case
    if (!/^[a-z0-9-]+$/.test(domain)) {
      throw new ValidationError(
        `domain must be kebab-case (lowercase, hyphens only): "${domain}"`
      );
    }
  }

  /**
   * Validate complexity signal (optional metadata)
   */
  private validateComplexitySignal(signal: number): void {
    if (typeof signal !== "number") {
      throw new ValidationError("complexitySignal must be a number");
    }

    if (!Number.isInteger(signal)) {
      throw new ValidationError("complexitySignal must be an integer");
    }

    if (signal < 1 || signal > 5) {
      throw new ValidationError(
        `complexitySignal must be between 1 and 5, got: ${signal}`
      );
    }
  }

  /**
   * Validate session context (optional metadata)
   */
  private validateSessionContext(context: {
    previousStops: number;
    consecutiveStops: number;
    averageResolutionTurns: number;
  }): void {
    if (typeof context !== "object" || context === null) {
      throw new ValidationError("sessionContext must be an object");
    }

    // Validate previousStops
    if (typeof context.previousStops !== "number") {
      throw new ValidationError("sessionContext.previousStops must be a number");
    }
    if (!Number.isInteger(context.previousStops) || context.previousStops < 0) {
      throw new ValidationError(
        "sessionContext.previousStops must be a non-negative integer"
      );
    }

    // Validate consecutiveStops
    if (typeof context.consecutiveStops !== "number") {
      throw new ValidationError(
        "sessionContext.consecutiveStops must be a number"
      );
    }
    if (
      !Number.isInteger(context.consecutiveStops) ||
      context.consecutiveStops < 0
    ) {
      throw new ValidationError(
        "sessionContext.consecutiveStops must be a non-negative integer"
      );
    }

    // Validate averageResolutionTurns
    if (typeof context.averageResolutionTurns !== "number") {
      throw new ValidationError(
        "sessionContext.averageResolutionTurns must be a number"
      );
    }
    if (context.averageResolutionTurns < 0) {
      throw new ValidationError(
        "sessionContext.averageResolutionTurns must be non-negative"
      );
    }
  }
}

/**
 * Create a stop detector with manual request creation
 *
 * Convenience function for integrators who want to control stop detection.
 */
export function createManualDetector(): StopDetector {
  return new StopDetector();
}

/**
 * Create a stop detector with custom strategy
 *
 * @param strategy - Custom detection strategy
 */
export function createDetectorWithStrategy(
  strategy: StopDetectionStrategy
): StopDetector {
  return new StopDetector({ strategy });
}
