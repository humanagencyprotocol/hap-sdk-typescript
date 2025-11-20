/**
 * Type safety tests for HAP SDK types.
 *
 * These tests verify that the TypeScript type system prevents invalid states
 * at compile time. They use @ts-expect-error to assert that certain code
 * should NOT compile.
 *
 * Coverage: Testing Plan section 3.1 (Type Safety Tests)
 */

import { describe, it, expect } from "vitest";
import type {
  AgencyMode,
  LadderStage,
  FeedbackPayload,
  InquiryRequest,
  InquiryBlueprint,
} from "../../src/types";

describe("Type Safety Tests", () => {
  describe("TS-T-001: Invalid AgencyMode rejected", () => {
    it("should reject hybrid mode at compile time", () => {
      // @ts-expect-error - hybrid mode not allowed in v0.1
      const invalid: AgencyMode = "hybrid";

      // Runtime check to satisfy vitest
      expect(invalid).toBeDefined();
    });

    it("should accept convergent mode", () => {
      const valid: AgencyMode = "convergent";
      expect(valid).toBe("convergent");
    });

    it("should accept reflective mode", () => {
      const valid: AgencyMode = "reflective";
      expect(valid).toBe("reflective");
    });
  });

  describe("TS-T-002: FeedbackPayload requires stop_resolved", () => {
    it("should reject payload without stopResolved", () => {
      // @ts-expect-error - stopResolved is required
      const invalid: FeedbackPayload = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
      };

      expect(invalid).toBeDefined();
    });

    it("should accept payload with stopResolved", () => {
      const valid: FeedbackPayload = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
        stopResolved: true,
      };

      expect(valid.stopResolved).toBe(true);
    });
  });

  describe("TS-T-003: LadderStage enum is exhaustive", () => {
    it("should accept all four valid stages", () => {
      const meaning: LadderStage = "meaning";
      const purpose: LadderStage = "purpose";
      const intention: LadderStage = "intention";
      const action: LadderStage = "action";

      expect(meaning).toBe("meaning");
      expect(purpose).toBe("purpose");
      expect(intention).toBe("intention");
      expect(action).toBe("action");
    });

    it("should reject invalid stage", () => {
      // @ts-expect-error - only 4 stages allowed
      const invalid: LadderStage = "planning";

      expect(invalid).toBeDefined();
    });

    it("should reject hybrid as a stage", () => {
      // @ts-expect-error - hybrid is not a stage
      const invalid: LadderStage = "hybrid";

      expect(invalid).toBeDefined();
    });
  });

  describe("TS-T-004: InquiryRequest structure", () => {
    it("should require ladderStage and agencyMode", () => {
      // Valid request
      const valid: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      expect(valid).toBeDefined();
    });

    it("should reject request without ladderStage", () => {
      // @ts-expect-error - ladderStage required
      const invalid: InquiryRequest = {
        agencyMode: "convergent",
        stopTrigger: true,
      };

      expect(invalid).toBeDefined();
    });

    it("should reject request without agencyMode", () => {
      // @ts-expect-error - agencyMode required
      const invalid: InquiryRequest = {
        ladderStage: "meaning",
        stopTrigger: true,
      };

      expect(invalid).toBeDefined();
    });
  });

  describe("TS-T-005: InquiryBlueprint structure", () => {
    it("should require all mandatory fields", () => {
      const valid: InquiryBlueprint = {
        id: "test-01",
        intent: "test intent",
        ladderStage: "meaning",
        agencyMode: "convergent",
        targetStructures: ["test"],
        constraints: {
          tone: "facilitative",
          addressing: "individual",
        },
        renderHint: "test hint",
        examples: ["test example"],
        stopCondition: "meaning",
      };

      expect(valid).toBeDefined();
    });

    it("should reject blueprint without stopCondition", () => {
      // @ts-expect-error - stopCondition required
      const invalid: InquiryBlueprint = {
        id: "test-01",
        intent: "test intent",
        ladderStage: "meaning",
        agencyMode: "convergent",
        targetStructures: ["test"],
        constraints: {
          tone: "facilitative",
          addressing: "individual",
        },
        renderHint: "test hint",
        examples: ["test example"],
      };

      expect(invalid).toBeDefined();
    });
  });

  describe("TS-T-006: Type narrowing works correctly", () => {
    it("should narrow AgencyMode type", () => {
      const mode: AgencyMode = "convergent";

      if (mode === "convergent") {
        // Type is narrowed to "convergent"
        const narrowed: "convergent" = mode;
        expect(narrowed).toBe("convergent");
      }
    });

    it("should narrow LadderStage type", () => {
      const stage: LadderStage = "meaning";

      if (stage === "meaning") {
        // Type is narrowed to "meaning"
        const narrowed: "meaning" = stage;
        expect(narrowed).toBe("meaning");
      }
    });
  });

  describe("TS-T-007: Optional fields work correctly", () => {
    it("should allow FeedbackPayload without optional fields", () => {
      const minimal: FeedbackPayload = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
        stopResolved: true,
      };

      expect(minimal).toBeDefined();
      expect(minimal.turnsDelta).toBeUndefined();
      expect(minimal.previousPhase).toBeUndefined();
    });

    it("should allow FeedbackPayload with convergent fields", () => {
      const withConvergent: FeedbackPayload = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "convergent",
        stopResolved: true,
        previousPhase: "meaning",
        currentPhase: "purpose",
        turnsDelta: -2,
      };

      expect(withConvergent.previousPhase).toBe("meaning");
      expect(withConvergent.turnsDelta).toBe(-2);
    });

    it("should allow FeedbackPayload with reflective fields", () => {
      const withReflective: FeedbackPayload = {
        blueprintId: "test",
        patternId: "test-pattern",
        agencyMode: "reflective",
        stopResolved: true,
        recognitionConfirms: 3,
        reflectionCycles: 2,
      };

      expect(withReflective.recognitionConfirms).toBe(3);
      expect(withReflective.reflectionCycles).toBe(2);
    });
  });
});
