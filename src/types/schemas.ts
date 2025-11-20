/**
 * Zod schemas for runtime validation of HAP protocol types.
 *
 * These schemas enforce:
 * - Only structural fields are allowed
 * - All fields have bounded sizes
 * - No semantic content can pass through
 *
 * @packageDocumentation
 */

import { z } from "zod";

// ============================================================================
// Basic Types
// ============================================================================

export const LadderStageSchema = z.enum([
  "meaning",
  "purpose",
  "intention",
  "action",
]);

export const AgencyModeSchema = z.enum(["convergent", "reflective"]);

export const StopConditionSchema = z.enum(["meaning", "direction", "both"]);

// ============================================================================
// Inquiry Blueprint Schema
// ============================================================================

export const InquiryBlueprintSchema = z.object({
  id: z.string().min(1).max(100),
  intent: z.string().min(1).max(200),
  ladderStage: LadderStageSchema,
  agencyMode: AgencyModeSchema,
  targetStructures: z.array(z.string().max(50)).min(1).max(10),
  constraints: z.object({
    tone: z.string().min(1).max(50),
    addressing: z.string().min(1).max(50),
  }),
  renderHint: z.string().min(1).max(500),
  examples: z.array(z.string().max(200)).max(5),
  stopCondition: StopConditionSchema,
});

// ============================================================================
// Inquiry Request Schema
// ============================================================================

export const InquiryRequestSchema = z.object({
  ladderStage: LadderStageSchema,
  agencyMode: AgencyModeSchema,
  stopTrigger: z.boolean(),
  stopCondition: StopConditionSchema.optional(),
});

// ============================================================================
// Feedback Payload Schema
// ============================================================================

export const FeedbackPayloadSchema = z.object({
  blueprintId: z.string().min(1).max(100),
  patternId: z.string().min(1).max(100),
  agencyMode: AgencyModeSchema,
  stopResolved: z.boolean(),
  // Optional convergent mode fields
  previousPhase: LadderStageSchema.optional(),
  currentPhase: LadderStageSchema.optional(),
  turnsDelta: z.number().int().min(-100).max(100).optional(),
  // Optional reflective mode fields
  recognitionConfirms: z.number().int().min(0).max(100).optional(),
  reflectionCycles: z.number().int().min(0).max(100).optional(),
});

// ============================================================================
// Question Spec Schema (Local)
// ============================================================================

export const QuestionSpecSchema = z.object({
  ladderStage: LadderStageSchema,
  targetStructures: z.array(z.string().max(50)).min(1).max(10),
  tone: z.enum(["facilitative", "probing", "directive"]),
  addressing: z.enum(["individual", "group"]),
  stopCondition: StopConditionSchema,
});

// ============================================================================
// Question Outcome Schema (Metrics)
// ============================================================================

export const QuestionOutcomeSchema = z.object({
  questionId: z.string().min(1).max(100),
  ladderStage: LadderStageSchema,
  stopResolved: z.boolean(),
  turnsToResolution: z.number().int().min(0).max(100),
  phaseAdvanced: z.boolean(),
  timestamp: z.number().int().positive(),
});

// ============================================================================
// Type Inference Helpers
// ============================================================================

/**
 * Infer TypeScript types from Zod schemas.
 * This ensures types and schemas stay in sync.
 */
export type InferredInquiryBlueprint = z.infer<typeof InquiryBlueprintSchema>;
export type InferredInquiryRequest = z.infer<typeof InquiryRequestSchema>;
export type InferredFeedbackPayload = z.infer<typeof FeedbackPayloadSchema>;
export type InferredQuestionSpec = z.infer<typeof QuestionSpecSchema>;
export type InferredQuestionOutcome = z.infer<typeof QuestionOutcomeSchema>;
