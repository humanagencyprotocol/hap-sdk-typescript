/**
 * Tests for LocalHapProvider
 *
 * Coverage:
 * - Constructor and config validation
 * - Blueprint loading (local directory)
 * - Blueprint loading (remote URL)
 * - Blueprint matching by stage/mode/pattern
 * - Selector integration
 * - Feedback to metrics flow
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalHapProvider } from "../../src/providers/LocalHapProvider";
import { simpleLatestVersionSelector } from "../../src/providers/exampleSelectors";
import type {
  InquiryBlueprint,
  BlueprintSelector,
  BlueprintMetrics,
} from "../../src/types/index";
import * as fs from "fs";
import * as path from "path";

// Mock fs for local file tests
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
    },
  };
});

// Mock fetch for remote URL tests
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("LocalHapProvider", () => {
  const validBlueprint: InquiryBlueprint = {
    id: "meaning-convergent-ambiguous-v1",
    intent: "clarify ambiguous language",
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

  const validBlueprint2: InquiryBlueprint = {
    id: "meaning-convergent-ambiguous-v2",
    intent: "clarify ambiguous language (v2)",
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

  const purposeBlueprint: InquiryBlueprint = {
    id: "purpose-convergent-direction-v1",
    intent: "clarify purpose and direction",
    ladderStage: "purpose",
    agencyMode: "convergent",
    targetStructures: ["intended_outcome"],
    constraints: {
      tone: "facilitative",
      addressing: "individual",
    },
    renderHint: "ask about outcome",
    examples: ["What outcome are you hoping for?"],
    stopCondition: "direction",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor and Config Validation", () => {
    it("should create provider with valid config", () => {
      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
      });

      expect(provider).toBeInstanceOf(LocalHapProvider);
      expect(provider.getConfig().blueprintSource).toBe("./blueprints");
    });

    it("should throw if blueprintSource is missing", () => {
      expect(() => {
        new LocalHapProvider({
          blueprintSource: "" as any,
          selector: simpleLatestVersionSelector,
        });
      }).toThrow("blueprintSource is required");
    });

    it("should throw if blueprintSource is not a string", () => {
      expect(() => {
        new LocalHapProvider({
          blueprintSource: 123 as any,
          selector: simpleLatestVersionSelector,
        });
      }).toThrow("blueprintSource is required and must be a string");
    });

    it("should throw if selector is missing", () => {
      expect(() => {
        new LocalHapProvider({
          blueprintSource: "./blueprints",
          selector: undefined as any,
        });
      }).toThrow("selector is required");
    });

    it("should throw if selector is not a function", () => {
      expect(() => {
        new LocalHapProvider({
          blueprintSource: "./blueprints",
          selector: "not-a-function" as any,
        });
      }).toThrow("selector is required and must be a function");
    });

    it("should accept optional metricsLogger", () => {
      const metricsLogger = {
        log: vi.fn(),
        getStats: vi.fn(),
      } as any;

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
        metricsLogger,
      });

      expect(provider.getConfig().metricsLogger).toBe(metricsLogger);
    });

    it("should accept optional cacheDir", () => {
      const provider = new LocalHapProvider({
        blueprintSource: "https://example.com/blueprints",
        selector: simpleLatestVersionSelector,
        cacheDir: "./.hap-cache",
      });

      expect(provider.getConfig().cacheDir).toBe("./.hap-cache");
    });
  });

  describe("Blueprint Loading - Local Directory", () => {
    it("should load blueprints from local directory", async () => {
      // Mock fs.promises.stat
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock fs.promises.readdir
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        "meaning-convergent-ambiguous-v1.json",
        "purpose-convergent-vague-v1.json",
        "README.md", // Should be ignored
      ] as any);

      // Mock fs.promises.readFile
      vi.mocked(fs.promises.readFile)
        .mockResolvedValueOnce(JSON.stringify(validBlueprint))
        .mockResolvedValueOnce(JSON.stringify(purposeBlueprint));

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      const result = await provider.requestInquiryBlueprint(request);

      expect(result).toEqual(validBlueprint);
      expect(provider.getCachedBlueprints().size).toBe(2);
    });

    it("should cache loaded blueprints", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      vi.mocked(fs.promises.readdir).mockResolvedValue([
        "meaning-convergent-ambiguous-v1.json",
      ] as any);

      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(validBlueprint)
      );

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      // First call loads from filesystem
      await provider.requestInquiryBlueprint(request);
      expect(vi.mocked(fs.promises.readdir)).toHaveBeenCalledTimes(1);

      // Second call uses cache
      await provider.requestInquiryBlueprint(request);
      expect(vi.mocked(fs.promises.readdir)).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should throw if directory does not exist", async () => {
      vi.mocked(fs.promises.stat).mockRejectedValue(
        new Error("ENOENT: no such file or directory")
      );

      const provider = new LocalHapProvider({
        blueprintSource: "./nonexistent",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      await expect(provider.requestInquiryBlueprint(request)).rejects.toThrow();
    });

    it("should skip invalid JSON files", async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      vi.mocked(fs.promises.readdir).mockResolvedValue([
        "valid.json",
        "invalid.json",
      ] as any);

      vi.mocked(fs.promises.readFile)
        .mockResolvedValueOnce(JSON.stringify(validBlueprint))
        .mockResolvedValueOnce("not valid json");

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      // Should load only the valid blueprint
      const result = await provider.requestInquiryBlueprint(request);
      expect(result).toEqual(validBlueprint);
      expect(provider.getCachedBlueprints().size).toBe(1);
    });
  });

  describe("Blueprint Loading - Remote URL", () => {
    it("should load blueprints from remote URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [validBlueprint, purposeBlueprint],
      });

      const provider = new LocalHapProvider({
        blueprintSource: "https://example.com/blueprints.json",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      const result = await provider.requestInquiryBlueprint(request);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/blueprints.json"
      );
      expect(result).toEqual(validBlueprint);
      expect(provider.getCachedBlueprints().size).toBe(2);
    });

    it("should handle single blueprint from URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => validBlueprint, // Single object, not array
      });

      const provider = new LocalHapProvider({
        blueprintSource: "https://example.com/blueprint.json",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      await provider.requestInquiryBlueprint(request);

      expect(provider.getCachedBlueprints().size).toBe(1);
    });

    it("should throw on HTTP error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const provider = new LocalHapProvider({
        blueprintSource: "https://example.com/blueprints.json",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      await expect(provider.requestInquiryBlueprint(request)).rejects.toThrow(
        "404"
      );
    });
  });

  describe("Blueprint Matching and Filtering", () => {
    beforeEach(() => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      vi.mocked(fs.promises.readdir).mockResolvedValue([
        "meaning-convergent-ambiguous-v1.json",
        "meaning-convergent-ambiguous-v2.json",
        "purpose-convergent-vague-v1.json",
      ] as any);

      vi.mocked(fs.promises.readFile)
        .mockResolvedValueOnce(JSON.stringify(validBlueprint))
        .mockResolvedValueOnce(JSON.stringify(validBlueprint2))
        .mockResolvedValueOnce(JSON.stringify(purposeBlueprint));
    });

    it("should filter by ladderStage and agencyMode", async () => {
      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      const result = await provider.requestInquiryBlueprint(request);

      // Should return one of the "meaning-convergent" blueprints
      expect(result.ladderStage).toBe("meaning");
      expect(result.agencyMode).toBe("convergent");
    });

    it("should filter by stopPattern if provided", async () => {
      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
        stopPattern: "meaning",
      };

      const result = await provider.requestInquiryBlueprint(request);

      expect(result.stopCondition).toBe("meaning");
    });

    it("should sort candidates by version (descending)", async () => {
      const capturedCandidates: InquiryBlueprint[] = [];
      const capturingSelector: BlueprintSelector = (candidates) => {
        capturedCandidates.push(...candidates);
        return candidates[0]!;
      };

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: capturingSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      await provider.requestInquiryBlueprint(request);

      // Should be sorted v2, v1 (descending)
      expect(capturedCandidates[0]!.id).toContain("-v2");
      expect(capturedCandidates[1]!.id).toContain("-v1");
    });

    it("should throw if no matching blueprints found", async () => {
      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "action" as const, // No action blueprints loaded
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      await expect(provider.requestInquiryBlueprint(request)).rejects.toThrow(
        "No matching blueprints found"
      );
    });
  });

  describe("Selector Integration", () => {
    beforeEach(() => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      vi.mocked(fs.promises.readdir).mockResolvedValue([
        "meaning-convergent-ambiguous-v1.json",
      ] as any);

      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(validBlueprint)
      );
    });

    it("should call selector with candidates, request, and metrics", async () => {
      const mockSelector = vi.fn((candidates) => candidates[0]!);

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: mockSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      await provider.requestInquiryBlueprint(request);

      expect(mockSelector).toHaveBeenCalledWith(
        expect.any(Array),
        request,
        expect.any(Map)
      );
    });

    it("should provide metrics map to selector", async () => {
      let capturedMetrics: ReadonlyMap<string, BlueprintMetrics> | null = null;

      const capturingSelector: BlueprintSelector = (
        candidates,
        _request,
        metrics
      ) => {
        capturedMetrics = metrics;
        return candidates[0]!;
      };

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: capturingSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      await provider.requestInquiryBlueprint(request);

      expect(capturedMetrics).toBeInstanceOf(Map);
    });

    it("should throw if selector returns null/undefined", async () => {
      const badSelector: BlueprintSelector = () => null as any;

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: badSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      await expect(provider.requestInquiryBlueprint(request)).rejects.toThrow(
        "returned null/undefined"
      );
    });

    it("should throw if selector returns blueprint not in candidates", async () => {
      const otherBlueprint: InquiryBlueprint = {
        ...validBlueprint,
        id: "different-blueprint",
      };

      const badSelector: BlueprintSelector = () => otherBlueprint;

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: badSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      await expect(provider.requestInquiryBlueprint(request)).rejects.toThrow(
        "must return one of the provided candidates"
      );
    });
  });

  describe("Feedback and Metrics", () => {
    beforeEach(() => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      vi.mocked(fs.promises.readdir).mockResolvedValue([
        "meaning-convergent-ambiguous-v1.json",
      ] as any);

      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(validBlueprint)
      );
    });

    it("should accept feedback without metricsLogger (no-op)", async () => {
      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
      });

      await expect(
        provider.sendFeedback({
          blueprintId: "test-blueprint",
          patternId: "test-pattern",
          agencyMode: "convergent",
          stopResolved: true,
        })
      ).resolves.not.toThrow();
    });

    it("should update metrics on feedback", async () => {
      const metricsLogger = {
        log: vi.fn(),
        getStats: vi.fn(),
      } as any;

      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
        metricsLogger,
      });

      await provider.sendFeedback({
        blueprintId: "meaning-convergent-ambiguous-v1",
        patternId: "test",
        agencyMode: "convergent",
        stopResolved: true,
        turnsDelta: 2,
      });

      const metrics = provider.getMetrics("meaning-convergent-ambiguous-v1");
      expect(metrics).toBeDefined();
      expect(metrics!.totalUses).toBe(1);
      expect(metrics!.resolutionRate).toBe(1.0);
    });

    it("should track resolution rate correctly", async () => {
      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
        metricsLogger: {} as any,
      });

      // First feedback: resolved
      await provider.sendFeedback({
        blueprintId: "bp-1",
        patternId: "test",
        agencyMode: "convergent",
        stopResolved: true,
      });

      let metrics = provider.getMetrics("bp-1");
      expect(metrics!.resolutionRate).toBe(1.0);

      // Second feedback: not resolved
      await provider.sendFeedback({
        blueprintId: "bp-1",
        patternId: "test",
        agencyMode: "convergent",
        stopResolved: false,
      });

      metrics = provider.getMetrics("bp-1");
      expect(metrics!.totalUses).toBe(2);
      expect(metrics!.resolutionRate).toBe(0.5); // 1/2
    });

    it("should track average turns correctly", async () => {
      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
        metricsLogger: {} as any,
      });

      // First: 2 turns
      await provider.sendFeedback({
        blueprintId: "bp-1",
        patternId: "test",
        agencyMode: "convergent",
        stopResolved: true,
        turnsDelta: 2,
      });

      // Second: 4 turns
      await provider.sendFeedback({
        blueprintId: "bp-1",
        patternId: "test",
        agencyMode: "convergent",
        stopResolved: true,
        turnsDelta: 4,
      });

      const metrics = provider.getMetrics("bp-1");
      expect(metrics!.averageTurns).toBe(3); // (2+4)/2
    });

    it("should track phase advance rate", async () => {
      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
        metricsLogger: {} as any,
      });

      // Phase advanced
      await provider.sendFeedback({
        blueprintId: "bp-1",
        patternId: "test",
        agencyMode: "convergent",
        stopResolved: true,
        previousPhase: "meaning",
        currentPhase: "purpose",
      });

      // Phase did not advance
      await provider.sendFeedback({
        blueprintId: "bp-1",
        patternId: "test",
        agencyMode: "convergent",
        stopResolved: true,
        previousPhase: "purpose",
        currentPhase: "purpose",
      });

      const metrics = provider.getMetrics("bp-1");
      expect(metrics!.phaseAdvanceRate).toBe(0.5); // 1/2
    });

    it("should throw if blueprintId is missing from feedback", async () => {
      const provider = new LocalHapProvider({
        blueprintSource: "./blueprints",
        selector: simpleLatestVersionSelector,
      });

      await expect(
        provider.sendFeedback({
          blueprintId: "",
          patternId: "test",
          agencyMode: "convergent",
          stopResolved: true,
        })
      ).rejects.toThrow("blueprintId is required");
    });
  });

  describe("Integration Tests", () => {
    it("should work end-to-end with real blueprints directory", async () => {
      // Use actual blueprints directory
      const blueprintsPath = path.resolve(__dirname, "../../blueprints");

      const provider = new LocalHapProvider({
        blueprintSource: blueprintsPath,
        selector: simpleLatestVersionSelector,
      });

      const request = {
        ladderStage: "meaning" as const,
        agencyMode: "convergent" as const,
        stopTrigger: true,
      };

      const result = await provider.requestInquiryBlueprint(request);

      expect(result).toBeDefined();
      expect(result.ladderStage).toBe("meaning");
      expect(result.agencyMode).toBe("convergent");
    });
  });
});
