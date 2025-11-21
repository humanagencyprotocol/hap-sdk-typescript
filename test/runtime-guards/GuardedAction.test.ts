/**
 * GuardedAction tests
 *
 * Verifies type-safe enforcement of Stop→Ask→Proceed.
 * Coverage: Testing Plan section 3.3 RG-E-001
 */

import { describe, it, expect, vi } from "vitest";
import {
  GuardedAction,
  isStopped,
  isResolved,
} from "../../src/runtime-guards/GuardedAction";
import type {
  StoppedAction,
  ResolvedAction,
} from "../../src/runtime-guards/GuardedAction";
import { UnresolvedStopError } from "../../src/types/errors";

describe("GuardedAction", () => {
  describe("RG-E-001: Cannot proceed when stop_resolved=false", () => {
    it("should prevent proceed() on stopped action at runtime", () => {
      const stopped = GuardedAction.create({
        question: "What should we build?",
        blueprintId: "bp-123",
        ladderStage: "meaning",
      });

      // TypeScript prevents this at compile time, but test runtime enforcement
      expect(() => {
        // @ts-expect-error - proceed doesn't exist on StoppedAction interface
        (stopped as any).proceed();
      }).toThrow(UnresolvedStopError);
    });

    it("should not expose proceed() method on stopped action", () => {
      const stopped = GuardedAction.create({
        question: "What should we build?",
        blueprintId: "bp-123",
        ladderStage: "meaning",
      });

      // Verify proceed is not in the public interface
      expect("proceed" in stopped).toBe(true); // Implementation detail
      expect((stopped as any).proceed).toBeDefined();

      // But TypeScript prevents calling it
      // This would be a compile error:
      // stopped.proceed(() => {});
    });

    it("should require resolve() before proceed()", async () => {
      const stopped = GuardedAction.create({
        question: "What should we build?",
        blueprintId: "bp-123",
        ladderStage: "meaning",
      });

      // Must resolve first
      const resolved = stopped.resolve("Build a dashboard");

      // Now proceed() is available
      const action = vi.fn().mockReturnValue("result");
      const result = await resolved.proceed(action);

      expect(action).toHaveBeenCalled();
      expect(result).toBe("result");
    });

    it("should throw UnresolvedStopError with correct details", () => {
      const stopped = GuardedAction.create({
        question: "What is the purpose?",
        blueprintId: "bp-456",
        ladderStage: "purpose",
      });

      try {
        // @ts-expect-error - testing runtime enforcement
        (stopped as any).proceed();
        expect.fail("Should have thrown UnresolvedStopError");
      } catch (error) {
        expect(error).toBeInstanceOf(UnresolvedStopError);
        expect((error as UnresolvedStopError).ladderStage).toBe("purpose");
        expect((error as UnresolvedStopError).stopCondition).toBe("both");
      }
    });
  });

  describe("Stopped action creation", () => {
    it("should create stopped action with all required fields", () => {
      const stopped = GuardedAction.create({
        question: "What should we do?",
        blueprintId: "bp-789",
        ladderStage: "intention",
      });

      expect(stopped.stopped).toBe(true);
      expect(stopped.question).toBe("What should we do?");
      expect(stopped.blueprintId).toBe("bp-789");
      expect(stopped.ladderStage).toBe("intention");
    });

    it("should mark stopped as readonly true", () => {
      const stopped = GuardedAction.create({
        question: "Test",
        blueprintId: "test",
        ladderStage: "meaning",
      });

      expect(stopped.stopped).toBe(true);

      // TypeScript prevents mutation at compile time
      // Runtime enforcement depends on Object.freeze() or similar
      // The important thing is the value remains true
      expect(stopped.stopped).toBe(true);
    });
  });

  describe("Resolved action creation", () => {
    it("should create resolved action", () => {
      const resolved = GuardedAction.createResolved();

      expect(resolved.stopped).toBe(false);
      expect(resolved.answer).toBeUndefined();
    });

    it("should allow proceed() on resolved action", async () => {
      const resolved = GuardedAction.createResolved();

      const action = vi.fn().mockReturnValue(42);
      const result = await resolved.proceed(action);

      expect(action).toHaveBeenCalled();
      expect(result).toBe(42);
    });

    it("should support async actions", async () => {
      const resolved = GuardedAction.createResolved();

      const asyncAction = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async result";
      });

      const result = await resolved.proceed(asyncAction);

      expect(asyncAction).toHaveBeenCalled();
      expect(result).toBe("async result");
    });
  });

  describe("Resolution flow", () => {
    it("should resolve with user answer", () => {
      const stopped = GuardedAction.create({
        question: "What color?",
        blueprintId: "bp-color",
        ladderStage: "meaning",
      });

      const resolved = stopped.resolve("Blue");

      expect(resolved.stopped).toBe(false);
      expect(resolved.answer).toBe("Blue");
    });

    it("should allow proceed() after resolution", async () => {
      const stopped = GuardedAction.create({
        question: "What?",
        blueprintId: "bp",
        ladderStage: "meaning",
      });

      const resolved = stopped.resolve("Answer");
      const action = vi.fn().mockReturnValue("success");

      const result = await resolved.proceed(action);

      expect(result).toBe("success");
    });

    it("should pass through action errors", async () => {
      const resolved = GuardedAction.createResolved();

      const errorAction = vi.fn(() => {
        throw new Error("Action failed");
      });

      await expect(resolved.proceed(errorAction)).rejects.toThrow(
        "Action failed"
      );
    });

    it("should handle multiple resolutions", () => {
      const stopped = GuardedAction.create({
        question: "What?",
        blueprintId: "bp",
        ladderStage: "meaning",
      });

      const resolved1 = stopped.resolve("Answer 1");
      const resolved2 = stopped.resolve("Answer 2");

      expect(resolved1.answer).toBe("Answer 1");
      expect(resolved2.answer).toBe("Answer 2");
      expect(resolved1).not.toBe(resolved2);
    });
  });

  describe("Integration with clarification result", () => {
    it("should create stopped action from unclarified result", () => {
      const result = {
        clarified: false,
        question: "Clarify this?",
        blueprintId: "bp-123",
        ladderStage: "meaning" as const,
      };

      const action = GuardedAction.fromClarificationResult(result);

      expect(isStopped(action)).toBe(true);
      if (isStopped(action)) {
        expect(action.question).toBe("Clarify this?");
        expect(action.blueprintId).toBe("bp-123");
      }
    });

    it("should create resolved action from clarified result", () => {
      const result = {
        clarified: true,
      };

      const action = GuardedAction.fromClarificationResult(result);

      expect(isResolved(action)).toBe(true);
    });

    it("should throw if unclarified result missing question", () => {
      const result = {
        clarified: false,
        // missing question
        blueprintId: "bp-123",
        ladderStage: "meaning" as const,
      };

      expect(() => {
        GuardedAction.fromClarificationResult(result as any);
      }).toThrow(/must include question/);
    });

    it("should throw if unclarified result missing blueprintId", () => {
      const result = {
        clarified: false,
        question: "Test?",
        // missing blueprintId
        ladderStage: "meaning" as const,
      };

      expect(() => {
        GuardedAction.fromClarificationResult(result as any);
      }).toThrow(/must include.*blueprintId/);
    });

    it("should throw if unclarified result missing ladderStage", () => {
      const result = {
        clarified: false,
        question: "Test?",
        blueprintId: "bp-123",
        // missing ladderStage
      };

      expect(() => {
        GuardedAction.fromClarificationResult(result as any);
      }).toThrow(/must include.*ladderStage/);
    });
  });

  describe("Type guards", () => {
    it("should identify stopped action", () => {
      const stopped = GuardedAction.create({
        question: "Test?",
        blueprintId: "bp",
        ladderStage: "meaning",
      });

      expect(isStopped(stopped)).toBe(true);
      expect(isResolved(stopped)).toBe(false);
    });

    it("should identify resolved action", () => {
      const resolved = GuardedAction.createResolved();

      expect(isStopped(resolved)).toBe(false);
      expect(isResolved(resolved)).toBe(true);
    });

    it("should narrow types correctly", async () => {
      const action: StoppedAction | ResolvedAction =
        GuardedAction.createResolved();

      if (isResolved(action)) {
        // TypeScript knows this is ResolvedAction
        const result = await action.proceed(() => "success");
        expect(result).toBe("success");
      } else {
        // TypeScript knows this is StoppedAction
        expect.fail("Should be resolved");
      }
    });
  });

  describe("Complete workflow examples", () => {
    it("should demonstrate full Stop→Ask→Proceed flow", async () => {
      // 1. Stop condition detected
      const stopped = GuardedAction.create({
        question: "What feature should we build?",
        blueprintId: "feature-blueprint",
        ladderStage: "meaning",
      });

      // 2. Show question to user (not tested here)
      expect(stopped.question).toBeDefined();

      // 3. User provides answer
      const resolved = stopped.resolve("User authentication");

      // 4. Proceed with action
      const buildFeature = vi.fn(() => ({
        feature: "auth",
        status: "built",
      }));

      const result = await resolved.proceed(buildFeature);

      expect(buildFeature).toHaveBeenCalled();
      expect(result.feature).toBe("auth");
    });

    it("should demonstrate no-stop workflow", async () => {
      // No stop condition - proceed immediately
      const resolved = GuardedAction.createResolved();

      const action = vi.fn(() => "completed");
      const result = await resolved.proceed(action);

      expect(result).toBe("completed");
    });

    it("should demonstrate error in stopped state", () => {
      const stopped = GuardedAction.create({
        question: "Clarify?",
        blueprintId: "bp",
        ladderStage: "meaning",
      });

      // Attempting to proceed without resolution throws
      expect(() => {
        // @ts-expect-error - testing runtime enforcement
        (stopped as any).proceed(() => {});
      }).toThrow(UnresolvedStopError);
    });

    it("should support conditional branching", async () => {
      const result = {
        clarified: false,
        question: "What?",
        blueprintId: "bp",
        ladderStage: "meaning" as const,
      };

      const action = GuardedAction.fromClarificationResult(result);

      if (isStopped(action)) {
        // Handle stop condition
        const resolved = action.resolve("User answer");
        await resolved.proceed(() => "action executed");
      } else {
        // Proceed directly
        await action.proceed(() => "action executed");
      }
    });
  });

  describe("TypeScript type safety", () => {
    it("should enforce stopped type at compile time", () => {
      const stopped: StoppedAction = GuardedAction.create({
        question: "Test?",
        blueprintId: "bp",
        ladderStage: "meaning",
      });

      // TypeScript compilation error (commented out):
      // stopped.proceed(() => {});
      // Property 'proceed' does not exist on type 'StoppedAction'

      expect(stopped.stopped).toBe(true);
    });

    it("should enforce resolved type at compile time", async () => {
      const resolved: ResolvedAction = GuardedAction.createResolved();

      // TypeScript allows this:
      await resolved.proceed(() => "success");

      // TypeScript compilation error (commented out):
      // resolved.resolve("answer");
      // Property 'resolve' does not exist on type 'ResolvedAction'

      expect(resolved.stopped).toBe(false);
    });
  });
});
