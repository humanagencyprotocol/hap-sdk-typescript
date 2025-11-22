/**
 * Metadata Helpers tests
 *
 * Verifies helper functions for creating structural metadata.
 * Coverage: Testing Plan section M7
 */

import { describe, it, expect } from "vitest";
import {
  StopPatterns,
  Domains,
  ComplexityLevels,
  detectAmbiguityPattern,
  classifyDomain,
  estimateComplexity,
  createSessionContext,
} from "../../src/runtime-guards/metadata-helpers";

describe("Metadata Helpers", () => {
  describe("StopPatterns constants", () => {
    it("should provide meaning-level patterns", () => {
      expect(StopPatterns.AMBIGUOUS_PRONOUN).toBe("ambiguous-pronoun");
      expect(StopPatterns.VAGUE_QUANTIFIER).toBe("vague-quantifier");
      expect(StopPatterns.UNCLEAR_OBJECT).toBe("unclear-object");
      expect(StopPatterns.MISSING_CONTEXT).toBe("missing-context");
    });

    it("should provide purpose-level patterns", () => {
      expect(StopPatterns.UNCLEAR_DIRECTION).toBe("unclear-direction");
      expect(StopPatterns.MISSING_GOAL).toBe("missing-goal");
      expect(StopPatterns.AMBIGUOUS_INTENT).toBe("ambiguous-intent");
    });

    it("should provide intention-level patterns", () => {
      expect(StopPatterns.MULTIPLE_PATHS).toBe("multiple-paths");
      expect(StopPatterns.UNCLEAR_APPROACH).toBe("unclear-approach");
    });

    it("should provide action-level patterns", () => {
      expect(StopPatterns.INSUFFICIENT_DETAILS).toBe("insufficient-details");
      expect(StopPatterns.MISSING_PARAMETERS).toBe("missing-parameters");
    });
  });

  describe("Domains constants", () => {
    it("should provide common domain identifiers", () => {
      expect(Domains.SOFTWARE_DEVELOPMENT).toBe("software-development");
      expect(Domains.DATA_ANALYSIS).toBe("data-analysis");
      expect(Domains.CONTENT_CREATION).toBe("content-creation");
      expect(Domains.PROJECT_MANAGEMENT).toBe("project-management");
      expect(Domains.RESEARCH).toBe("research");
      expect(Domains.DESIGN).toBe("design");
      expect(Domains.GENERAL).toBe("general");
    });
  });

  describe("ComplexityLevels constants", () => {
    it("should provide complexity scale 1-5", () => {
      expect(ComplexityLevels.VERY_LOW).toBe(1);
      expect(ComplexityLevels.LOW).toBe(2);
      expect(ComplexityLevels.MEDIUM).toBe(3);
      expect(ComplexityLevels.HIGH).toBe(4);
      expect(ComplexityLevels.VERY_HIGH).toBe(5);
    });
  });

  describe("detectAmbiguityPattern", () => {
    it("should detect ambiguous pronouns", () => {
      expect(detectAmbiguityPattern("Can you update it?")).toBe(
        "ambiguous-pronoun"
      );
      expect(detectAmbiguityPattern("This needs to be fixed")).toBe(
        "ambiguous-pronoun"
      );
      expect(detectAmbiguityPattern("They should work on that")).toBe(
        "ambiguous-pronoun"
      );
    });

    it("should detect vague quantifiers", () => {
      expect(detectAmbiguityPattern("Add some features")).toBe(
        "vague-quantifier"
      );
      expect(detectAmbiguityPattern("Make the design kind of better")).toBe(
        "vague-quantifier"
      );
      expect(detectAmbiguityPattern("We need many improvements")).toBe(
        "vague-quantifier"
      );
    });

    it("should detect missing context", () => {
      expect(detectAmbiguityPattern("Update the thing")).toBe(
        "missing-context"
      );
      expect(detectAmbiguityPattern("Fix the one we discussed")).toBe(
        "missing-context"
      );
    });

    it("should return null for clear text", () => {
      expect(detectAmbiguityPattern("Create a new user profile")).toBeNull();
      expect(
        detectAmbiguityPattern("Add authentication to the login page")
      ).toBeNull();
    });

    it("should be case-insensitive", () => {
      expect(detectAmbiguityPattern("CAN YOU UPDATE IT?")).toBe(
        "ambiguous-pronoun"
      );
      expect(detectAmbiguityPattern("ADD SOME FEATURES")).toBe(
        "vague-quantifier"
      );
    });
  });

  describe("classifyDomain", () => {
    it("should classify software development domain", () => {
      expect(classifyDomain(["code", "function", "test"])).toBe(
        "software-development"
      );
      expect(classifyDomain(["api", "database", "deploy"])).toBe(
        "software-development"
      );
      expect(classifyDomain(["refactor", "bug", "class"])).toBe(
        "software-development"
      );
    });

    it("should classify data analysis domain", () => {
      expect(classifyDomain(["data", "analyze", "chart"])).toBe(
        "data-analysis"
      );
      expect(classifyDomain(["statistics", "metrics", "dataset"])).toBe(
        "data-analysis"
      );
    });

    it("should classify content creation domain", () => {
      expect(classifyDomain(["write", "article", "blog"])).toBe(
        "content-creation"
      );
      expect(classifyDomain(["draft", "edit", "content"])).toBe(
        "content-creation"
      );
    });

    it("should classify project management domain", () => {
      expect(classifyDomain(["project", "task", "deadline"])).toBe(
        "project-management"
      );
      expect(classifyDomain(["milestone", "schedule", "team"])).toBe(
        "project-management"
      );
    });

    it("should classify research domain", () => {
      expect(classifyDomain(["research", "study", "paper"])).toBe("research");
      expect(classifyDomain(["hypothesis", "experiment"])).toBe("research");
    });

    it("should classify design domain", () => {
      expect(classifyDomain(["design", "mockup", "ui"])).toBe("design");
      expect(classifyDomain(["layout", "prototype", "interface"])).toBe(
        "design"
      );
    });

    it("should default to general domain", () => {
      expect(classifyDomain(["random", "words", "here"])).toBe("general");
      expect(classifyDomain([])).toBe("general");
    });

    it("should be case-insensitive", () => {
      expect(classifyDomain(["CODE", "FUNCTION"])).toBe("software-development");
      expect(classifyDomain(["Data", "Analyze"])).toBe("data-analysis");
    });
  });

  describe("estimateComplexity", () => {
    it("should return minimum complexity for simple cases", () => {
      expect(estimateComplexity({})).toBe(1);
      expect(
        estimateComplexity({
          numEntities: 1,
          hasAmbiguity: false,
        })
      ).toBe(1);
    });

    it("should increase complexity for multiple entities", () => {
      expect(
        estimateComplexity({
          numEntities: 5,
        })
      ).toBeGreaterThan(1);

      expect(
        estimateComplexity({
          numEntities: 10,
        })
      ).toBeGreaterThanOrEqual(3);
    });

    it("should increase complexity for ambiguity", () => {
      const withoutAmbiguity = estimateComplexity({
        hasAmbiguity: false,
      });
      const withAmbiguity = estimateComplexity({
        hasAmbiguity: true,
      });

      expect(withAmbiguity).toBeGreaterThan(withoutAmbiguity);
    });

    it("should increase complexity for prior stops", () => {
      const noPriorStops = estimateComplexity({
        priorStops: 0,
      });
      const manyPriorStops = estimateComplexity({
        priorStops: 5,
      });

      expect(manyPriorStops).toBeGreaterThan(noPriorStops);
    });

    it("should increase complexity for multiple paths", () => {
      const singlePath = estimateComplexity({
        hasMultiplePaths: false,
      });
      const multiplePaths = estimateComplexity({
        hasMultiplePaths: true,
      });

      expect(multiplePaths).toBeGreaterThan(singlePath);
    });

    it("should increase complexity for long text", () => {
      const shortText = estimateComplexity({
        textLength: 100,
      });
      const longText = estimateComplexity({
        textLength: 1000,
      });

      expect(longText).toBeGreaterThan(shortText);
    });

    it("should clamp to range 1-5", () => {
      const veryComplex = estimateComplexity({
        numEntities: 20,
        hasAmbiguity: true,
        priorStops: 10,
        hasMultiplePaths: true,
        textLength: 5000,
      });

      expect(veryComplex).toBeLessThanOrEqual(5);
      expect(veryComplex).toBeGreaterThanOrEqual(1);
    });

    it("should handle combined signals", () => {
      const complexity = estimateComplexity({
        numEntities: 8,
        hasAmbiguity: true,
        priorStops: 3,
        hasMultiplePaths: true,
      });

      expect(complexity).toBeGreaterThanOrEqual(3);
      expect(complexity).toBeLessThanOrEqual(5);
    });
  });

  describe("createSessionContext", () => {
    it("should count total stops", () => {
      const context = createSessionContext({
        stops: [
          { resolved: true, turns: 2 },
          { resolved: true, turns: 3 },
          { resolved: false, turns: 1 },
        ],
      });

      expect(context.previousStops).toBe(3);
    });

    it("should count consecutive unresolved stops", () => {
      const context = createSessionContext({
        stops: [
          { resolved: true, turns: 2 },
          { resolved: false, turns: 1 },
          { resolved: false, turns: 1 },
        ],
      });

      expect(context.consecutiveStops).toBe(2);
    });

    it("should stop counting at first resolved stop", () => {
      const context = createSessionContext({
        stops: [
          { resolved: false, turns: 1 },
          { resolved: true, turns: 2 },
          { resolved: false, turns: 1 },
        ],
      });

      expect(context.consecutiveStops).toBe(1);
    });

    it("should calculate average resolution turns", () => {
      const context = createSessionContext({
        stops: [
          { resolved: true, turns: 2 },
          { resolved: true, turns: 4 },
          { resolved: false, turns: 1 },
        ],
      });

      expect(context.averageResolutionTurns).toBe(3); // (2 + 4) / 2
    });

    it("should handle all resolved stops", () => {
      const context = createSessionContext({
        stops: [
          { resolved: true, turns: 2 },
          { resolved: true, turns: 3 },
          { resolved: true, turns: 4 },
        ],
      });

      expect(context.consecutiveStops).toBe(0);
      expect(context.averageResolutionTurns).toBe(3); // (2 + 3 + 4) / 3
    });

    it("should handle all unresolved stops", () => {
      const context = createSessionContext({
        stops: [
          { resolved: false, turns: 1 },
          { resolved: false, turns: 1 },
        ],
      });

      expect(context.consecutiveStops).toBe(2);
      expect(context.averageResolutionTurns).toBe(0); // No resolved stops
    });

    it("should handle empty stops array", () => {
      const context = createSessionContext({
        stops: [],
      });

      expect(context.previousStops).toBe(0);
      expect(context.consecutiveStops).toBe(0);
      expect(context.averageResolutionTurns).toBe(0);
    });

    it("should handle fractional average turns", () => {
      const context = createSessionContext({
        stops: [
          { resolved: true, turns: 2 },
          { resolved: true, turns: 3 },
          { resolved: true, turns: 4 },
        ],
      });

      expect(context.averageResolutionTurns).toBeCloseTo(3.0);
    });
  });
});
