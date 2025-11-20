/**
 * Schema validation tests using Zod.
 *
 * These tests verify that runtime validation catches invalid data
 * that might bypass TypeScript's compile-time checks.
 *
 * Coverage: Testing Plan section 3.1 (Schema Validation Tests)
 */

import { describe, it, expect } from "vitest";
import {
  InquiryBlueprintSchema,
  InquiryRequestSchema,
  FeedbackPayloadSchema,
  QuestionSpecSchema,
  LadderStageSchema,
  AgencyModeSchema,
} from "../../src/types";

describe("Schema Validation Tests", () => {
  describe("TS-V-001: InquiryBlueprint schema validates structure", () => {
    it("should accept valid blueprint", () => {
      const valid = {
        id: "test-01",
        intent: "reduce semantic drift",
        ladderStage: "meaning",
        agencyMode: "convergent",
        targetStructures: ["object_of_discussion"],
        constraints: {
          tone: "facilitative",
          addressing: "group",
        },
        renderHint: "ask for the thing",
        examples: ["Are we talking about the same issue?"],
        stopCondition: "meaning",
      };

      const result = InquiryBlueprintSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject blueprint with missing required field", () => {
      const invalid = {
        id: "test-01",
        intent: "reduce semantic drift",
        // missing ladderStage
        agencyMode: "convergent",
        targetStructures: ["object_of_discussion"],
        constraints: {
          tone: "facilitative",
          addressing: "group",
        },
        renderHint: "ask for the thing",
        examples: ["example"],
        stopCondition: "meaning",
      };

      const result = InquiryBlueprintSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("TS-V-002: InquiryBlueprint rejects semantic content", () => {
    it("should reject blueprint with excessively long intent", () => {
      const invalid = {
        id: "test-01",
        intent: "a".repeat(300), // > 200 char limit
        ladderStage: "meaning",
        agencyMode: "convergent",
        targetStructures: ["test"],
        constraints: {
          tone: "facilitative",
          addressing: "group",
        },
        renderHint: "test",
        examples: ["test"],
        stopCondition: "meaning",
      };

      const result = InquiryBlueprintSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject blueprint with too many target structures", () => {
      const invalid = {
        id: "test-01",
        intent: "test",
        ladderStage: "meaning",
        agencyMode: "convergent",
        targetStructures: new Array(15).fill("structure"), // > 10 limit
        constraints: {
          tone: "facilitative",
          addressing: "group",
        },
        renderHint: "test",
        examples: ["test"],
        stopCondition: "meaning",
      };

      const result = InquiryBlueprintSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("TS-V-003: FeedbackPayload requires stop_resolved", () => {
    it("should reject payload without stopResolved", () => {
      const invalid = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
        // missing stopResolved
      };

      const result = FeedbackPayloadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("stopResolved");
      }
    });

    it("should accept payload with stopResolved=true", () => {
      const valid = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
        stopResolved: true,
      };

      const result = FeedbackPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should accept payload with stopResolved=false", () => {
      const valid = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
        stopResolved: false,
      };

      const result = FeedbackPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("TS-V-004: AgencyMode rejects invalid values", () => {
    it("should accept convergent", () => {
      const result = AgencyModeSchema.safeParse("convergent");
      expect(result.success).toBe(true);
    });

    it("should accept reflective", () => {
      const result = AgencyModeSchema.safeParse("reflective");
      expect(result.success).toBe(true);
    });

    it("should reject hybrid", () => {
      const result = AgencyModeSchema.safeParse("hybrid");
      expect(result.success).toBe(false);
    });

    it("should reject arbitrary string", () => {
      const result = AgencyModeSchema.safeParse("random");
      expect(result.success).toBe(false);
    });
  });

  describe("TS-V-005: Numeric fields are bounded", () => {
    it("should accept turnsDelta within range", () => {
      const valid = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
        stopResolved: true,
        turnsDelta: 50, // within [-100, 100]
      };

      const result = FeedbackPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject turnsDelta outside range", () => {
      const invalid = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
        stopResolved: true,
        turnsDelta: 150, // > 100
      };

      const result = FeedbackPayloadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should accept negative turnsDelta within range", () => {
      const valid = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
        stopResolved: true,
        turnsDelta: -50,
      };

      const result = FeedbackPayloadSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject recognitionConfirms outside range", () => {
      const invalid = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "reflective",
        stopResolved: true,
        recognitionConfirms: 150, // > 100
      };

      const result = FeedbackPayloadSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("TS-V-006: LadderStage schema", () => {
    it("should accept all four stages", () => {
      expect(LadderStageSchema.safeParse("meaning").success).toBe(true);
      expect(LadderStageSchema.safeParse("purpose").success).toBe(true);
      expect(LadderStageSchema.safeParse("intention").success).toBe(true);
      expect(LadderStageSchema.safeParse("action").success).toBe(true);
    });

    it("should reject invalid stage", () => {
      expect(LadderStageSchema.safeParse("planning").success).toBe(false);
      expect(LadderStageSchema.safeParse("hybrid").success).toBe(false);
      expect(LadderStageSchema.safeParse("").success).toBe(false);
    });
  });

  describe("TS-V-007: QuestionSpec schema", () => {
    it("should accept valid spec", () => {
      const valid = {
        ladderStage: "meaning",
        targetStructures: ["object_of_discussion"],
        tone: "facilitative",
        addressing: "individual",
        stopCondition: "meaning",
      };

      const result = QuestionSpecSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid tone", () => {
      const invalid = {
        ladderStage: "meaning",
        targetStructures: ["test"],
        tone: "aggressive", // not in enum
        addressing: "individual",
        stopCondition: "meaning",
      };

      const result = QuestionSpecSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid addressing", () => {
      const invalid = {
        ladderStage: "meaning",
        targetStructures: ["test"],
        tone: "facilitative",
        addressing: "organization", // not in enum
        stopCondition: "meaning",
      };

      const result = QuestionSpecSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("TS-V-008: InquiryRequest schema", () => {
    it("should accept valid request", () => {
      const valid = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      const result = InquiryRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should accept request with optional stopCondition", () => {
      const valid = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
        stopCondition: "both",
      };

      const result = InquiryRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject request with invalid ladderStage", () => {
      const invalid = {
        ladderStage: "invalid",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      const result = InquiryRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("TS-V-009: String length limits enforced", () => {
    it("should reject ID longer than 100 chars", () => {
      const invalid = {
        id: "a".repeat(150),
        intent: "test",
        ladderStage: "meaning",
        agencyMode: "convergent",
        targetStructures: ["test"],
        constraints: { tone: "facilitative", addressing: "individual" },
        renderHint: "test",
        examples: ["test"],
        stopCondition: "meaning",
      };

      const result = InquiryBlueprintSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject renderHint longer than 500 chars", () => {
      const invalid = {
        id: "test",
        intent: "test",
        ladderStage: "meaning",
        agencyMode: "convergent",
        targetStructures: ["test"],
        constraints: { tone: "facilitative", addressing: "individual" },
        renderHint: "a".repeat(600),
        examples: ["test"],
        stopCondition: "meaning",
      };

      const result = InquiryBlueprintSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
