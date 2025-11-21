/**
 * QuestionSpecFactory tests
 *
 * Verifies blueprint → QuestionSpec conversion with transformers.
 * Coverage: Testing Plan section 3.4 (12 tests, 95% coverage target)
 */

import { describe, it, expect } from "vitest";
import { QuestionSpecFactory } from "../../src/question-spec/QuestionSpecFactory";
import type { InquiryBlueprint } from "../../src/types";
import { ValidationError } from "../../src/types";

describe("QuestionSpecFactory", () => {
  const validConvergentBlueprint: InquiryBlueprint = {
    id: "test-blueprint-01",
    intent: "reduce semantic drift",
    ladderStage: "meaning",
    agencyMode: "convergent",
    targetStructures: ["object_of_discussion", "scope"],
    constraints: {
      tone: "facilitative",
      addressing: "individual",
    },
    renderHint: "ask for clarification",
    examples: ["What specifically are we discussing?"],
    stopCondition: "meaning",
  };

  const validReflectiveBlueprint: InquiryBlueprint = {
    id: "test-blueprint-02",
    intent: "deepen understanding",
    ladderStage: "purpose",
    agencyMode: "reflective",
    targetStructures: ["motivation", "value"],
    constraints: {
      tone: "probing",
      addressing: "group",
    },
    renderHint: "explore deeper",
    examples: ["Why does this matter to the team?"],
    stopCondition: "direction",
  };

  describe("QS-001: Blueprint converts to QuestionSpec correctly", () => {
    it("should convert convergent blueprint with all fields", () => {
      const factory = new QuestionSpecFactory();
      const spec = factory.fromBlueprint(validConvergentBlueprint);

      expect(spec.ladderStage).toBe("meaning");
      expect(spec.targetStructures).toEqual([
        "object_of_discussion",
        "scope",
      ]);
      expect(spec.tone).toBe("facilitative");
      expect(spec.addressing).toBe("individual");
      expect(spec.stopCondition).toBe("meaning");
    });

    it("should extract tone from constraints", () => {
      const factory = new QuestionSpecFactory();
      const spec = factory.fromBlueprint(validConvergentBlueprint);

      expect(spec.tone).toBe(validConvergentBlueprint.constraints.tone);
    });

    it("should extract addressing from constraints", () => {
      const factory = new QuestionSpecFactory();
      const spec = factory.fromBlueprint(validConvergentBlueprint);

      expect(spec.addressing).toBe(
        validConvergentBlueprint.constraints.addressing
      );
    });
  });

  describe("QS-002: Reflective blueprint converts correctly", () => {
    it("should convert reflective blueprint", () => {
      const factory = new QuestionSpecFactory();
      const spec = factory.fromBlueprint(validReflectiveBlueprint);

      expect(spec.ladderStage).toBe("purpose");
      expect(spec.targetStructures).toEqual(["motivation", "value"]);
      expect(spec.tone).toBe("probing");
      expect(spec.addressing).toBe("group");
      expect(spec.stopCondition).toBe("direction");
    });

    it("should preserve agencyMode-specific fields", () => {
      const factory = new QuestionSpecFactory();
      const spec = factory.fromBlueprint(validReflectiveBlueprint);

      // QuestionSpec doesn't include agencyMode, but should preserve other fields
      expect(spec).toBeDefined();
      expect(spec.stopCondition).toBe("direction");
    });
  });

  describe("QS-003: Stop condition types preserved", () => {
    it('should preserve stopCondition="meaning"', () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        stopCondition: "meaning" as const,
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.stopCondition).toBe("meaning");
    });

    it('should preserve stopCondition="direction"', () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        stopCondition: "direction" as const,
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.stopCondition).toBe("direction");
    });

    it('should preserve stopCondition="both"', () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        stopCondition: "both" as const,
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.stopCondition).toBe("both");
    });
  });

  describe("QS-004: targetStructures array copied (not referenced)", () => {
    it("should deep copy targetStructures array", () => {
      const factory = new QuestionSpecFactory();
      // Deep copy to avoid mutating shared blueprint
      const blueprint = {
        ...validConvergentBlueprint,
        targetStructures: [...validConvergentBlueprint.targetStructures],
      };
      const originalStructures = [...blueprint.targetStructures];

      const spec = factory.fromBlueprint(blueprint);

      // Mutate blueprint's targetStructures
      blueprint.targetStructures.push("mutated");

      // Spec should be unchanged (deep copy)
      expect(spec.targetStructures).toEqual(originalStructures);
      expect(spec.targetStructures).not.toContain("mutated");
    });

    it("should not reference the same array", () => {
      const factory = new QuestionSpecFactory();
      // Deep copy to avoid mutating shared blueprint
      const blueprint = {
        ...validConvergentBlueprint,
        targetStructures: [...validConvergentBlueprint.targetStructures],
      };

      const spec = factory.fromBlueprint(blueprint);

      // Should be different array instances
      expect(spec.targetStructures).not.toBe(blueprint.targetStructures);
      expect(spec.targetStructures).toEqual(blueprint.targetStructures);
    });
  });

  describe("QS-T-001: Custom tone transformer applied", () => {
    it("should apply tone transformer", () => {
      const factory = new QuestionSpecFactory({
        toneTransformer: (tone) =>
          tone === "facilitative" ? "probing" : tone,
      });

      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "facilitative", addressing: "individual" },
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.tone).toBe("probing");
    });

    it("should pass through tone if transformer doesn't change it", () => {
      const factory = new QuestionSpecFactory({
        toneTransformer: (tone) => tone,
      });

      const spec = factory.fromBlueprint(validConvergentBlueprint);
      expect(spec.tone).toBe("facilitative");
    });
  });

  describe("QS-T-002: Custom addressing transformer applied", () => {
    it("should apply addressing transformer", () => {
      const factory = new QuestionSpecFactory({
        addressingTransformer: (addr) => (addr === "team" ? "group" : addr),
      });

      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "facilitative", addressing: "team" },
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.addressing).toBe("group");
    });

    it("should pass through addressing if transformer doesn't change it", () => {
      const factory = new QuestionSpecFactory({
        addressingTransformer: (addr) => addr,
      });

      const spec = factory.fromBlueprint(validConvergentBlueprint);
      expect(spec.addressing).toBe("individual");
    });
  });

  describe("QS-T-003: Multiple transformers compose", () => {
    it("should apply both tone and addressing transformers", () => {
      const factory = new QuestionSpecFactory({
        toneTransformer: (tone) =>
          tone === "conversational" ? "facilitative" : tone,
        addressingTransformer: (addr) => (addr === "team" ? "group" : addr),
      });

      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "conversational", addressing: "team" },
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.tone).toBe("facilitative");
      expect(spec.addressing).toBe("group");
    });

    it("should preserve other fields when transforming", () => {
      const factory = new QuestionSpecFactory({
        toneTransformer: (tone) => "probing",
        addressingTransformer: (addr) => "group",
      });

      // Use a fresh copy to avoid mutation from other tests
      const blueprint = {
        ...validConvergentBlueprint,
        targetStructures: [...validConvergentBlueprint.targetStructures],
      };

      const spec = factory.fromBlueprint(blueprint);

      expect(spec.ladderStage).toBe("meaning");
      expect(spec.stopCondition).toBe("meaning");
      expect(spec.targetStructures).toEqual([
        "object_of_discussion",
        "scope",
      ]);
    });
  });

  describe("QS-T-004: Transformer errors handled", () => {
    it("should wrap transformer errors with context", () => {
      const factory = new QuestionSpecFactory({
        toneTransformer: () => {
          throw new Error("Transformer failed");
        },
      });

      expect(() => factory.fromBlueprint(validConvergentBlueprint)).toThrow(
        ValidationError
      );
      expect(() => factory.fromBlueprint(validConvergentBlueprint)).toThrow(
        /Failed to convert blueprint/
      );
    });

    it("should include blueprint ID in error", () => {
      const factory = new QuestionSpecFactory({
        addressingTransformer: () => {
          throw new Error("Bad addressing");
        },
      });

      try {
        factory.fromBlueprint(validConvergentBlueprint);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect((error as ValidationError).message).toContain(
          "test-blueprint-01"
        );
      }
    });

    it("should throw ValidationError for invalid tone after transform", () => {
      const factory = new QuestionSpecFactory({
        toneTransformer: () => "invalid-tone",
      });

      expect(() => factory.fromBlueprint(validConvergentBlueprint)).toThrow(
        ValidationError
      );
      expect(() => factory.fromBlueprint(validConvergentBlueprint)).toThrow(
        /Invalid tone value/
      );
    });

    it("should throw ValidationError for invalid addressing after transform", () => {
      const factory = new QuestionSpecFactory({
        addressingTransformer: () => "invalid-addressing",
      });

      expect(() => factory.fromBlueprint(validConvergentBlueprint)).toThrow(
        ValidationError
      );
      expect(() => factory.fromBlueprint(validConvergentBlueprint)).toThrow(
        /Invalid addressing value/
      );
    });
  });

  describe("QS-V-001: Validates tone values", () => {
    it("should accept facilitative tone", () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "facilitative", addressing: "individual" },
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.tone).toBe("facilitative");
    });

    it("should accept probing tone", () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "probing", addressing: "individual" },
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.tone).toBe("probing");
    });

    it("should accept directive tone", () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "directive", addressing: "individual" },
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.tone).toBe("directive");
    });

    it("should reject invalid tone", () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "aggressive", addressing: "individual" },
      };

      expect(() => factory.fromBlueprint(blueprint)).toThrow(ValidationError);
      expect(() => factory.fromBlueprint(blueprint)).toThrow(
        /Invalid tone value/
      );
    });
  });

  describe("QS-V-002: Validates addressing values", () => {
    it("should accept individual addressing", () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "facilitative", addressing: "individual" },
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.addressing).toBe("individual");
    });

    it("should accept group addressing", () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "facilitative", addressing: "group" },
      };

      const spec = factory.fromBlueprint(blueprint);
      expect(spec.addressing).toBe("group");
    });

    it("should reject invalid addressing", () => {
      const factory = new QuestionSpecFactory();
      const blueprint = {
        ...validConvergentBlueprint,
        constraints: { tone: "facilitative", addressing: "organization" },
      };

      expect(() => factory.fromBlueprint(blueprint)).toThrow(ValidationError);
      expect(() => factory.fromBlueprint(blueprint)).toThrow(
        /Invalid addressing value/
      );
    });
  });
});
