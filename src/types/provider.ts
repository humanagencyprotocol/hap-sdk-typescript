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
