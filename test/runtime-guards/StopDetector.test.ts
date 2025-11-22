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

  describe("Metadata support (M7)", () => {
    describe("createRequestWithMetadata", () => {
      it("should create request with all metadata fields", () => {
        const request = detector.createRequestWithMetadata({
          ladderStage: "meaning",
          agencyMode: "convergent",
          stopTrigger: true,
          stopPattern: "ambiguous-pronoun",
          domain: "software-development",
          complexitySignal: 3,
          sessionContext: {
            previousStops: 2,
            consecutiveStops: 1,
            averageResolutionTurns: 2.5,
          },
        });

        expect(request).toEqual({
          ladderStage: "meaning",
          agencyMode: "convergent",
          stopTrigger: true,
          stopPattern: "ambiguous-pronoun",
          domain: "software-development",
          complexitySignal: 3,
          sessionContext: {
            previousStops: 2,
            consecutiveStops: 1,
            averageResolutionTurns: 2.5,
          },
        });
      });

      it("should create request with only required fields", () => {
        const request = detector.createRequestWithMetadata({
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

      it("should create request with partial metadata", () => {
        const request = detector.createRequestWithMetadata({
          ladderStage: "intention",
          agencyMode: "convergent",
          stopTrigger: true,
          stopPattern: "multiple-paths",
          complexitySignal: 4,
        });

        expect(request).toEqual({
          ladderStage: "intention",
          agencyMode: "convergent",
          stopTrigger: true,
          stopPattern: "multiple-paths",
          complexitySignal: 4,
        });
      });
    });

    describe("stopPattern validation", () => {
      it("should accept valid kebab-case patterns", () => {
        const request = detector.createRequestWithMetadata({
          ladderStage: "meaning",
          agencyMode: "convergent",
          stopTrigger: true,
          stopPattern: "ambiguous-pronoun",
        });

        expect(request.stopPattern).toBe("ambiguous-pronoun");
      });

      it("should reject patterns with uppercase", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            stopPattern: "Ambiguous-Pronoun",
          });
        }).toThrow(/stopPattern must be kebab-case/);
      });

      it("should reject patterns with spaces", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            stopPattern: "ambiguous pronoun",
          });
        }).toThrow(/stopPattern must be kebab-case/);
      });

      it("should reject empty patterns", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            stopPattern: "",
          });
        }).toThrow(/stopPattern cannot be empty/);
      });

      it("should reject non-string patterns", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            stopPattern: 123 as any,
          });
        }).toThrow(/stopPattern must be a string/);
      });
    });

    describe("domain validation", () => {
      it("should accept valid kebab-case domains", () => {
        const request = detector.createRequestWithMetadata({
          ladderStage: "meaning",
          agencyMode: "convergent",
          stopTrigger: true,
          domain: "software-development",
        });

        expect(request.domain).toBe("software-development");
      });

      it("should reject domains with uppercase", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            domain: "Software-Development",
          });
        }).toThrow(/domain must be kebab-case/);
      });

      it("should reject empty domains", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            domain: "",
          });
        }).toThrow(/domain cannot be empty/);
      });

      it("should reject non-string domains", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            domain: 123 as any,
          });
        }).toThrow(/domain must be a string/);
      });
    });

    describe("complexitySignal validation", () => {
      it("should accept complexity values 1-5", () => {
        for (let i = 1; i <= 5; i++) {
          const request = detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            complexitySignal: i,
          });
          expect(request.complexitySignal).toBe(i);
        }
      });

      it("should reject complexity below 1", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            complexitySignal: 0,
          });
        }).toThrow(/complexitySignal must be between 1 and 5/);
      });

      it("should reject complexity above 5", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            complexitySignal: 6,
          });
        }).toThrow(/complexitySignal must be between 1 and 5/);
      });

      it("should reject non-integer complexity", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            complexitySignal: 3.5,
          });
        }).toThrow(/complexitySignal must be an integer/);
      });

      it("should reject non-number complexity", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            complexitySignal: "3" as any,
          });
        }).toThrow(/complexitySignal must be a number/);
      });
    });

    describe("sessionContext validation", () => {
      it("should accept valid session context", () => {
        const request = detector.createRequestWithMetadata({
          ladderStage: "meaning",
          agencyMode: "convergent",
          stopTrigger: true,
          sessionContext: {
            previousStops: 5,
            consecutiveStops: 2,
            averageResolutionTurns: 3.5,
          },
        });

        expect(request.sessionContext).toEqual({
          previousStops: 5,
          consecutiveStops: 2,
          averageResolutionTurns: 3.5,
        });
      });

      it("should reject negative previousStops", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            sessionContext: {
              previousStops: -1,
              consecutiveStops: 0,
              averageResolutionTurns: 2.0,
            },
          });
        }).toThrow(/previousStops must be a non-negative integer/);
      });

      it("should reject non-integer previousStops", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            sessionContext: {
              previousStops: 2.5,
              consecutiveStops: 0,
              averageResolutionTurns: 2.0,
            },
          });
        }).toThrow(/previousStops must be a non-negative integer/);
      });

      it("should reject negative consecutiveStops", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            sessionContext: {
              previousStops: 2,
              consecutiveStops: -1,
              averageResolutionTurns: 2.0,
            },
          });
        }).toThrow(/consecutiveStops must be a non-negative integer/);
      });

      it("should reject negative averageResolutionTurns", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            sessionContext: {
              previousStops: 2,
              consecutiveStops: 0,
              averageResolutionTurns: -1.5,
            },
          });
        }).toThrow(/averageResolutionTurns must be non-negative/);
      });

      it("should allow floating point averageResolutionTurns", () => {
        const request = detector.createRequestWithMetadata({
          ladderStage: "meaning",
          agencyMode: "convergent",
          stopTrigger: true,
          sessionContext: {
            previousStops: 3,
            consecutiveStops: 1,
            averageResolutionTurns: 2.5,
          },
        });

        expect(request.sessionContext?.averageResolutionTurns).toBe(2.5);
      });

      it("should reject non-object sessionContext", () => {
        expect(() => {
          detector.createRequestWithMetadata({
            ladderStage: "meaning",
            agencyMode: "convergent",
            stopTrigger: true,
            sessionContext: "invalid" as any,
          });
        }).toThrow(/sessionContext must be an object/);
      });
    });
  });
});
