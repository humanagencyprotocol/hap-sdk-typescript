/**
 * Metadata Helpers - Utilities for creating structural metadata
 *
 * Provides constants and helper functions to make it easier for apps
 * to add structural metadata to InquiryRequests. All metadata is
 * privacy-safe (no semantic content).
 *
 * @packageDocumentation
 */

/**
 * Common stop patterns based on blueprint targetStructures
 *
 * These identify structural issues that trigger stops, helping
 * LocalHapProvider select appropriate blueprints.
 */
export const StopPatterns = {
  // Meaning-level patterns (what is being discussed)
  AMBIGUOUS_PRONOUN: "ambiguous-pronoun",
  VAGUE_QUANTIFIER: "vague-quantifier",
  UNCLEAR_OBJECT: "unclear-object",
  MISSING_CONTEXT: "missing-context",
  TECHNICAL_JARGON: "technical-jargon",

  // Purpose-level patterns (why something is being done)
  UNCLEAR_DIRECTION: "unclear-direction",
  MISSING_GOAL: "missing-goal",
  AMBIGUOUS_INTENT: "ambiguous-intent",
  CONFLICTING_OBJECTIVES: "conflicting-objectives",

  // Intention-level patterns (how to proceed)
  MULTIPLE_PATHS: "multiple-paths",
  UNCLEAR_APPROACH: "unclear-approach",
  MISSING_CONSTRAINTS: "missing-constraints",

  // Action-level patterns (specific actions)
  INSUFFICIENT_DETAILS: "insufficient-details",
  MISSING_PARAMETERS: "missing-parameters",
  UNCLEAR_SEQUENCE: "unclear-sequence",
} as const;

/**
 * Common domain classifications
 *
 * Help LocalHapProvider understand the context domain for better
 * blueprint selection. Use kebab-case identifiers.
 */
export const Domains = {
  SOFTWARE_DEVELOPMENT: "software-development",
  DATA_ANALYSIS: "data-analysis",
  CONTENT_CREATION: "content-creation",
  PROJECT_MANAGEMENT: "project-management",
  RESEARCH: "research",
  DESIGN: "design",
  EDUCATION: "education",
  CUSTOMER_SUPPORT: "customer-support",
  GENERAL: "general",
} as const;

/**
 * Complexity levels (1-5 scale)
 *
 * Signal task complexity to help LocalHapProvider choose appropriate
 * blueprints. Higher complexity may favor proven blueprints.
 */
export const ComplexityLevels = {
  /** Very simple, straightforward task */
  VERY_LOW: 1,
  /** Simple task with few variables */
  LOW: 2,
  /** Moderate complexity, some context needed */
  MEDIUM: 3,
  /** Complex task with multiple factors */
  HIGH: 4,
  /** Very complex, requires careful handling */
  VERY_HIGH: 5,
} as const;

/**
 * Helper to detect common ambiguity patterns in text
 *
 * @param text - User input to analyze
 * @returns Detected stop pattern or null if none found
 *
 * @example
 * ```typescript
 * const pattern = detectAmbiguityPattern("Can you update it?");
 * // Returns "ambiguous-pronoun" due to "it"
 * ```
 */
export function detectAmbiguityPattern(
  text: string
): string | null {
  const lowerText = text.toLowerCase();

  // Check for ambiguous pronouns
  const ambiguousPronouns = /\b(it|this|that|they|them|these|those)\b/;
  if (ambiguousPronouns.test(lowerText)) {
    return StopPatterns.AMBIGUOUS_PRONOUN;
  }

  // Check for vague quantifiers
  const vagueQuantifiers =
    /\b(some|many|few|several|most|lots of|a bit|kind of|sort of)\b/;
  if (vagueQuantifiers.test(lowerText)) {
    return StopPatterns.VAGUE_QUANTIFIER;
  }

  // Check for missing context indicators
  const missingContextIndicators = /\b(the (thing|one|file|code|function))\b/;
  if (missingContextIndicators.test(lowerText)) {
    return StopPatterns.MISSING_CONTEXT;
  }

  return null;
}

/**
 * Helper to classify domain from context keywords
 *
 * @param keywords - Array of keywords from context
 * @returns Detected domain or "general" if none matched
 *
 * @example
 * ```typescript
 * const domain = classifyDomain(["code", "function", "test"]);
 * // Returns "software-development"
 * ```
 */
export function classifyDomain(keywords: string[]): string {
  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  // Software development indicators
  const softwareKeywords = [
    "code",
    "function",
    "class",
    "api",
    "database",
    "test",
    "bug",
    "refactor",
    "deploy",
  ];
  if (lowerKeywords.some((k) => softwareKeywords.includes(k))) {
    return Domains.SOFTWARE_DEVELOPMENT;
  }

  // Data analysis indicators
  const dataKeywords = [
    "data",
    "analyze",
    "chart",
    "graph",
    "statistics",
    "dataset",
    "metrics",
  ];
  if (lowerKeywords.some((k) => dataKeywords.includes(k))) {
    return Domains.DATA_ANALYSIS;
  }

  // Content creation indicators
  const contentKeywords = [
    "write",
    "article",
    "blog",
    "post",
    "draft",
    "edit",
    "content",
  ];
  if (lowerKeywords.some((k) => contentKeywords.includes(k))) {
    return Domains.CONTENT_CREATION;
  }

  // Project management indicators
  const projectKeywords = [
    "project",
    "task",
    "deadline",
    "milestone",
    "schedule",
    "team",
  ];
  if (lowerKeywords.some((k) => projectKeywords.includes(k))) {
    return Domains.PROJECT_MANAGEMENT;
  }

  // Research indicators
  const researchKeywords = [
    "research",
    "study",
    "paper",
    "hypothesis",
    "experiment",
    "literature",
  ];
  if (lowerKeywords.some((k) => researchKeywords.includes(k))) {
    return Domains.RESEARCH;
  }

  // Design indicators
  const designKeywords = [
    "design",
    "layout",
    "mockup",
    "prototype",
    "ui",
    "ux",
    "interface",
  ];
  if (lowerKeywords.some((k) => designKeywords.includes(k))) {
    return Domains.DESIGN;
  }

  return Domains.GENERAL;
}

/**
 * Helper to estimate complexity from context signals
 *
 * @param signals - Complexity indicators
 * @returns Complexity score (1-5)
 *
 * @example
 * ```typescript
 * const complexity = estimateComplexity({
 *   numEntities: 8,
 *   hasAmbiguity: true,
 *   priorStops: 3
 * });
 * // Returns 4 (HIGH complexity)
 * ```
 */
export function estimateComplexity(signals: {
  /** Number of entities/objects mentioned */
  numEntities?: number;
  /** Whether ambiguity is present */
  hasAmbiguity?: boolean;
  /** Number of prior stops in session */
  priorStops?: number;
  /** Whether multiple paths/options exist */
  hasMultiplePaths?: boolean;
  /** Text length (rough proxy for complexity) */
  textLength?: number;
}): number {
  let score = 1; // Start at minimum

  // Increase for multiple entities
  if (signals.numEntities !== undefined) {
    if (signals.numEntities >= 5) score += 2;
    else if (signals.numEntities >= 3) score += 1;
  }

  // Increase for ambiguity
  if (signals.hasAmbiguity) {
    score += 1;
  }

  // Increase for prior stops (suggests cumulative complexity)
  if (signals.priorStops !== undefined) {
    if (signals.priorStops >= 3) score += 1;
  }

  // Increase for multiple paths
  if (signals.hasMultiplePaths) {
    score += 1;
  }

  // Slight increase for very long text
  if (signals.textLength !== undefined && signals.textLength > 500) {
    score += 1;
  }

  // Clamp to 1-5 range
  return Math.min(5, Math.max(1, score));
}

/**
 * Helper to create session context from tracking data
 *
 * @param sessionData - Session tracking metrics
 * @returns Session context object for metadata
 *
 * @example
 * ```typescript
 * const sessionContext = createSessionContext({
 *   stops: [
 *     { resolved: true, turns: 2 },
 *     { resolved: true, turns: 3 },
 *     { resolved: false, turns: 1 }
 *   ]
 * });
 * // Returns { previousStops: 3, consecutiveStops: 1, averageResolutionTurns: 2.5 }
 * ```
 */
export function createSessionContext(sessionData: {
  stops: Array<{ resolved: boolean; turns: number }>;
}): {
  previousStops: number;
  consecutiveStops: number;
  averageResolutionTurns: number;
} {
  const { stops } = sessionData;

  // Count consecutive unresolved stops from the end
  let consecutiveStops = 0;
  for (let i = stops.length - 1; i >= 0; i--) {
    const stop = stops[i];
    if (stop && !stop.resolved) {
      consecutiveStops++;
    } else {
      break;
    }
  }

  // Calculate average resolution turns for resolved stops
  const resolvedStops = stops.filter((s) => s.resolved);
  const averageResolutionTurns =
    resolvedStops.length > 0
      ? resolvedStops.reduce((sum, s) => sum + s.turns, 0) /
        resolvedStops.length
      : 0;

  return {
    previousStops: stops.length,
    consecutiveStops,
    averageResolutionTurns,
  };
}
