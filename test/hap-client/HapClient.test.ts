/**
 * Functional tests for HapClient
 *
 * These tests verify actual HTTP behavior using a mock fetch implementation.
 * Coverage: Testing Plan section 3.2 (HapClient Tests)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HapClient } from "../../src/hap-client/HapClient";
import type { InquiryRequest, InquiryBlueprint, FeedbackPayload } from "../../src/types";
import {
  ValidationError,
  TimeoutError,
  ServiceError,
  CircuitOpenError,
  AuthenticationError,
} from "../../src/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("HapClient Functional Tests", () => {
  let client: HapClient;

  const validBlueprint: InquiryBlueprint = {
    id: "test-blueprint-01",
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

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HapClient({
      endpoint: "https://api.test.com",
      apiKey: "test-key-12345",
      timeout: 5000,
      maxRetries: 2, // Fewer retries for faster tests
    });
  });

  describe("HC-001: requestInquiryBlueprint sends correct payload", () => {
    it("should make POST request to correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await client.requestInquiryBlueprint(request);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/v1/inquiry/blueprints",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-key-12345",
          }),
          body: JSON.stringify(request),
        })
      );
    });

    it("should return validated blueprint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      const result = await client.requestInquiryBlueprint(request);

      expect(result).toEqual(validBlueprint);
    });
  });

  describe("HC-002: requestInquiryBlueprint validates response", () => {
    it("should throw ValidationError for invalid blueprint", async () => {
      const invalidBlueprint = {
        id: "test",
        // missing required fields
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await expect(client.requestInquiryBlueprint(request)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("HC-003: sendFeedback sends correct payload", () => {
    it("should make POST request with feedback", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const feedback: FeedbackPayload = {
        blueprintId: "test-blueprint",
        patternId: "test-pattern",
        agencyMode: "convergent",
        stopResolved: true,
      };

      await client.sendFeedback(feedback);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/v1/feedback/instances",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(feedback),
        })
      );
    });
  });

  describe("HC-004: sendFeedback validates request before sending", () => {
    it("should throw ValidationError for invalid payload", async () => {
      const invalidPayload = {
        blueprintId: "test",
        // missing stopResolved
      } as any;

      // Should throw BEFORE making network call
      await expect(client.sendFeedback(invalidPayload)).rejects.toThrow(
        ValidationError
      );

      // Verify no network call was made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("HC-E-001: Network timeout triggers retry", () => {
    it("should retry on timeout and eventually throw TimeoutError", async () => {
      // Simulate timeout by rejecting with AbortError
      mockFetch.mockRejectedValue(new DOMException("Aborted", "AbortError"));

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await expect(client.requestInquiryBlueprint(request)).rejects.toThrow(
        TimeoutError
      );

      // Should have attempted: initial + 2 retries = 3 attempts
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000); // Increase timeout for retry delays
  });

  describe("HC-E-002: 500 error triggers retry", () => {
    it("should retry on 500 and succeed on 3rd attempt", async () => {
      mockFetch
        .mockRejectedValueOnce(
          new ServiceError("Server error", { statusCode: 500 })
        )
        .mockRejectedValueOnce(
          new ServiceError("Server error", { statusCode: 500 })
        )
        .mockResolvedValueOnce({
          ok: true,
          json: async () => validBlueprint,
        });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      const result = await client.requestInquiryBlueprint(request);

      expect(result).toEqual(validBlueprint);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe("HC-E-003: 400 error does not retry", () => {
    it("should not retry on 400 error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad request",
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      await expect(client.requestInquiryBlueprint(request)).rejects.toThrow(
        ServiceError
      );

      // Should only attempt once (4xx errors are not retried)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("HC-E-004: Circuit breaker opens after failures", () => {
    it("should open circuit after threshold failures", async () => {
      // Create client with low threshold for testing
      const testClient = new HapClient({
        endpoint: "https://api.test.com",
        apiKey: "test-key",
        circuitBreakerThreshold: 2, // Open after 2 failures
        maxRetries: 0, // No retries for faster test
      });

      mockFetch.mockRejectedValue(new Error("Network error"));

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      // First failure
      await expect(testClient.requestInquiryBlueprint(request)).rejects.toThrow();
      expect(testClient.getCircuitState()).toBe("closed");

      // Second failure - should open circuit
      await expect(testClient.requestInquiryBlueprint(request)).rejects.toThrow();
      expect(testClient.getCircuitState()).toBe("open");

      // Third attempt - should fail immediately with CircuitOpenError
      await expect(testClient.requestInquiryBlueprint(request)).rejects.toThrow(
        CircuitOpenError
      );

      // Should not have made a third network call
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("HC-S-001: API key not logged in errors", () => {
    it("should redact API key from Service error messages", async () => {
      // Mock a service error that includes the API key
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => `Authentication failed with key: test-key-12345`,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      try {
        await client.requestInquiryBlueprint(request);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect((error as Error).message).not.toContain("test-key-12345");
        expect((error as Error).message).toContain("[REDACTED]");
      }
    });

    it("should not leak API key in network errors", async () => {
      mockFetch.mockRejectedValue(new TypeError("fetch failed"));

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      try {
        await client.requestInquiryBlueprint(request);
        expect.fail("Should have thrown error");
      } catch (error) {
        // Verify API key is not in the error message
        expect((error as Error).message).not.toContain("test-key-12345");
      }
    });
  });

  describe("HC-S-003: HTTPS enforced", () => {
    it("should upgrade http:// to https://", () => {
      const httpClient = new HapClient({
        endpoint: "http://api.test.com",
        apiKey: "test-key",
      });

      // Should have upgraded to HTTPS
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validBlueprint,
      });

      const request: InquiryRequest = {
        ladderStage: "meaning",
        agencyMode: "convergent",
        stopTrigger: true,
      };

      void httpClient.requestInquiryBlueprint(request);

      // Verify HTTPS was used
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/v1/inquiry/blueprints",
        expect.any(Object)
      );
    });
  });

  describe("HC-CONFIG-001: Configuration validation", () => {
    it("should throw error for missing endpoint", () => {
      expect(
        () =>
          new HapClient({
            endpoint: "",
            apiKey: "test-key",
          })
      ).toThrow(ValidationError);
    });

    it("should throw error for missing API key", () => {
      expect(
        () =>
          new HapClient({
            endpoint: "https://api.test.com",
            apiKey: "",
          })
      ).toThrow(AuthenticationError);
    });
  });
});
