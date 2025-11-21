/**
 * StopGuard tests
 *
 * Verifies Stop→Ask→Proceed enforcement with complete coverage.
 * Coverage: Testing Plan section 3.3 (20 tests, 100% coverage target)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { StopGuard } from "../../src/runtime-guards/StopGuard";
import type { StopGuardMiddleware } from "../../src/runtime-guards/StopGuard";
import { HapClient } from "../../src/hap-client/HapClient";
import type {
  InquiryRequest,
  InquiryBlueprint,
  QuestionEngine,
  QuestionSpec,
} from "../../src/types";
import { ValidationError } from "../../src/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock Question Engine
class MockQuestionEngine implements QuestionEngine {
  async generateQuestion(
    context: unknown,
    spec: QuestionSpec
  ): Promise<string> {
    return `Question about ${spec.ladderStage} for ${spec.stopCondition}`;
  }
}

// Mock Question Engine that throws
class ErrorQuestionEngine implements QuestionEngine {
  async generateQuestion(): Promise<string> {
    throw new Error("Question generation failed");
  }
}

describe("StopGuard", () => {
  let provider: HapClient;
  let questionEngine: QuestionEngine;
  let stopGuard: StopGuard;

  const validBlueprint: InquiryBlueprint = {
    id: "test-blueprint-01",
    intent: "clarify meaning",
    ladderStage: "meaning",
    agencyMode: "convergent",
    targetStructures: ["object_of_discussion"],
    constraints: {
      tone: "facilitative",
      addressing: "individual",
    },
    renderHint: "ask for clarification",
    examples: ["What are we discussing?"],
    stopCondition: "meaning",
  };

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new HapClient({
      endpoint: "https://api.test.com",
      apiKey: "test-key",
    });
    questionEngine = new MockQuestionEngine();
    stopGuard = new StopGuard({ provider, questionEngine });
  });

  describe("RG-001: ensureClarified requests blueprint when stop triggered", () => {
    it("should request blueprint when stopTrigger is true", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const context = { userInput: "plan the project" };
      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await stopGuard.ensureClarified(context, request);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/v1/inquiry/blueprints",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should return clarified=false with question", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      const result = await stopGuard.ensureClarified({}, request);

      expect(result.clarified).toBe(false);
      expect(result.question).toBeDefined();
      expect(result.question).toContain("meaning");
    });

    it("should return blueprintId for feedback correlation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      const result = await stopGuard.ensureClarified({}, request);

      expect(result.blueprintId).toBe("test-blueprint-01");
    });
  });

  describe("RG-002: ensureClarified skips when no stop triggered", () => {
    it("should return clarified=true when stopTrigger is false", async () => {
      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: false,
      };

      const result = await stopGuard.ensureClarified({}, request);

      expect(result.clarified).toBe(true);
      expect(result.question).toBeUndefined();
      expect(result.blueprintId).toBeUndefined();
    });

    it("should not make blueprint request when stop not triggered", async () => {
      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: false,
      };

      await stopGuard.ensureClarified({}, request);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not invoke Question Engine when stop not triggered", async () => {
      const spyEngine = vi.spyOn(questionEngine, "generateQuestion");

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: false,
      };

      await stopGuard.ensureClarified({}, request);

      expect(spyEngine).not.toHaveBeenCalled();
    });
  });

  describe("RG-003: Question generation receives correct spec", () => {
    it("should pass correct QuestionSpec to Question Engine", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const spyEngine = vi.spyOn(questionEngine, "generateQuestion");

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await stopGuard.ensureClarified({}, request);

      expect(spyEngine).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          ladderStage: "meaning",
          tone: "facilitative",
          addressing: "individual",
          stopCondition: "meaning",
          targetStructures: ["object_of_discussion"],
        })
      );
    });

    it("should pass context to Question Engine (used locally)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const spyEngine = vi.spyOn(questionEngine, "generateQuestion");
      const context = { userInput: "test input", taskId: "task-123" };

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await stopGuard.ensureClarified(context, request);

      expect(spyEngine).toHaveBeenCalledWith(context, expect.any(Object));
    });
  });

  describe("RG-004: Context never sent to HAP", () => {
    it("should only send structural request, not context", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const context = {
        userInput: "SEMANTIC_CONTENT_THAT_SHOULD_NOT_BE_SENT",
        privateData: "secret-123",
      };

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await stopGuard.ensureClarified(context, request);

      // Verify request body does NOT contain context
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody).toEqual(request);
      expect(JSON.stringify(requestBody)).not.toContain("SEMANTIC_CONTENT");
      expect(JSON.stringify(requestBody)).not.toContain("secret-123");
    });
  });

  describe("RG-E-002: Middleware captures guard invocations", () => {
    it("should invoke onStopDetected middleware", async () => {
      const middleware: StopGuardMiddleware = {
        onStopDetected: vi.fn(),
      };

      const guardWithMiddleware = new StopGuard({
        provider,
        questionEngine,
        middleware: [middleware],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await guardWithMiddleware.ensureClarified({}, request);

      expect(middleware.onStopDetected).toHaveBeenCalledWith(request);
    });

    it("should invoke onBlueprintReceived middleware", async () => {
      const middleware: StopGuardMiddleware = {
        onBlueprintReceived: vi.fn(),
      };

      const guardWithMiddleware = new StopGuard({
        provider,
        questionEngine,
        middleware: [middleware],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await guardWithMiddleware.ensureClarified({}, request);

      expect(middleware.onBlueprintReceived).toHaveBeenCalledWith(
        validBlueprint
      );
    });

    it("should invoke onQuestionGenerated middleware", async () => {
      const middleware: StopGuardMiddleware = {
        onQuestionGenerated: vi.fn(),
      };

      const guardWithMiddleware = new StopGuard({
        provider,
        questionEngine,
        middleware: [middleware],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await guardWithMiddleware.ensureClarified({}, request);

      expect(middleware.onQuestionGenerated).toHaveBeenCalledWith(
        "test-blueprint-01",
        expect.objectContaining({ ladderStage: "meaning" })
      );
    });

    it("should invoke onClarificationSkipped when stop not triggered", async () => {
      const middleware: StopGuardMiddleware = {
        onClarificationSkipped: vi.fn(),
      };

      const guardWithMiddleware = new StopGuard({
        provider,
        questionEngine,
        middleware: [middleware],
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: false,
      };

      await guardWithMiddleware.ensureClarified({}, request);

      expect(middleware.onClarificationSkipped).toHaveBeenCalled();
    });

    it("should handle middleware errors gracefully", async () => {
      const middleware: StopGuardMiddleware = {
        onStopDetected: () => {
          throw new Error("Middleware error");
        },
        onBlueprintReceived: vi.fn(),
      };

      const guardWithMiddleware = new StopGuard({
        provider,
        questionEngine,
        middleware: [middleware],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      // Should not throw despite middleware error
      const result = await guardWithMiddleware.ensureClarified({}, request);

      expect(result.clarified).toBe(false);
      expect(middleware.onBlueprintReceived).toHaveBeenCalled();
    });
  });

  describe("RG-E-004: Multiple stops in sequence handled correctly", () => {
    it("should handle two stops in sequence", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => validBlueprint,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...validBlueprint,
            id: "test-blueprint-02",
          }),
        });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      // First stop
      const result1 = await stopGuard.ensureClarified({}, request);
      expect(result1.clarified).toBe(false);
      expect(result1.blueprintId).toBe("test-blueprint-01");

      // Second stop
      const result2 = await stopGuard.ensureClarified({}, request);
      expect(result2.clarified).toBe(false);
      expect(result2.blueprintId).toBe("test-blueprint-02");

      // Both requests should have been made
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle alternating stop and proceed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      // Stop
      const result1 = await stopGuard.ensureClarified(
        {},
        { ladderStage: "meaning", agencyMode: "convergent", stopTrigger: true }
      );
      expect(result1.clarified).toBe(false);

      // Proceed (no stop)
      const result2 = await stopGuard.ensureClarified(
        {},
        { ladderStage: "purpose", agencyMode: "convergent", stopTrigger: false }
      );
      expect(result2.clarified).toBe(true);

      // Only one blueprint request (first stop)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("RG-X-001: QuestionEngine throws error", () => {
    it("should propagate Question Engine errors", async () => {
      const errorEngine = new ErrorQuestionEngine();
      const guardWithErrorEngine = new StopGuard({
        provider,
        questionEngine: errorEngine,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await expect(
        guardWithErrorEngine.ensureClarified({}, request)
      ).rejects.toThrow("Question generation failed");
    });
  });

  describe("RG-X-002: Blueprint request fails", () => {
    it("should propagate network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await expect(stopGuard.ensureClarified({}, request)).rejects.toThrow();
    });

    it("should propagate validation errors for invalid blueprint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "invalid",
          // missing required fields
        }),
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await expect(stopGuard.ensureClarified({}, request)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("RG-X-003: Concurrent stop conditions", () => {
    it("should handle concurrent stops without race conditions", async () => {
      // Mock service to respond with different blueprints for each call
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...validBlueprint, id: "blueprint-1" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...validBlueprint, id: "blueprint-2" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...validBlueprint, id: "blueprint-3" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...validBlueprint, id: "blueprint-4" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...validBlueprint, id: "blueprint-5" }),
        });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      // Trigger 5 concurrent stops
      const promises = Array.from({ length: 5 }, () =>
        stopGuard.ensureClarified({}, request)
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.clarified).toBe(false);
        expect(result.question).toBeDefined();
        expect(result.blueprintId).toBeDefined();
      });

      // All should have unique blueprint IDs
      const blueprintIds = results.map((r) => r.blueprintId);
      const uniqueIds = new Set(blueprintIds);
      expect(uniqueIds.size).toBe(5);

      // Verify all 5 requests were made
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe("RG-M-001: Dynamic middleware management", () => {
    it("should allow adding middleware dynamically", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const middleware: StopGuardMiddleware = {
        onStopDetected: vi.fn(),
      };

      stopGuard.addMiddleware(middleware);

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await stopGuard.ensureClarified({}, request);

      expect(middleware.onStopDetected).toHaveBeenCalled();
    });

    it("should allow removing middleware", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const middleware: StopGuardMiddleware = {
        onStopDetected: vi.fn(),
      };

      stopGuard.addMiddleware(middleware);
      stopGuard.removeMiddleware(middleware);

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await stopGuard.ensureClarified({}, request);

      expect(middleware.onStopDetected).not.toHaveBeenCalled();
    });
  });
});
