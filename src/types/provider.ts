/**
 * Provider interfaces for HAP blueprint and feedback operations.
 *
 * This module defines the core provider abstraction that enables both
 * production (HapClient with certified endpoints) and development
 * (LocalHapProvider with file-based blueprints) scenarios.
 *
 * @packageDocumentation
 */

import type { InquiryBlueprint, InquiryRequest, FeedbackPayload } from "./index";

/**
 * Provider interface for HAP blueprint and feedback operations.
 *
 * Any implementation must provide:
 * - Blueprint retrieval based on inquiry request
 * - Feedback submission for optimization
 *
 * **Implementations:**
 * - `HapClient`: Production provider using certified HAP service endpoints
 * - `LocalHapProvider`: Development provider using local/remote blueprint files
 *
 * @example
 * ```typescript
 * // Production usage with HapClient
 * const provider: HapProvider = new HapClient({
 *   serviceUrl: "https://api.hap.example.com",
 *   apiKey: process.env.HAP_API_KEY
 * });
 *
 * // Development usage with LocalHapProvider
 * const provider: HapProvider = new LocalHapProvider({
 *   blueprintSource: "./dev-blueprints",
 *   selector: (candidates, request, metrics) => candidates[0]
 * });
 *
 * // Use with StopGuard
 * const guard = new StopGuard({
 *   provider,
 *   questionEngine
 * });
 * ```
 */
export interface HapProvider {
  /**
   * Request an inquiry blueprint from the provider.
   *
   * The provider uses the structural metadata in the request to select
   * and return an appropriate blueprint for question generation.
   *
   * @param request - Structural inquiry request (no semantic content)
   * @returns Blueprint for generating question
   *
   * @throws {ValidationError} If request is invalid
   * @throws {NetworkError} If provider is unavailable (production only)
   *
   * @example
   * ```typescript
   * const request: InquiryRequest = {
   *   ladderStage: "meaning",
   *   agencyMode: "convergent",
   *   stopTrigger: true,
   *   stopPattern: "ambiguous-pronoun"
   * };
   *
   * const blueprint = await provider.requestInquiryBlueprint(request);
   * ```
   */
  requestInquiryBlueprint(request: InquiryRequest): Promise<InquiryBlueprint>;

  /**
   * Send structural feedback after inquiry resolution.
   *
   * The provider uses this feedback to optimize blueprint selection
   * and improve question quality over time.
   *
   * @param payload - Structural feedback (no semantic content)
   *
   * @throws {ValidationError} If payload is invalid
   * @throws {NetworkError} If provider is unavailable (production only)
   *
   * @example
   * ```typescript
   * const feedback: FeedbackPayload = {
   *   blueprintId: "meaning-convergent-ambiguous-v1",
   *   patternId: "ambiguous-pronoun-001",
   *   agencyMode: "convergent",
   *   stopResolved: true,
   *   turnsDelta: -2
   * };
   *
   * await provider.sendFeedback(feedback);
   * ```
   */
  sendFeedback(payload: FeedbackPayload): Promise<void>;
}

// ============================================================================
// LocalHapProvider Types (v0.2)
// ============================================================================

/**
 * Performance metrics for a blueprint.
 *
 * Used by LocalHapProvider to track blueprint effectiveness
 * and enable data-driven selection strategies.
 */
export interface BlueprintMetrics {
  /** Total number of times this blueprint was used */
  totalUses: number;

  /** Fraction of uses where stop was successfully resolved (0-1) */
  resolutionRate: number;

  /** Average number of turns to resolution */
  averageTurns: number;

  /** Optional: Average time to resolution in milliseconds */
  averageTimeMs?: number;

  /** Optional: Whether phase advanced after resolution */
  phaseAdvanceRate?: number;
}

/**
 * Blueprint selector function type.
 *
 * Integrators provide this function to LocalHapProvider to implement
 * their own blueprint selection logic. The SDK provides infrastructure
 * (loading, caching, metrics) but NO opinions on how to select.
 *
 * @param candidates - Array of matching blueprints (filtered by stage/mode/pattern)
 * @param request - The inquiry request with optional metadata
 * @param metrics - Performance metrics for all known blueprints
 * @returns The selected blueprint to use
 *
 * @example Simple selector (always pick latest version)
 * ```typescript
 * const selector: BlueprintSelector = (candidates) => {
 *   // Candidates are already sorted by version (desc)
 *   return candidates[0];
 * };
 * ```
 *
 * @example Performance-based selector
 * ```typescript
 * const selector: BlueprintSelector = (candidates, request, metrics) => {
 *   // Find candidate with best resolution rate
 *   let best = candidates[0];
 *   let bestRate = 0;
 *
 *   for (const candidate of candidates) {
 *     const metric = metrics.get(candidate.id);
 *     if (metric && metric.resolutionRate > bestRate) {
 *       best = candidate;
 *       bestRate = metric.resolutionRate;
 *     }
 *   }
 *
 *   return best;
 * };
 * ```
 *
 * @example Context-aware selector
 * ```typescript
 * const selector: BlueprintSelector = (candidates, request, metrics) => {
 *   // Prefer different strategies based on complexity
 *   if (request.complexitySignal && request.complexitySignal > 3) {
 *     // High complexity: use most proven blueprint
 *     return candidates.find(c => {
 *       const m = metrics.get(c.id);
 *       return m && m.totalUses > 10;
 *     }) || candidates[0];
 *   }
 *
 *   // Low complexity: try latest version
 *   return candidates[0];
 * };
 * ```
 */
export type BlueprintSelector = (
  candidates: InquiryBlueprint[],
  request: InquiryRequest,
  metrics: ReadonlyMap<string, BlueprintMetrics>
) => InquiryBlueprint;
