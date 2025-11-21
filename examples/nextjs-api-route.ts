/**
 * Next.js API Route Example - HAP SDK Integration
 *
 * This example shows how to integrate HAP SDK into a Next.js API route.
 *
 * File location: pages/api/assistant.ts (or app/api/assistant/route.ts for App Router)
 *
 * Usage:
 * POST /api/assistant
 * {
 *   "message": "help me plan a project",
 *   "sessionId": "user-123"
 * }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  HapClient,
  StopGuard,
  StopDetector,
  QuestionOutcomeLogger,
} from "hap-sdk";
import type { QuestionEngine, QuestionSpec } from "hap-sdk";

// ============================================================================
// Configuration
// ============================================================================

const HAP_ENDPOINT = process.env.HAP_ENDPOINT!;
const HAP_API_KEY = process.env.HAP_API_KEY!;

// ============================================================================
// Singleton Instances (reused across requests)
// ============================================================================

let hapProvider: HapClient;
let stopGuard: StopGuard;
let detector: StopDetector;
let metrics: QuestionOutcomeLogger;

function initializeSDK() {
  if (!hapProvider) {
    hapProvider = new HapClient({
      endpoint: HAP_ENDPOINT,
      apiKey: HAP_API_KEY,
    });

    const questionEngine: QuestionEngine = {
      async generateQuestion(context: unknown, spec: QuestionSpec) {
        const ctx = context as any;

        // Use your local LLM here (OpenAI, Anthropic, local model, etc.)
        // For this example, we'll use a simple template
        return `Could you clarify what you mean by "${ctx.message}"? (${spec.ladderStage} level)`;
      },
    };

    stopGuard = new StopGuard({
      provider: hapProvider,
      questionEngine,
      middleware: [
        {
          onStopDetected: (request) => {
            console.log(`[HAP] Stop detected:`, request);
          },
        },
      ],
    });

    detector = new StopDetector();
    metrics = new QuestionOutcomeLogger();
  }
}

// ============================================================================
// Request/Response Types
// ============================================================================

interface AssistantRequest {
  message: string;
  sessionId: string;
  clarification?: {
    blueprintId: string;
    answer: string;
  };
}

interface AssistantResponse {
  type: "question" | "answer" | "error";
  message?: string;
  question?: {
    text: string;
    blueprintId: string;
  };
  error?: string;
}

// ============================================================================
// Ambiguity Detection Helper
// ============================================================================

function detectAmbiguity(message: string): boolean {
  // Simple heuristic - in production, use your LLM or NLP model
  const ambiguityIndicators = [
    "maybe",
    "unclear",
    "not sure",
    "kinda",
    "possibly",
    "probably",
    "might",
  ];

  const lowerMessage = message.toLowerCase();
  return ambiguityIndicators.some((indicator) =>
    lowerMessage.includes(indicator)
  );
}

// ============================================================================
// Main API Handler
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssistantResponse>
) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      type: "error",
      error: "Method not allowed",
    });
  }

  try {
    // Initialize SDK (lazy initialization)
    initializeSDK();

    const { message, sessionId, clarification } =
      req.body as AssistantRequest;

    // Validate input
    if (!message || !sessionId) {
      return res.status(400).json({
        type: "error",
        error: "Missing required fields: message, sessionId",
      });
    }

    console.log(`[Request] Session: ${sessionId}, Message: "${message}"`);

    // ======================================================================
    // Handle Clarification Response
    // ======================================================================

    if (clarification) {
      console.log(
        `[Clarification] Blueprint: ${clarification.blueprintId}, Answer: "${clarification.answer}"`
      );

      // Log the outcome
      metrics.log({
        questionId: clarification.blueprintId,
        ladderStage: "meaning",
        stopResolved: true,
        turnsToResolution: 1,
        phaseAdvanced: true,
        timestamp: Date.now(),
      });

      // Send feedback to HAP Provider
      await hapProvider.sendFeedback({
        blueprintId: clarification.blueprintId,
        patternId: "api-clarification",
        agencyMode: "convergent",
        stopResolved: true,
      });

      // Now process the clarified request
      return res.status(200).json({
        type: "answer",
        message: `Based on your clarification "${clarification.answer}", I'll proceed with processing your request.`,
      });
    }

    // ======================================================================
    // Detect Stop Condition
    // ======================================================================

    const isAmbiguous = detectAmbiguity(message);
    console.log(`[Analysis] Ambiguous: ${isAmbiguous}`);

    // Create context (stays local)
    const context = {
      message,
      sessionId,
      timestamp: Date.now(),
    };

    // Create structural request
    const inquiryRequest = detector.createRequest({
      ladderStage: "meaning",
      agencyMode: "convergent",
      stopTrigger: isAmbiguous,
    });

    // ======================================================================
    // Stop→Ask→Proceed Enforcement
    // ======================================================================

    const result = await stopGuard.ensureClarified(context, inquiryRequest);

    if (!result.clarified) {
      // Stop condition triggered - return question to user
      console.log(`[Stop] Asking for clarification`);

      return res.status(200).json({
        type: "question",
        question: {
          text: result.question!,
          blueprintId: result.blueprintId!,
        },
      });
    }

    // ======================================================================
    // Proceed with Action
    // ======================================================================

    console.log(`[Proceed] Processing request directly`);

    // Your actual assistant logic here
    // For this example, we'll return a simple response
    return res.status(200).json({
      type: "answer",
      message: `I understand you want: "${message}". I'll help you with that.`,
    });
  } catch (error) {
    console.error("[Error]", error);

    return res.status(500).json({
      type: "error",
      error:
        error instanceof Error ? error.message : "Internal server error",
    });
  }
}

// ============================================================================
// Metrics Endpoint (Optional)
// ============================================================================

/**
 * GET /api/assistant/metrics
 *
 * Returns aggregated metrics about question resolution.
 */
export async function metricsHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  initializeSDK();

  const stats = metrics.getStats();

  return res.status(200).json({
    total: stats.total,
    resolvedRate: stats.resolvedRate,
    avgTurnsToResolution: stats.avgTurnsToResolution,
    phaseAdvancedRate: stats.phaseAdvancedRate,
  });
}

// ============================================================================
// Example Client-Side Integration
// ============================================================================

/**
 * Example frontend code to interact with this API:
 *
 * ```typescript
 * // Send message
 * const response = await fetch('/api/assistant', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     message: userInput,
 *     sessionId: getCurrentUserId()
 *   })
 * });
 *
 * const data = await response.json();
 *
 * if (data.type === 'question') {
 *   // Show clarification question to user
 *   const answer = await showQuestionDialog(data.question.text);
 *
 *   // Send clarification
 *   const clarifiedResponse = await fetch('/api/assistant', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       message: userInput,
 *       sessionId: getCurrentUserId(),
 *       clarification: {
 *         blueprintId: data.question.blueprintId,
 *         answer: answer
 *       }
 *     })
 *   });
 *
 *   const finalData = await clarifiedResponse.json();
 *   displayResponse(finalData.message);
 * } else if (data.type === 'answer') {
 *   // Display answer directly
 *   displayResponse(data.message);
 * } else {
 *   // Handle error
 *   displayError(data.error);
 * }
 * ```
 */
