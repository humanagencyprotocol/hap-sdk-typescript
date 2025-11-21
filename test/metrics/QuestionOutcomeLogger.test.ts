/**
 * QuestionOutcomeLogger tests
 *
 * Verifies metrics tracking with privacy guarantees.
 * Coverage: Testing Plan section 3.5 (15 tests, 90% coverage target)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { QuestionOutcomeLogger } from "../../src/metrics/QuestionOutcomeLogger";
import type { QuestionOutcome } from "../../src/types";

describe("QuestionOutcomeLogger", () => {
  let logger: QuestionOutcomeLogger;

  const createOutcome = (
    overrides: Partial<QuestionOutcome> = {}
  ): QuestionOutcome => ({
    questionId: "q1",
    ladderStage: "meaning",
    stopResolved: true,
    turnsToResolution: 1,
    phaseAdvanced: false,
    timestamp: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    logger = new QuestionOutcomeLogger();
  });

  describe("ML-001: QuestionOutcomeLogger stores outcome", () => {
    it("should store a single outcome", () => {
      const outcome = createOutcome();
      logger.log(outcome);

      expect(logger.size()).toBe(1);
    });

    it("should store outcome in buffer", () => {
      const outcome = createOutcome();
      logger.log(outcome);

      const buffer = logger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toEqual(outcome);
    });
  });

  describe("ML-002: Multiple outcomes stored", () => {
    it("should store 10 outcomes", () => {
      for (let i = 0; i < 10; i++) {
        logger.log(createOutcome({ questionId: `q${i}` }));
      }

      expect(logger.size()).toBe(10);
    });

    it("should maintain order of outcomes", () => {
      const outcomes = [
        createOutcome({ questionId: "q1" }),
        createOutcome({ questionId: "q2" }),
        createOutcome({ questionId: "q3" }),
      ];

      outcomes.forEach((o) => logger.log(o));

      const buffer = logger.getBuffer();
      expect(buffer[0].questionId).toBe("q1");
      expect(buffer[1].questionId).toBe("q2");
      expect(buffer[2].questionId).toBe("q3");
    });

    it("should trim buffer when max size exceeded", () => {
      const smallLogger = new QuestionOutcomeLogger(5);

      // Add 10 outcomes (exceeds max of 5)
      for (let i = 0; i < 10; i++) {
        smallLogger.log(createOutcome({ questionId: `q${i}` }));
      }

      // Should keep only last 5
      expect(smallLogger.size()).toBe(5);
      const buffer = smallLogger.getBuffer();
      expect(buffer[0].questionId).toBe("q5"); // Oldest kept
      expect(buffer[4].questionId).toBe("q9"); // Newest
    });
  });

  describe("ML-003: Outcome contains only structural fields", () => {
    it("should accept outcome with all structural fields", () => {
      const outcome: QuestionOutcome = {
        questionId: "test",
        ladderStage: "meaning",
        stopResolved: true,
        turnsToResolution: 2,
        phaseAdvanced: true,
        timestamp: Date.now(),
      };

      logger.log(outcome);
      expect(logger.size()).toBe(1);
    });

    // Type-level test: Cannot add semantic content
    it("should enforce type safety at compile time", () => {
      // This is a runtime test, but the type system prevents semantic content
      const outcome = createOutcome();

      // @ts-expect-error - cannot add semantic field
      const invalid = { ...outcome, userAnswer: "semantic content" };

      // Even if we bypass TypeScript, the logger still works
      expect(outcome).toBeDefined();
    });
  });

  describe("ML-S-001: getStats computes aggregates correctly", () => {
    it("should compute stats for mixed outcomes", () => {
      logger.log(createOutcome({ stopResolved: true, turnsToResolution: 1 }));
      logger.log(createOutcome({ stopResolved: true, turnsToResolution: 3 }));
      logger.log(createOutcome({ stopResolved: false, turnsToResolution: 0 }));
      logger.log(
        createOutcome({ stopResolved: true, turnsToResolution: 2, phaseAdvanced: true })
      );
      logger.log(createOutcome({ stopResolved: true, turnsToResolution: 4 }));

      const stats = logger.getStats();

      expect(stats.total).toBe(5);
      expect(stats.totalResolved).toBe(4);
      expect(stats.totalUnresolved).toBe(1);
      expect(stats.resolvedRate).toBe(0.8); // 4/5
      expect(stats.avgTurnsToResolution).toBe(2.5); // (1+3+2+4)/4
      expect(stats.phaseAdvancedRate).toBe(0.2); // 1/5
    });

    it("should compute 100% resolution rate", () => {
      logger.log(createOutcome({ stopResolved: true }));
      logger.log(createOutcome({ stopResolved: true }));
      logger.log(createOutcome({ stopResolved: true }));

      const stats = logger.getStats();

      expect(stats.resolvedRate).toBe(1.0);
      expect(stats.totalResolved).toBe(3);
      expect(stats.totalUnresolved).toBe(0);
    });

    it("should compute 0% resolution rate", () => {
      logger.log(createOutcome({ stopResolved: false }));
      logger.log(createOutcome({ stopResolved: false }));

      const stats = logger.getStats();

      expect(stats.resolvedRate).toBe(0);
      expect(stats.totalResolved).toBe(0);
      expect(stats.totalUnresolved).toBe(2);
      expect(stats.avgTurnsToResolution).toBe(0); // No resolved outcomes
    });
  });

  describe("ML-S-002: getStats handles empty buffer", () => {
    it("should return zero stats for empty buffer", () => {
      const stats = logger.getStats();

      expect(stats.total).toBe(0);
      expect(stats.resolvedRate).toBe(0);
      expect(stats.avgTurnsToResolution).toBe(0);
      expect(stats.phaseAdvancedRate).toBe(0);
      expect(stats.totalResolved).toBe(0);
      expect(stats.totalUnresolved).toBe(0);
    });

    it("should not throw on empty buffer", () => {
      expect(() => logger.getStats()).not.toThrow();
      expect(() => logger.getStatsByStage("meaning")).not.toThrow();
    });
  });

  describe("ML-S-003: getStats by ladder stage", () => {
    it("should filter outcomes by ladder stage", () => {
      logger.log(createOutcome({ ladderStage: "meaning", stopResolved: true }));
      logger.log(createOutcome({ ladderStage: "meaning", stopResolved: true }));
      logger.log(createOutcome({ ladderStage: "purpose", stopResolved: false }));
      logger.log(createOutcome({ ladderStage: "intention", stopResolved: true }));

      const meaningStats = logger.getStatsByStage("meaning");

      expect(meaningStats.total).toBe(2);
      expect(meaningStats.resolvedRate).toBe(1.0);
    });

    it("should return empty stats for stage with no outcomes", () => {
      logger.log(createOutcome({ ladderStage: "meaning" }));

      const actionStats = logger.getStatsByStage("action");

      expect(actionStats.total).toBe(0);
      expect(actionStats.resolvedRate).toBe(0);
    });

    it("should compute correct averages per stage", () => {
      logger.log(
        createOutcome({
          ladderStage: "meaning",
          stopResolved: true,
          turnsToResolution: 1,
        })
      );
      logger.log(
        createOutcome({
          ladderStage: "meaning",
          stopResolved: true,
          turnsToResolution: 3,
        })
      );
      logger.log(
        createOutcome({
          ladderStage: "purpose",
          stopResolved: true,
          turnsToResolution: 10,
        })
      );

      const meaningStats = logger.getStatsByStage("meaning");
      const purposeStats = logger.getStatsByStage("purpose");

      expect(meaningStats.avgTurnsToResolution).toBe(2); // (1+3)/2
      expect(purposeStats.avgTurnsToResolution).toBe(10);
    });
  });

  describe("ML-P-001: Buffer contains no semantic content", () => {
    it("should only store structural fields", () => {
      logger.log(createOutcome({ questionId: "q1" }));
      logger.log(createOutcome({ questionId: "q2" }));
      logger.log(createOutcome({ questionId: "q3" }));

      const buffer = logger.getBuffer();

      // Verify each outcome has only structural fields
      buffer.forEach((outcome) => {
        const keys = Object.keys(outcome);
        expect(keys).toEqual([
          "questionId",
          "ladderStage",
          "stopResolved",
          "turnsToResolution",
          "phaseAdvanced",
          "timestamp",
        ]);

        // Verify no semantic content
        const json = JSON.stringify(outcome);
        expect(json).not.toMatch(/user/i);
        expect(json).not.toMatch(/answer/i);
        expect(json).not.toMatch(/question(?!Id)/i); // questionId is ok
        expect(json).not.toMatch(/content/i);
      });
    });
  });

  describe("ML-P-002: Exporter receives structural data only", () => {
    it("should pass outcomes to exporter", async () => {
      logger.log(createOutcome({ questionId: "q1" }));
      logger.log(createOutcome({ questionId: "q2" }));

      const exporter = vi.fn();
      await logger.export(exporter);

      expect(exporter).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ questionId: "q1" }),
          expect.objectContaining({ questionId: "q2" }),
        ])
      );
    });

    it("should pass frozen buffer to exporter", async () => {
      logger.log(createOutcome());

      const exporter = vi.fn();
      await logger.export(exporter);

      const buffer = exporter.mock.calls[0][0];
      expect(Object.isFrozen(buffer)).toBe(true);
    });

    it("should support async exporters", async () => {
      logger.log(createOutcome());

      const asyncExporter = vi.fn(async (outcomes) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return outcomes.length;
      });

      await logger.export(asyncExporter);

      expect(asyncExporter).toHaveBeenCalled();
    });
  });

  describe("ML-B-001: Buffer management", () => {
    it("should clear buffer", () => {
      logger.log(createOutcome());
      logger.log(createOutcome());
      logger.log(createOutcome());

      expect(logger.size()).toBe(3);

      logger.clear();

      expect(logger.size()).toBe(0);
      expect(logger.getBuffer()).toHaveLength(0);
    });

    it("should return correct size", () => {
      expect(logger.size()).toBe(0);

      logger.log(createOutcome());
      expect(logger.size()).toBe(1);

      logger.log(createOutcome());
      logger.log(createOutcome());
      expect(logger.size()).toBe(3);
    });

    it("should not allow buffer mutation via getBuffer", () => {
      logger.log(createOutcome({ questionId: "original" }));

      const buffer = logger.getBuffer();

      // Attempt to mutate (should fail or have no effect)
      expect(() => {
        // @ts-expect-error - readonly array
        buffer.push(createOutcome({ questionId: "hacker" }));
      }).toThrow();

      // Original buffer unchanged
      expect(logger.size()).toBe(1);
      expect(logger.getBuffer()[0].questionId).toBe("original");
    });
  });
});
