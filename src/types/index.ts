/**
 * Core structural types for the Human Agency Protocol
 *
 * These types define ONLY structural, bounded fields.
 * No semantic content (user text, prompts, answers) is allowed.
 *
 * @packageDocumentation
 */

// Re-export schemas, errors, and provider
export * from "./schemas";
export * from "./errors";
export * from "./provider";

// ============================================================================
// Ladder Stages
// ============================================================================

/**
 * The four stages of the Inquiry Ladder.
 *
 * Each stage represents a mandatory checkpoint where AI must confirm
 * human-defined meaning or direction before continuing.
 */
export type LadderStage = "meaning" | "purpose" | "intention" | "action";

// ============================================================================
// Agency Modes
// ============================================================================

/**
 * The two agency modes supported by HAP v0.1.
 *
 * - convergent: Linear progress through ladder stages toward action
 * - reflective: Cyclical exploration within stages for depth
 *
 * Note: hybrid mode was removed from protocol v0.1
 */
export type AgencyMode = "convergent" | "reflective";

/**
 * Stop condition types indicating what AI is missing.
 *
 * - meaning: Unclear semantics or shared understanding
 * - direction: Unclear goal or next action
 * - both: Both meaning and direction are unclear
 */
export type StopCondition = "meaning" | "direction" | "both";

// ============================================================================
// Inquiry Blueprint
// ============================================================================

/**
 * Structured specification of an inquiry act received from HAP Service.
 *
 * Defines why to ask, how to time it, and what structural cues indicate
 * readiness or closure.
 */
export interface InquiryBlueprint {
  /** Unique identifier for this blueprint */
  id: string;

  /** Intent of the inquiry (e.g., "reduce semantic drift") */
  intent: string;

  /** Which ladder stage this blueprint addresses */
  ladderStage: LadderStage;

  /** Which agency mode this blueprint is designed for */
  agencyMode: AgencyMode;

  /** Structural targets to address (e.g., ["object_of_discussion"]) */
  targetStructures: string[];

  /** Constraints for rendering the question */
  constraints: {
    /** Tone of the question (e.g., "facilitative", "probing") */
    tone: string;
    /** Who is being addressed (e.g., "individual", "group") */
    addressing: string;
  };

  /** Hint for local rendering (not the actual question) */
  renderHint: string;

  /** Example questions (for reference, not to be used verbatim) */
  examples: string[];

  /** What the AI is missing that requires human input */
  stopCondition: StopCondition;

  /**
   * LLM prompt guidance (v0.2, optional)
   *
   * Provides structural context to enhance LLM question generation.
   * This is NOT a hardcoded template - it guides the LLM to generate
   * appropriate questions based on the actual user context.
   *
   * Example: "The user has made an ambiguous reference. Help them
   * specify the exact entity they mean."
   *
   * Questions are ALWAYS LLM-generated, never hardcoded.
   */
  promptContext?: string;
}

// ============================================================================
// Inquiry Request
// ============================================================================

/**
 * Request sent to HAP Service to get an Inquiry Blueprint.
 *
 * Contains ONLY structural metadata - no user content.
 */
export interface InquiryRequest {
  /** Which ladder stage we're at */
  ladderStage: LadderStage;

  /** Which agency mode we're using */
  agencyMode: AgencyMode;

  /** Whether a stop condition was triggered */
  stopTrigger: boolean;

  /** Optional: What kind of stop was detected */
  stopCondition?: StopCondition;

  /**
   * Stop pattern identifier (v0.2, optional, structural)
   *
   * Examples: "ambiguous-pronoun", "unclear-scope", "missing-context",
   *           "vague-requirement", "conflicting-goals"
   */
  stopPattern?: string;

  /**
   * Application domain (v0.2, optional)
   *
   * Helps provider select contextually relevant blueprints.
   * Examples: "code", "design", "business", "research", "education"
   */
  domain?: string;

  /**
   * Complexity signal (v0.2, optional, 1-5 scale)
   *
   * 1 = Simple clarification needed
   * 3 = Moderate ambiguity
   * 5 = High complexity, multiple unknowns
   */
  complexitySignal?: number;

  /**
   * Session context (v0.2, optional, structural metrics)
   *
   * Provides structural metrics from current session to help
   * provider adapt blueprint selection.
   */
  sessionContext?: {
    /** Number of stops in this session so far */
    previousStops: number;

    /** Number of consecutive stops without resolution */
    consecutiveStops: number;

    /** Average turns to resolution in this session */
    averageResolutionTurns: number;
  };
}

// ============================================================================
// Feedback Payload
// ============================================================================

/**
 * Structural feedback sent to HAP Service after an inquiry.
 *
 * Reports how inquiry affected agency without revealing content.
 */
export interface FeedbackPayload {
  /** ID of the blueprint that was used */
  blueprintId: string;

  /** ID of the pattern that was applied */
  patternId: string;

  /** Which agency mode was active */
  agencyMode: AgencyMode;

  /** Whether the stop condition was resolved by human input */
  stopResolved: boolean;

  /** Optional: Previous ladder stage (for convergent mode) */
  previousPhase?: LadderStage;

  /** Optional: Current ladder stage (for convergent mode) */
  currentPhase?: LadderStage;

  /** Optional: Change in turns (negative = saved turns) */
  turnsDelta?: number;

  /** Optional: Number of recognition confirmations (for reflective mode) */
  recognitionConfirms?: number;

  /** Optional: Number of reflection cycles (for reflective mode) */
  reflectionCycles?: number;
}

// ============================================================================
// Question Spec (Local)
// ============================================================================

/**
 * Local specification for the Question Engine.
 *
 * Converted from InquiryBlueprint but adapted for local use.
 * This is what the integrator's Question Engine receives.
 */
export interface QuestionSpec {
  /** Which ladder stage to address */
  ladderStage: LadderStage;

  /** Structural targets to focus on */
  targetStructures: string[];

  /** Tone for the question */
  tone: "facilitative" | "probing" | "directive";

  /** Who is being addressed */
  addressing: "individual" | "group";

  /** What the AI is missing */
  stopCondition: StopCondition;

  /**
   * LLM prompt guidance (v0.2, optional)
   *
   * Guides the LLM in generating contextually appropriate questions.
   * Questions are ALWAYS dynamically generated, never hardcoded.
   */
  promptContext?: string;

  /**
   * Example questions (v0.2, optional)
   *
   * Shows desired questioning style. Used as style guidance only,
   * not as templates to be used verbatim.
   */
  examples?: string[];
}

// ============================================================================
// Stop Outcome (Local)
// ============================================================================

/**
 * Result of a stop → ask → proceed cycle.
 *
 * Used internally by StopGuard to track resolution.
 */
export interface StopOutcome {
  /** Whether stop was resolved */
  stopResolved: boolean;

  /** Which ladder stage was involved */
  ladderStage: LadderStage;

  /** How many turns it took to resolve */
  turnsToResolution?: number;

  /** Whether we advanced to next phase */
  phaseAdvanced?: boolean;
}

// ============================================================================
// Question Outcome (Metrics)
// ============================================================================

/**
 * Outcome logged for local optimization.
 *
 * Contains ONLY structural data for improving question quality.
 */
export interface QuestionOutcome {
  /** Unique ID for this question instance */
  questionId: string;

  /** Which ladder stage was addressed */
  ladderStage: LadderStage;

  /** Whether stop was resolved */
  stopResolved: boolean;

  /** How many turns it took */
  turnsToResolution: number;

  /** Whether we advanced to next phase */
  phaseAdvanced: boolean;

  /** When this occurred (Unix timestamp) */
  timestamp: number;
}

// ============================================================================
// Question Engine Interface
// ============================================================================

/**
 * Interface that integrators must implement.
 *
 * The Question Engine generates human-facing questions based on
 * the QuestionSpec and local context (which never leaves the system).
 */
export interface QuestionEngine {
  /**
   * Generate a human-facing question.
   *
   * @param context - Local context (never sent to HAP)
   * @param spec - Structural specification from blueprint
   * @returns A single question string to show the user
   */
  generateQuestion(context: unknown, spec: QuestionSpec): Promise<string>;
}
