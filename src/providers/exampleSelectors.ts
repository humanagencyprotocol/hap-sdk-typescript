/**
 * Example Blueprint Selector Implementations
 *
 * This file provides reference implementations of BlueprintSelector functions.
 * Integrators can use these as-is or as inspiration for their own custom selectors.
 *
 * Remember: The SDK has NO opinions on selection. These are just examples.
 *
 * @packageDocumentation
 */

import type { BlueprintSelector } from "../types/index";

/**
 * Simple Latest Version Selector
 *
 * Always selects the first candidate (which is the latest version
 * since LocalHapProvider sorts by version descending).
 *
 * **Use when:**
 * - You always want to use the newest blueprint
 * - You're actively developing and testing new blueprints
 * - You don't care about performance metrics
 *
 * @example
 * ```typescript
 * const provider = new LocalHapProvider({
 *   blueprintSource: "./blueprints",
 *   selector: simpleLatestVersionSelector
 * });
 * ```
 */
export const simpleLatestVersionSelector: BlueprintSelector = (candidates) => {
  if (candidates.length === 0) {
    throw new Error("simpleLatestVersionSelector: No candidates provided");
  }
  return candidates[0]!;
};

/**
 * Best Performance Selector
 *
 * Selects the blueprint with the highest resolution rate.
 * Falls back to latest version if no metrics available.
 *
 * **Use when:**
 * - You want to prioritize question effectiveness
 * - You have accumulated metrics from usage
 * - Resolution rate is your primary success metric
 *
 * @example
 * ```typescript
 * const metrics = new QuestionOutcomeLogger();
 * const provider = new LocalHapProvider({
 *   blueprintSource: "./blueprints",
 *   selector: bestPerformanceSelector,
 *   metricsLogger: metrics
 * });
 * ```
 */
export const bestPerformanceSelector: BlueprintSelector = (
  candidates,
  _request,
  metrics
) => {
  if (candidates.length === 0) {
    throw new Error("bestPerformanceSelector: No candidates provided");
  }

  let bestBlueprint = candidates[0]!;
  let bestResolutionRate = -1;

  for (const candidate of candidates) {
    const metric = metrics.get(candidate.id);
    if (metric && metric.resolutionRate > bestResolutionRate) {
      bestBlueprint = candidate;
      bestResolutionRate = metric.resolutionRate;
    }
  }

  return bestBlueprint;
};

/**
 * Balanced Selector
 *
 * Balances performance with sufficient sample size.
 * Only considers blueprints with at least 5 uses, then picks best resolution rate.
 * Falls back to latest version for new blueprints.
 *
 * **Use when:**
 * - You want data-driven selection but need statistical confidence
 * - You're willing to try new blueprints until they have enough data
 * - You want to avoid over-relying on blueprints with few uses
 *
 * @example
 * ```typescript
 * const provider = new LocalHapProvider({
 *   blueprintSource: "./blueprints",
 *   selector: balancedSelector,
 *   metricsLogger: metrics
 * });
 * ```
 */
export const balancedSelector: BlueprintSelector = (
  candidates,
  _request,
  metrics
) => {
  if (candidates.length === 0) {
    throw new Error("balancedSelector: No candidates provided");
  }

  const MIN_USES = 5;

  // Filter candidates with sufficient data
  const candidatesWithData = candidates.filter((c) => {
    const metric = metrics.get(c.id);
    return metric && metric.totalUses >= MIN_USES;
  });

  // If no candidates have enough data, use latest version
  if (candidatesWithData.length === 0) {
    return candidates[0]!;
  }

  // Among candidates with data, pick best resolution rate
  let best = candidatesWithData[0]!;
  let bestRate = metrics.get(best.id)!.resolutionRate;

  for (const candidate of candidatesWithData) {
    const metric = metrics.get(candidate.id)!;
    if (metric.resolutionRate > bestRate) {
      best = candidate;
      bestRate = metric.resolutionRate;
    }
  }

  return best;
};

/**
 * Context-Aware Selector
 *
 * Uses optional metadata from InquiryRequest to make context-sensitive choices.
 * For high complexity, prefers proven blueprints. For low complexity, tries newer ones.
 *
 * **Use when:**
 * - You populate complexitySignal or other metadata in your InquiryRequests
 * - You want different strategies for different situations
 * - You have both experimental and proven blueprints
 *
 * @example
 * ```typescript
 * const provider = new LocalHapProvider({
 *   blueprintSource: "./blueprints",
 *   selector: contextAwareSelector,
 *   metricsLogger: metrics
 * });
 *
 * // In your app
 * const request = detector.createRequest({
 *   ladderStage: "meaning",
 *   agencyMode: "convergent",
 *   stopTrigger: true,
 *   complexitySignal: 8  // High complexity
 * });
 * ```
 */
export const contextAwareSelector: BlueprintSelector = (
  candidates,
  request,
  metrics
) => {
  if (candidates.length === 0) {
    throw new Error("contextAwareSelector: No candidates provided");
  }

  const complexity = request.complexitySignal ?? 5; // Default to medium

  // High complexity (7-10): prefer proven blueprints with >10 uses
  if (complexity >= 7) {
    const proven = candidates.find((c) => {
      const metric = metrics.get(c.id);
      return metric && metric.totalUses >= 10;
    });
    return proven || candidates[0]!;
  }

  // Low complexity (1-3): try latest version (experimental)
  if (complexity <= 3) {
    return candidates[0]!;
  }

  // Medium complexity (4-6): balanced approach
  return balancedSelector(candidates, request, metrics);
};

/**
 * Random Selector
 *
 * Randomly selects among candidates.
 * Useful for A/B testing or gathering unbiased metrics.
 *
 * **Use when:**
 * - You're conducting A/B tests on blueprint effectiveness
 * - You want to gather unbiased performance data
 * - You're exploring the solution space
 *
 * **Warning:** This will produce inconsistent user experiences.
 * Only use in development or controlled testing scenarios.
 *
 * @example
 * ```typescript
 * const provider = new LocalHapProvider({
 *   blueprintSource: "./blueprints",
 *   selector: randomSelector,
 *   metricsLogger: metrics
 * });
 * ```
 */
export const randomSelector: BlueprintSelector = (candidates) => {
  if (candidates.length === 0) {
    throw new Error("randomSelector: No candidates provided");
  }
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex]!;
};

/**
 * Epsilon-Greedy Selector
 *
 * Exploration vs exploitation strategy.
 * With probability `epsilon`, picks randomly (explore).
 * Otherwise, picks best performing blueprint (exploit).
 *
 * **Use when:**
 * - You want to balance using best blueprints with discovering new ones
 * - You're in production but still want to gather data on new blueprints
 * - You want gradual, controlled experimentation
 *
 * @param epsilon - Probability of random selection (0-1). Typically 0.1-0.2.
 * @returns BlueprintSelector function
 *
 * @example
 * ```typescript
 * const provider = new LocalHapProvider({
 *   blueprintSource: "./blueprints",
 *   selector: createEpsilonGreedySelector(0.1), // 10% exploration
 *   metricsLogger: metrics
 * });
 * ```
 */
export function createEpsilonGreedySelector(
  epsilon: number
): BlueprintSelector {
  if (epsilon < 0 || epsilon > 1) {
    throw new Error("epsilon must be between 0 and 1");
  }

  return (candidates, request, metrics) => {
    // Explore: pick randomly
    if (Math.random() < epsilon) {
      return randomSelector(candidates, request, metrics);
    }

    // Exploit: pick best performer
    return bestPerformanceSelector(candidates, request, metrics);
  };
}

/**
 * Least Recently Used (LRU) Selector
 *
 * Ensures all blueprints get used by tracking which was used least recently.
 * Requires external state management (Map of blueprint ID -> last used timestamp).
 *
 * **Use when:**
 * - You want to ensure fair testing of all blueprints
 * - You're gathering comprehensive metrics across all options
 * - You want to avoid "cold start" problems with new blueprints
 *
 * @param usageTracker - Map to track last usage timestamp per blueprint
 * @returns BlueprintSelector function
 *
 * @example
 * ```typescript
 * const usageTracker = new Map<string, number>();
 *
 * const provider = new LocalHapProvider({
 *   blueprintSource: "./blueprints",
 *   selector: createLRUSelector(usageTracker),
 *   metricsLogger: metrics
 * });
 * ```
 */
export function createLRUSelector(
  usageTracker: Map<string, number>
): BlueprintSelector {
  return (candidates) => {
    if (candidates.length === 0) {
      throw new Error("createLRUSelector: No candidates provided");
    }

    let leastRecentlyUsed = candidates[0]!;
    let oldestTimestamp = usageTracker.get(leastRecentlyUsed.id) ?? 0;

    for (const candidate of candidates) {
      const lastUsed = usageTracker.get(candidate.id) ?? 0;
      if (lastUsed < oldestTimestamp) {
        leastRecentlyUsed = candidate;
        oldestTimestamp = lastUsed;
      }
    }

    // Update tracker with current timestamp
    usageTracker.set(leastRecentlyUsed.id, Date.now());

    return leastRecentlyUsed;
  };
}
