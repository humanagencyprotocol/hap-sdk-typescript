/**
 * E2E Tests for Examples
 *
 * Verifies that example integration code runs without errors.
 * Coverage: Testing Plan section 6 (E2E-001, E2E-002)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  HapClient,
  StopGuard,
  StopDetector,
  QuestionOutcomeLogger,
} from "../../src/index";
import type { QuestionEngine, QuestionSpec, InquiryBlueprint } from "../../src/types";

// Mock fetch for all E2E tests
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("E2E Tests - Example Integrations", () => {
  const validBlueprint: InquiryBlueprint = {
    id: "e2e-blueprint-01",
    intent: "clarify meaning",
    ladderStage: "meaning",
    agencyMode: "convergent",
    targetStructures: ["object_of_discussion"],
    constraints: {
      tone: "facilitative",
      addressing: "individual",
    },
    renderHint: "ask for clarification",
    examples: ["What do you mean?"],
    stopCondition: "meaning",
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("E2E-001: Basic Node.js Example Flow", () => {
    it("should complete full Stop→Ask→Proceed flow", async () => {
      // Setup: Mock HAP Service
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      // 1. Initialize components (as in basic-nodejs.ts)
      const hapClient = new HapClient({
        endpoint: "https://api.test.com",
        apiKey: "test-key",
      });

      const questionEngine: QuestionEngine = {
        async generateQuestion(context: unknown, spec: QuestionSpec) {
          const ctx = context as any;
          return `What do you mean by "${ctx.userInput}"?`;
        },
      };

      const stopGuard = new StopGuard({
        client: hapClient,
        questionEngine,
      });

      const detector = new StopDetector();
      const metrics = new QuestionOutcomeLogger();

      // 2. Simulate user input
      const userInput = "maybe we should build something";
      const context = {
        userInput,
        ambiguous: true,
        timestamp: Date.now(),
      };

      // 3. Create inquiry request
      const inquiryRequest = detector.createRequest({
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true, // Ambiguous input triggers stop
      });

      expect(inquiryRequest.stopTrigger).toBe(true);

      // 4. Stop→Ask→Proceed enforcement
      const result = await stopGuard.ensureClarified(context, inquiryRequest);

      // Assert: Stop condition triggered
      expect(result.clarified).toBe(false);
      expect(result.question).toBeDefined();
      expect(result.blueprintId).toBe("e2e-blueprint-01");

      // 5. Simulate user answer
      const userAnswer = "I want to build a dashboard";
      const updatedContext = {
        ...context,
        clarification: userAnswer,
      };

      // 6. Log outcome
      metrics.log({
        questionId: result.blueprintId!,
        ladderStage: "meaning",
        stopResolved: true,
        turnsToResolution: 1,
        phaseAdvanced: true,
        timestamp: Date.now(),
      });

      // 7. Verify metrics
      const stats = metrics.getStats();
      expect(stats.total).toBe(1);
      expect(stats.resolvedRate).toBe(1.0);
      expect(stats.avgTurnsToResolution).toBe(1);

      // 8. Send feedback (mock)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await hapClient.sendFeedback({
        blueprintId: result.blueprintId!,
        patternId: "basic-clarification",
        agencyMode: "convergent",
        stopResolved: true,
      });

      // Assert: All steps completed without errors
      expect(mockFetch).toHaveBeenCalledTimes(2); // Blueprint + Feedback
    });

    it("should handle no-stop scenario", async () => {
      // Setup
      const hapClient = new HapClient({
        endpoint: "https://api.test.com",
        apiKey: "test-key",
      });

      const questionEngine: QuestionEngine = {
        async generateQuestion() {
          return "Clarification question";
        },
      };

      const stopGuard = new StopGuard({
        client: hapClient,
        questionEngine,
      });

      const detector = new StopDetector();

      // Clear input (no ambiguity)
      const context = {
        userInput: "create a report",
        ambiguous: false,
      };

      const inquiryRequest = detector.createRequest({
        ladderStage: "action",
        agencyMode: "convergent",
        stopTrigger: false, // Clear input, no stop
      });

      // No HAP call should be made
      const result = await stopGuard.ensureClarified(context, inquiryRequest);

      // Assert: Proceed directly
      expect(result.clarified).toBe(true);
      expect(result.question).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle multiple stops in sequence", async () => {
      // Setup
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...validBlueprint, id: "blueprint-1" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...validBlueprint, id: "blueprint-2" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      const hapClient = new HapClient({
        endpoint: "https://api.test.com",
        apiKey: "test-key",
      });

      const questionEngine: QuestionEngine = {
        async generateQuestion() {
          return "Question";
        },
      };

      const stopGuard = new StopGuard({
        client: hapClient,
        questionEngine,
      });

      const detector = new StopDetector();
      const metrics = new QuestionOutcomeLogger();

      // First stop
      const request1 = detector.createRequest({
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      });

      const result1 = await stopGuard.ensureClarified({}, request1);
      expect(result1.clarified).toBe(false);

      metrics.log({
        questionId: result1.blueprintId!,
        ladderStage: "meaning",
        stopResolved: true,
        turnsToResolution: 1,
        phaseAdvanced: true,
        timestamp: Date.now(),
      });

      await hapClient.sendFeedback({
        blueprintId: result1.blueprintId!,
        patternId: "test",
        agencyMode: "convergent",
        stopResolved: true,
      });

      // Second stop
      const request2 = detector.createRequest({
        ladderStage: "purpose",
        agencyMode: "convergent",
        stopTrigger: true,
      });

      const result2 = await stopGuard.ensureClarified({}, request2);
      expect(result2.clarified).toBe(false);

      metrics.log({
        questionId: result2.blueprintId!,
        ladderStage: "purpose",
        stopResolved: true,
        turnsToResolution: 1,
        phaseAdvanced: false,
        timestamp: Date.now(),
      });

      await hapClient.sendFeedback({
        blueprintId: result2.blueprintId!,
        patternId: "test",
        agencyMode: "convergent",
        stopResolved: true,
      });

      // Assert: Both stops handled
      const stats = metrics.getStats();
      expect(stats.total).toBe(2);
      expect(stats.resolvedRate).toBe(1.0);
      expect(mockFetch).toHaveBeenCalledTimes(4); // 2 blueprints + 2 feedbacks
    });
  });

  describe("E2E-002: Next.js API Route Flow", () => {
    it("should handle API request with stop condition", async () => {
      // Setup: Mock HAP Service
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      // 1. Initialize (as in nextjs-api-route.ts)
      const hapClient = new HapClient({
        endpoint: "https://api.test.com",
        apiKey: "test-key",
      });

      const questionEngine: QuestionEngine = {
        async generateQuestion(context: unknown, spec: QuestionSpec) {
          const ctx = context as any;
          return `Could you clarify "${ctx.message}"? (${spec.ladderStage})`;
        },
      };

      const stopGuard = new StopGuard({
        client: hapClient,
        questionEngine,
      });

      const detector = new StopDetector();

      // 2. Simulate API request
      const requestBody = {
        message: "maybe help me with something",
        sessionId: "user-123",
      };

      // 3. Detect ambiguity
      const isAmbiguous = requestBody.message.includes("maybe");
      expect(isAmbiguous).toBe(true);

      // 4. Create context
      const context = {
        message: requestBody.message,
        sessionId: requestBody.sessionId,
        timestamp: Date.now(),
      };

      // 5. Create inquiry request
      const inquiryRequest = detector.createRequest({
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: isAmbiguous,
      });

      // 6. Check clarification
      const result = await stopGuard.ensureClarified(context, inquiryRequest);

      // 7. Build API response
      const apiResponse = {
        type: "question" as const,
        question: {
          text: result.question!,
          blueprintId: result.blueprintId!,
        },
      };

      // Assert: Question returned
      expect(apiResponse.type).toBe("question");
      expect(apiResponse.question.text).toContain("maybe help me");
      expect(apiResponse.question.blueprintId).toBe("e2e-blueprint-01");
    });

    it("should handle clarification response", async () => {
      // Setup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const hapClient = new HapClient({
        endpoint: "https://api.test.com",
        apiKey: "test-key",
      });

      const metrics = new QuestionOutcomeLogger();

      // Simulate clarification request
      const requestBody = {
        message: "help me with something",
        sessionId: "user-123",
        clarification: {
          blueprintId: "bp-123",
          answer: "I want to create a dashboard",
        },
      };

      // Log outcome
      metrics.log({
        questionId: requestBody.clarification.blueprintId,
        ladderStage: "meaning",
        stopResolved: true,
        turnsToResolution: 1,
        phaseAdvanced: true,
        timestamp: Date.now(),
      });

      // Send feedback
      await hapClient.sendFeedback({
        blueprintId: requestBody.clarification.blueprintId,
        patternId: "api-clarification",
        agencyMode: "convergent",
        stopResolved: true,
      });

      // Build response
      const apiResponse = {
        type: "answer" as const,
        message: `Based on "${requestBody.clarification.answer}", I'll proceed.`,
      };

      // Assert: Answer returned
      expect(apiResponse.type).toBe("answer");
      expect(apiResponse.message).toContain("dashboard");
      expect(mockFetch).toHaveBeenCalledTimes(1); // Feedback
    });

    it("should handle direct proceed (no stop)", async () => {
      const questionEngine: QuestionEngine = {
        async generateQuestion() {
          return "Question";
        },
      };

      const hapClient = new HapClient({
        endpoint: "https://api.test.com",
        apiKey: "test-key",
      });

      const stopGuard = new StopGuard({
        client: hapClient,
        questionEngine,
      });

      const detector = new StopDetector();

      // Clear request
      const requestBody = {
        message: "create a report",
        sessionId: "user-123",
      };

      const context = {
        message: requestBody.message,
        sessionId: requestBody.sessionId,
      };

      const inquiryRequest = detector.createRequest({
        ladderStage: "action",
        agencyMode: "convergent",
        stopTrigger: false,
      });

      const result = await stopGuard.ensureClarified(context, inquiryRequest);

      // Build response
      const apiResponse = {
        type: "answer" as const,
        message: `I'll help you with: "${requestBody.message}"`,
      };

      // Assert: Direct answer
      expect(result.clarified).toBe(true);
      expect(apiResponse.type).toBe("answer");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle metrics endpoint", () => {
      const metrics = new QuestionOutcomeLogger();

      // Log some outcomes
      metrics.log({
        questionId: "q1",
        ladderStage: "meaning",
        stopResolved: true,
        turnsToResolution: 1,
        phaseAdvanced: true,
        timestamp: Date.now(),
      });

      metrics.log({
        questionId: "q2",
        ladderStage: "purpose",
        stopResolved: true,
        turnsToResolution: 2,
        phaseAdvanced: false,
        timestamp: Date.now(),
      });

      metrics.log({
        questionId: "q3",
        ladderStage: "meaning",
        stopResolved: false,
        turnsToResolution: 0,
        phaseAdvanced: false,
        timestamp: Date.now(),
      });

      // Get stats (as in metrics endpoint)
      const stats = metrics.getStats();

      const apiResponse = {
        total: stats.total,
        resolvedRate: stats.resolvedRate,
        avgTurnsToResolution: stats.avgTurnsToResolution,
        phaseAdvancedRate: stats.phaseAdvancedRate,
      };

      // Assert: Metrics returned
      expect(apiResponse.total).toBe(3);
      expect(apiResponse.resolvedRate).toBeCloseTo(0.667, 2);
      expect(apiResponse.avgTurnsToResolution).toBe(1.5); // (1+2)/2
      expect(apiResponse.phaseAdvancedRate).toBeCloseTo(0.333, 2);
    });
  });

  describe("E2E-003: Error Handling Scenarios", () => {
    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const hapClient = new HapClient({
        endpoint: "https://api.test.com",
        apiKey: "test-key",
      });

      const questionEngine: QuestionEngine = {
        async generateQuestion() {
          return "Question";
        },
      };

      const stopGuard = new StopGuard({
        client: hapClient,
        questionEngine,
      });

      const detector = new StopDetector();

      const request = detector.createRequest({
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      });

      // Should propagate error
      await expect(stopGuard.ensureClarified({}, request)).rejects.toThrow();
    });

    it("should validate request parameters", () => {
      const detector = new StopDetector();

      // Invalid ladder stage
      expect(() => {
        detector.createRequest({
          ladderStage: "invalid" as any,
          agencyMode: "convergent",
          stopTrigger: true,
        });
      }).toThrow(/Invalid ladderStage/);

      // Invalid agency mode
      expect(() => {
        detector.createRequest({
          ladderStage: "meaning",
          agencyMode: "hybrid" as any,
          stopTrigger: true,
        });
      }).toThrow(/Invalid agencyMode/);
    });
  });
});
