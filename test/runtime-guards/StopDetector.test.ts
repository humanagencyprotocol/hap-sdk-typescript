/**
 * StopDetector tests
 *
 * Verifies stop detection helpers with validation.
 * Coverage: Testing Plan section 3.3 RG-E-003
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  StopDetector,
  createManualDetector,
  createDetectorWithStrategy,
} from "../../src/runtime-guards/StopDetector";
import type { StopDetectionStrategy } from "../../src/runtime-guards/StopDetector";
import { ValidationError } from "../../src/types/errors";

describe("StopDetector", () => {
  let detector: StopDetector;

  beforeEach(() => {
    detector = new StopDetector();
  });

  describe("RG-E-003: Stop detection helper validates triggers", () => {
    it("should validate ladderStage in manual request", () => {
      expect(() => {
        detector.createRequest({
          ladderStage: "invalid" as any,
          agencyMode: "convergent",
          stopTrigger: true,
        });
      }).toThrow(ValidationError);
    });

    it("should validate agencyMode in manual request", () => {
      expect(() => {
        detector.createRequest({
          ladderStage: "meaning",
          agencyMode: "hybrid" as any,
          stopTrigger: true,
        });
      }).toThrow(ValidationError);
    });

    it("should validate stopTrigger is boolean", () => {
      expect(() => {
        detector.createRequest({
          ladderStage: "meaning",
          agencyMode: "convergent",
          stopTrigger: "true" as any,
        });
      }).toThrow(ValidationError);
    });

    it("should require ladderStage", () => {
      expect(() => {
        detector.createRequest({
          ladderStage: undefined as any,
          agencyMode: "convergent",
          stopTrigger: true,
        });
      }).toThrow(ValidationError);
    });

    it("should require agencyMode", () => {
      expect(() => {
        detector.createRequest({
          ladderStage: "meaning",
          agencyMode: undefined as any,
          stopTrigger: true,
        });
      }).toThrow(ValidationError);
    });

    it("should require stopTrigger", () => {
      expect(() => {
        detector.createRequest({
          ladderStage: "meaning",
          agencyMode: "convergent",
          stopTrigger: undefined as any,
        });
      }).toThrow(ValidationError);
    });
  });

  describe("Manual request creation", () => {
    it("should create valid request with stopTrigger=true", () => {
      const request = detector.createRequest({
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      });

      expect(request).toEqual({
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      });
    });

    it("should create valid request with stopTrigger=false", () => {
      const request = detector.createRequest({
        ladderStage: "purpose",
        agencyMode: "reflective",
        stopTrigger: false,
      });

      expect(request).toEqual({
        ladderStage: "purpose",
        agencyMode: "reflective",
        stopTrigger: false,
      });
    });

    it("should accept all valid ladder stages", () => {
      const stages: Array<"meaning" | "purpose" | "intention" | "action"> = [
        "meaning",
        "purpose",
        "intention",
        "action",
      ];

      stages.forEach((stage) => {
        const request = detector.createRequest({
          ladderStage: stage,
          agencyMode: "convergent",
          stopTrigger: true,
        });
        expect(request.ladderStage).toBe(stage);
      });
    });

    it("should accept all valid agency modes", () => {
      const modes: Array<"convergent" | "reflective"> = [
        "convergent",
        "reflective",
      ];

      modes.forEach((mode) => {
        const request = detector.createRequest({
          ladderStage: "meaning",
          agencyMode: mode,
          stopTrigger: true,
        });
        expect(request.agencyMode).toBe(mode);
      });
    });
  });

  describe("Strategy-based detection", () => {
    it("should detect stop using custom strategy", async () => {
      const strategy: StopDetectionStrategy = {
        analyze: (context: any) => ({
          shouldStop: context.ambiguous === true,
          ladderStage: "meaning",
          agencyMode: "convergent",
          reason: "Ambiguous input",
        }),
      };

      const detectorWithStrategy = new StopDetector({ strategy });

      const context = { ambiguous: true };
      const request = await detectorWithStrategy.detect(context);

      expect(request).toEqual({
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      });
    });

    it("should not trigger stop when strategy says no", async () => {
      const strategy: StopDetectionStrategy = {
        analyze: () => ({
          shouldStop: false,
          ladderStage: "purpose",
          agencyMode: "convergent",
        }),
      };

      const detectorWithStrategy = new StopDetector({ strategy });
      const request = await detectorWithStrategy.detect({});

      expect(request.stopTrigger).toBe(false);
    });

    it("should support async strategies", async () => {
      const strategy: StopDetectionStrategy = {
        analyze: async (context: any) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            shouldStop: context.needsClarification,
            ladderStage: "intention",
            agencyMode: "reflective",
          };
        },
      };

      const detectorWithStrategy = new StopDetector({ strategy });
      const request = await detectorWithStrategy.detect({
        needsClarification: true,
      });

      expect(request.stopTrigger).toBe(true);
      expect(request.ladderStage).toBe("intention");
    });

    it("should validate strategy analysis result", async () => {
      const invalidStrategy: StopDetectionStrategy = {
        analyze: () => ({
          shouldStop: true,
          ladderStage: "invalid" as any,
          agencyMode: "convergent",
        }),
      };

      const detectorWithStrategy = new StopDetector({
        strategy: invalidStrategy,
      });

      await expect(detectorWithStrategy.detect({})).rejects.toThrow(
        ValidationError
      );
    });

    it("should require strategy for detect() method", async () => {
      const manualDetector = new StopDetector();

      await expect(manualDetector.detect({})).rejects.toThrow(ValidationError);
    });

    it("should validate analysis has ladderStage", async () => {
      const strategy: StopDetectionStrategy = {
        analyze: () =>
          ({
            shouldStop: true,
            // missing ladderStage
            agencyMode: "convergent",
          }) as any,
      };

      const detectorWithStrategy = new StopDetector({ strategy });

      await expect(detectorWithStrategy.detect({})).rejects.toThrow(
        ValidationError
      );
    });

    it("should validate analysis has agencyMode", async () => {
      const strategy: StopDetectionStrategy = {
        analyze: () =>
          ({
            shouldStop: true,
            ladderStage: "meaning",
            // missing agencyMode
          }) as any,
      };

      const detectorWithStrategy = new StopDetector({ strategy });

      await expect(detectorWithStrategy.detect({})).rejects.toThrow(
        ValidationError
      );
    });

    it("should validate analysis has shouldStop", async () => {
      const strategy: StopDetectionStrategy = {
        analyze: () =>
          ({
            // missing shouldStop
            ladderStage: "meaning",
            agencyMode: "convergent",
          }) as any,
      };

      const detectorWithStrategy = new StopDetector({ strategy });

      await expect(detectorWithStrategy.detect({})).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("Convenience functions", () => {
    it("should create manual detector", () => {
      const manual = createManualDetector();
      const request = manual.createRequest({
        ladderStage: "action",
        agencyMode: "convergent",
        stopTrigger: false,
      });

      expect(request.stopTrigger).toBe(false);
    });

    it("should create detector with strategy", async () => {
      const strategy: StopDetectionStrategy = {
        analyze: () => ({
          shouldStop: true,
          ladderStage: "meaning",
          agencyMode: "reflective",
        }),
      };

      const detectorWithStrat = createDetectorWithStrategy(strategy);
      const request = await detectorWithStrat.detect({});

      expect(request.stopTrigger).toBe(true);
      expect(request.agencyMode).toBe("reflective");
    });
  });

  describe("Integration scenarios", () => {
    it("should support ambiguity detection pattern", async () => {
      const ambiguityDetector = createDetectorWithStrategy({
        analyze: (context: any) => {
          const hasKeywords = ["maybe", "unclear", "not sure"].some((keyword) =>
            context.userInput?.toLowerCase().includes(keyword)
          );

          return {
            shouldStop: hasKeywords,
            ladderStage: "meaning",
            agencyMode: "convergent",
            reason: hasKeywords ? "Ambiguous language detected" : undefined,
          };
        },
      });

      const ambiguousContext = { userInput: "I'm not sure what to do" };
      const clearContext = { userInput: "Create a report" };

      const ambiguousRequest = await ambiguityDetector.detect(ambiguousContext);
      const clearRequest = await ambiguityDetector.detect(clearContext);

      expect(ambiguousRequest.stopTrigger).toBe(true);
      expect(clearRequest.stopTrigger).toBe(false);
    });

    it("should support multi-stage detection", async () => {
      const multiStageDetector = createDetectorWithStrategy({
        analyze: (context: any) => {
          // Detect which stage based on context
          const stage = context.currentStage || "meaning";
          const needsStop = context.confidence < 0.7;

          return {
            shouldStop: needsStop,
            ladderStage: stage,
            agencyMode: "convergent",
            reason: needsStop ? `Low confidence: ${context.confidence}` : undefined,
          };
        },
      });

      const meaningContext = { currentStage: "meaning", confidence: 0.5 };
      const purposeContext = { currentStage: "purpose", confidence: 0.9 };

      const meaningRequest = await multiStageDetector.detect(meaningContext);
      const purposeRequest = await multiStageDetector.detect(purposeContext);

      expect(meaningRequest.ladderStage).toBe("meaning");
      expect(meaningRequest.stopTrigger).toBe(true);

      expect(purposeRequest.ladderStage).toBe("purpose");
      expect(purposeRequest.stopTrigger).toBe(false);
    });

    it("should support reflective mode detection", async () => {
      const reflectiveDetector = createDetectorWithStrategy({
        analyze: (context: any) => ({
          shouldStop: context.needsReflection === true,
          ladderStage: context.stage || "meaning",
          agencyMode: "reflective",
        }),
      });

      const request = await reflectiveDetector.detect({
        needsReflection: true,
        stage: "purpose",
      });

      expect(request.agencyMode).toBe("reflective");
      expect(request.stopTrigger).toBe(true);
    });
  });

  describe("Error messages", () => {
    it("should provide clear error for invalid ladder stage", () => {
      expect(() => {
        detector.createRequest({
          ladderStage: "invalid-stage" as any,
          agencyMode: "convergent",
          stopTrigger: true,
        });
      }).toThrow(/Invalid ladderStage.*meaning, purpose, intention, action/);
    });

    it("should provide clear error for invalid agency mode", () => {
      expect(() => {
        detector.createRequest({
          ladderStage: "meaning",
          agencyMode: "hybrid" as any,
          stopTrigger: true,
        });
      }).toThrow(/Invalid agencyMode.*convergent, reflective/);
    });

    it("should provide clear error when no strategy configured", async () => {
      const manual = createManualDetector();

      await expect(manual.detect({})).rejects.toThrow(
        /No detection strategy configured.*createRequest/
      );
    });
  });
});
