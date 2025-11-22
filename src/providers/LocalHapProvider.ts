/**
 * LocalHapProvider - File-based blueprint provider for local development.
 *
 * This provider enables local development and testing without requiring
 * a HAP service connection. It loads blueprints from local files or URLs
 * and uses an integrator-provided selector function for blueprint selection.
 *
 * **Philosophy:**
 * - The SDK provides infrastructure (loading, caching, metrics)
 * - The SDK has NO opinions on selection or optimization
 * - Integrators provide their own selection logic via BlueprintSelector
 *
 * @packageDocumentation
 */

import type {
  HapProvider,
  InquiryBlueprint,
  InquiryRequest,
  FeedbackPayload,
  BlueprintSelector,
  BlueprintMetrics,
} from "../types/index";
import type { QuestionOutcomeLogger } from "../metrics/QuestionOutcomeLogger";
import { loadBlueprints } from "./blueprintLoader";

/**
 * Configuration for LocalHapProvider.
 *
 * @example
 * ```typescript
 * const config: LocalHapProviderConfig = {
 *   blueprintSource: "./blueprints",
 *   selector: (candidates) => candidates[0], // Always pick first
 *   metricsLogger: new QuestionOutcomeLogger()
 * };
 * ```
 */
export interface LocalHapProviderConfig {
  /**
   * Source location for blueprints.
   *
   * Can be:
   * - Local directory path: `"./blueprints"` or `"/absolute/path/to/blueprints"`
   * - Remote URL: `"https://example.com/blueprints"`
   *
   * Blueprints must follow naming convention:
   * `{stage}-{mode}-{pattern}-v{version}.json`
   *
   * Example: `meaning-convergent-ambiguous-v1.json`
   */
  blueprintSource: string;

  /**
   * Blueprint selector function (required).
   *
   * The integrator must provide this function to implement their
   * own selection logic. The SDK provides infrastructure only.
   *
   * @example
   * ```typescript
   * // Simple: always pick latest version
   * selector: (candidates) => candidates[0]
   *
   * // Performance-based: pick best resolution rate
   * selector: (candidates, request, metrics) => {
   *   let best = candidates[0];
   *   let bestRate = 0;
   *   for (const c of candidates) {
   *     const m = metrics.get(c.id);
   *     if (m && m.resolutionRate > bestRate) {
   *       best = c;
   *       bestRate = m.resolutionRate;
   *     }
   *   }
   *   return best;
   * }
   * ```
   */
  selector: BlueprintSelector;

  /**
   * Optional metrics logger for tracking blueprint performance.
   *
   * If provided, metrics will be made available to the selector function
   * to enable data-driven selection strategies.
   */
  metricsLogger?: QuestionOutcomeLogger;

  /**
   * Optional cache directory for remote blueprints.
   *
   * When loading from a URL, downloaded blueprints will be cached
   * to this directory to reduce network requests.
   *
   * Default: No caching (always fetch from remote)
   */
  cacheDir?: string;
}

/**
 * LocalHapProvider - File-based blueprint provider for local development.
 *
 * Implements the HapProvider interface using local or remote blueprint files.
 * Integrators must provide a selector function for blueprint selection.
 *
 * @example Basic usage
 * ```typescript
 * const provider = new LocalHapProvider({
 *   blueprintSource: "./blueprints",
 *   selector: (candidates) => candidates[0]
 * });
 *
 * const guard = new StopGuard({
 *   provider,
 *   questionEngine
 * });
 * ```
 *
 * @example With metrics-based selection
 * ```typescript
 * const metrics = new QuestionOutcomeLogger();
 *
 * const provider = new LocalHapProvider({
 *   blueprintSource: "https://example.com/blueprints",
 *   selector: (candidates, request, metricsMap) => {
 *     // Your selection logic using metrics
 *     return candidates.find(c => {
 *       const m = metricsMap.get(c.id);
 *       return m && m.resolutionRate > 0.8;
 *     }) || candidates[0];
 *   },
 *   metricsLogger: metrics,
 *   cacheDir: "./.hap-cache"
 * });
 * ```
 */
export class LocalHapProvider implements HapProvider {
  private readonly config: LocalHapProviderConfig;
  private readonly blueprintCache: Map<string, InquiryBlueprint>;
  private readonly metricsCache: Map<string, BlueprintMetrics>;

  /**
   * Creates a new LocalHapProvider instance.
   *
   * @param config - Provider configuration
   * @throws {Error} If config is invalid (missing required fields)
   */
  constructor(config: LocalHapProviderConfig) {
    this.validateConfig(config);
    this.config = config;
    this.blueprintCache = new Map();
    this.metricsCache = new Map();
  }

  /**
   * Validates provider configuration.
   *
   * @private
   */
  private validateConfig(config: LocalHapProviderConfig): void {
    if (!config.blueprintSource || typeof config.blueprintSource !== "string") {
      throw new Error(
        "LocalHapProvider: blueprintSource is required and must be a string"
      );
    }

    if (!config.selector || typeof config.selector !== "function") {
      throw new Error(
        "LocalHapProvider: selector is required and must be a function"
      );
    }
  }

  /**
   * Request an inquiry blueprint from the local provider.
   *
   * The provider will:
   * 1. Load blueprints from the configured source (if not cached)
   * 2. Filter candidates by stage/mode/pattern from the request
   * 3. Call the integrator's selector function with candidates and metrics
   * 4. Return the selected blueprint
   *
   * @param request - Structural inquiry request
   * @returns Selected blueprint
   * @throws {Error} If no matching blueprints found
   * @throws {Error} If blueprint loading fails
   */
  async requestInquiryBlueprint(
    request: InquiryRequest
  ): Promise<InquiryBlueprint> {
    // 1. Ensure blueprints are loaded
    await this.ensureBlueprintsLoaded();

    // 2. Filter candidates based on request
    const candidates = this.filterCandidates(request);

    if (candidates.length === 0) {
      throw new Error(
        `No matching blueprints found for stage="${request.ladderStage}", mode="${request.agencyMode}"` +
          (request.stopPattern ? `, pattern="${request.stopPattern}"` : "")
      );
    }

    // 3. Get current metrics for selector
    const metricsMap = this.buildMetricsMap();

    // 4. Call integrator's selector function
    const selected = this.config.selector(candidates, request, metricsMap);

    if (!selected) {
      throw new Error(
        "Selector function returned null/undefined. Must return a blueprint."
      );
    }

    // Verify selected blueprint is from candidates
    if (!candidates.includes(selected)) {
      throw new Error(
        "Selector function must return one of the provided candidates"
      );
    }

    return selected;
  }

  /**
   * Ensure blueprints are loaded from source into cache.
   *
   * @private
   */
  private async ensureBlueprintsLoaded(): Promise<void> {
    // If cache is already populated, skip loading
    if (this.blueprintCache.size > 0) {
      return;
    }

    // Load from source
    const blueprints = await loadBlueprints(this.config.blueprintSource);

    // Populate cache
    for (const blueprint of blueprints) {
      this.blueprintCache.set(blueprint.id, blueprint);
    }
  }

  /**
   * Filter blueprints by stage, mode, and optional pattern.
   *
   * Matches based on blueprint fields and returns candidates sorted
   * by version (highest first for same stage/mode/pattern).
   *
   * @private
   */
  private filterCandidates(request: InquiryRequest): InquiryBlueprint[] {
    const allBlueprints = Array.from(this.blueprintCache.values());

    // Filter by required fields
    let candidates = allBlueprints.filter(
      (bp) =>
        bp.ladderStage === request.ladderStage &&
        bp.agencyMode === request.agencyMode
    );

    // If stopPattern is specified, filter by it
    if (request.stopPattern) {
      candidates = candidates.filter(
        (bp) => bp.stopCondition === request.stopPattern
      );
    }

    // Sort by version (descending) - extract version from blueprint ID
    // Expected format: {stage}-{mode}-{pattern}-v{version}
    candidates.sort((a, b) => {
      const versionA = this.extractVersion(a.id);
      const versionB = this.extractVersion(b.id);
      return versionB - versionA; // Descending
    });

    return candidates;
  }

  /**
   * Extract version number from blueprint ID.
   *
   * Expected format: {stage}-{mode}-{pattern}-v{version}
   * Example: "meaning-convergent-ambiguous-v2" -> 2
   *
   * @private
   */
  private extractVersion(blueprintId: string): number {
    const match = blueprintId.match(/v(\d+)$/);
    return match && match[1] ? parseInt(match[1], 10) : 0;
  }

  /**
   * Determine if phase advanced based on previous and current phase.
   *
   * @private
   */
  private didPhaseAdvance(
    previousPhase: string | undefined,
    currentPhase: string | undefined
  ): boolean {
    if (!previousPhase || !currentPhase) {
      return false;
    }
    return previousPhase !== currentPhase;
  }

  /**
   * Build metrics map from the metrics logger.
   *
   * @private
   */
  private buildMetricsMap(): ReadonlyMap<string, BlueprintMetrics> {
    // If no metrics logger, return empty map
    if (!this.config.metricsLogger) {
      return new Map();
    }

    // Copy current metrics from cache
    return new Map(this.metricsCache);
  }

  /**
   * Send structural feedback to update local metrics.
   *
   * The provider will:
   * 1. Update metrics for the specified blueprint
   * 2. Make updated metrics available to future selector calls
   *
   * Note: Unlike HapClient, this does NOT send feedback to a remote service.
   * Feedback is used only for local metrics tracking.
   *
   * @param payload - Structural feedback
   */
  async sendFeedback(payload: FeedbackPayload): Promise<void> {
    if (!payload.blueprintId) {
      throw new Error("LocalHapProvider.sendFeedback: blueprintId is required");
    }

    // If no metrics logger configured, just return (no-op)
    if (!this.config.metricsLogger) {
      return;
    }

    // Update metrics cache based on feedback
    this.updateMetricsFromFeedback(payload);
  }

  /**
   * Update metrics cache from feedback payload.
   *
   * @private
   */
  private updateMetricsFromFeedback(payload: FeedbackPayload): void {
    const blueprintId = payload.blueprintId;

    // Get existing metrics or create new ones
    const existing = this.metricsCache.get(blueprintId) || {
      totalUses: 0,
      resolutionRate: 0,
      averageTurns: 0,
    };

    // Increment total uses
    const newTotalUses = existing.totalUses + 1;

    // Update resolution rate
    const resolvedCount = existing.resolutionRate * existing.totalUses;
    const newResolvedCount = payload.stopResolved
      ? resolvedCount + 1
      : resolvedCount;
    const newResolutionRate = newResolvedCount / newTotalUses;

    // Update average turns (only count resolved cases)
    let newAverageTurns = existing.averageTurns;
    if (payload.stopResolved && payload.turnsDelta !== undefined) {
      const totalTurns = existing.averageTurns * resolvedCount;
      const newTotalTurns = totalTurns + Math.abs(payload.turnsDelta);
      newAverageTurns = newResolvedCount > 0 ? newTotalTurns / newResolvedCount : 0;
    }

    // Update phase advance rate if both phases are provided
    let newPhaseAdvanceRate = existing.phaseAdvanceRate;
    if (payload.previousPhase && payload.currentPhase) {
      const phaseAdvanced = this.didPhaseAdvance(
        payload.previousPhase,
        payload.currentPhase
      );
      const phaseAdvanceCount = (existing.phaseAdvanceRate || 0) * existing.totalUses;
      const newPhaseAdvanceCount = phaseAdvanced
        ? phaseAdvanceCount + 1
        : phaseAdvanceCount;
      newPhaseAdvanceRate = newPhaseAdvanceCount / newTotalUses;
    }

    // Store updated metrics
    this.metricsCache.set(blueprintId, {
      totalUses: newTotalUses,
      resolutionRate: newResolutionRate,
      averageTurns: newAverageTurns,
      phaseAdvanceRate: newPhaseAdvanceRate,
    });
  }

  /**
   * Get current metrics for a blueprint (for testing/debugging).
   *
   * @internal
   */
  getMetrics(blueprintId: string): BlueprintMetrics | undefined {
    return this.metricsCache.get(blueprintId);
  }

  /**
   * Get all cached blueprints (for testing/debugging).
   *
   * @internal
   */
  getCachedBlueprints(): ReadonlyMap<string, InquiryBlueprint> {
    return this.blueprintCache;
  }

  /**
   * Get the provider configuration (for testing/debugging).
   *
   * @internal
   */
  getConfig(): Readonly<LocalHapProviderConfig> {
    return this.config;
  }
}
