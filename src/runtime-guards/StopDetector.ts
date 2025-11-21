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
