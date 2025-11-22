/**
 * Basic Node.js Example - HAP SDK Integration
 *
 * This example demonstrates a complete Stop→Ask→Proceed flow using the HAP SDK.
 *
 * Run with: npx tsx examples/basic-nodejs.ts
 */

import {
  HapClient,
  StopGuard,
  StopDetector,
  QuestionOutcomeLogger,
  StopPatterns,
  Domains,
  detectAmbiguityPattern,
  classifyDomain,
  estimateComplexity,
} from "hap-sdk";
import type { QuestionEngine, QuestionSpec } from "hap-sdk";
import * as readline from "readline";

// ============================================================================
// Configuration
// ============================================================================

const HAP_ENDPOINT = process.env.HAP_ENDPOINT || "https://api.hap.example.com";
const HAP_API_KEY = process.env.HAP_API_KEY || "demo-key";

// ============================================================================
// Local Question Engine Implementation
// ============================================================================

/**
 * Simple Question Engine that generates questions based on QuestionSpec.
 *
 * In production, this would use your local LLM or rule-based system.
 */
class SimpleQuestionEngine implements QuestionEngine {
  async generateQuestion(
    context: unknown,
    spec: QuestionSpec
  ): Promise<string> {
    const ctx = context as any;

    // Generate question based on ladder stage and stop condition
    switch (spec.ladderStage) {
      case "meaning":
        if (spec.stopCondition === "meaning") {
          return `I'm not sure what you mean by "${ctx.userInput}". Could you clarify what you're trying to achieve?`;
        }
        return `What do you mean by "${ctx.userInput}"?`;

      case "purpose":
        return `What's the purpose of ${ctx.userInput}? What problem does it solve?`;

      case "intention":
        return `What outcome are you hoping for with ${ctx.userInput}?`;

      case "action":
        return `What specific steps should I take to ${ctx.userInput}?`;

      default:
        return `Could you provide more details about ${ctx.userInput}?`;
    }
  }
}

// ============================================================================
// User Input Helper
// ============================================================================

async function askUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n${question}\n> `, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ============================================================================
// Main Application
// ============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("HAP SDK - Basic Node.js Example");
  console.log("=".repeat(70));

  // 1. Initialize HAP Provider
  console.log("\n[1] Initializing HAP Provider (production)...");
  const hapProvider = new HapClient({
    endpoint: HAP_ENDPOINT,
    apiKey: HAP_API_KEY,
  });

  // 2. Initialize Question Engine
  console.log("[2] Setting up local Question Engine...");
  const questionEngine = new SimpleQuestionEngine();

  // 3. Initialize StopGuard
  console.log("[3] Creating StopGuard for enforcement...");
  const stopGuard = new StopGuard({
    provider: hapProvider,
    questionEngine,
    middleware: [
      {
        onStopDetected: (request) => {
          console.log(
            `   → Stop detected at ${request.ladderStage} stage (${request.agencyMode} mode)`
          );
        },
        onBlueprintReceived: (blueprint) => {
          console.log(`   → Received blueprint: ${blueprint.id}`);
        },
        onQuestionGenerated: (questionId) => {
          console.log(`   → Question generated: ${questionId}`);
        },
      },
    ],
  });

  // 4. Initialize metrics logger
  console.log("[4] Setting up metrics logging...");
  const metrics = new QuestionOutcomeLogger();

  // 5. Initialize stop detector
  console.log("[5] Setting up stop detector...");
  const detector = new StopDetector();

  console.log("\n" + "=".repeat(70));
  console.log("Setup complete! Starting interaction...");
  console.log("=".repeat(70));

  // ========================================================================
  // Simulated User Interaction
  // ========================================================================

  // Get user input
  const userInput = await askUser(
    "\nWhat would you like me to help you with?"
  );

  // Analyze input using metadata helpers
  const detectedPattern = detectAmbiguityPattern(userInput);
  const isAmbiguous = detectedPattern !== null;

  // Extract keywords for domain classification
  const words = userInput.toLowerCase().split(/\s+/);
  const domain = classifyDomain(words);

  // Estimate complexity
  const complexity = estimateComplexity({
    numEntities: words.length,
    hasAmbiguity: isAmbiguous,
    textLength: userInput.length,
  });

  console.log(`\n[Analyzing] Input: "${userInput}"`);
  console.log(`[Analyzing] Pattern detected: ${detectedPattern || "none"}`);
  console.log(`[Analyzing] Domain: ${domain}`);
  console.log(`[Analyzing] Complexity: ${complexity}/5`);

  // Create context (semantic data - stays local)
  const context = {
    userInput,
    ambiguous: isAmbiguous,
    timestamp: Date.now(),
  };

  // Create inquiry request with metadata (structural only)
  const inquiryRequest = detector.createRequestWithMetadata({
    ladderStage: "meaning",
    agencyMode: "convergent",
    stopTrigger: isAmbiguous,
    stopPattern: detectedPattern || undefined,
    domain,
    complexitySignal: complexity,
  });

  console.log(`\n[Request] Stop trigger: ${inquiryRequest.stopTrigger}`);
  if (inquiryRequest.stopPattern) {
    console.log(`[Request] Stop pattern: ${inquiryRequest.stopPattern}`);
  }
  console.log(`[Request] Domain: ${inquiryRequest.domain}`);
  console.log(`[Request] Complexity: ${inquiryRequest.complexitySignal}`);

  // ========================================================================
  // Stop→Ask→Proceed Enforcement
  // ========================================================================

  console.log("\n[Enforcement] Checking if clarification needed...");

  const clarificationResult = await stopGuard.ensureClarified(
    context,
    inquiryRequest
  );

  if (!clarificationResult.clarified) {
    console.log("\n[Stop] Clarification required!");
    console.log(`[Question] ${clarificationResult.question}`);

    // Ask user for clarification
    const answer = await askUser(clarificationResult.question!);

    console.log(`\n[Answer] "${answer}"`);

    // Log outcome
    metrics.log({
      questionId: clarificationResult.blueprintId!,
      ladderStage: "meaning",
      stopResolved: true,
      turnsToResolution: 1,
      phaseAdvanced: true,
      timestamp: Date.now(),
    });

    console.log(`\n[Proceed] Clarification received. Proceeding with action...`);

    // Send feedback to HAP Provider
    try {
      await hapProvider.sendFeedback({
        blueprintId: clarificationResult.blueprintId!,
        patternId: "basic-meaning-clarification",
        agencyMode: "convergent",
        stopResolved: true,
      });
      console.log(`[Feedback] Sent to HAP Provider`);
    } catch (error) {
      console.log(`[Feedback] Failed to send (demo mode): ${error}`);
    }

    // Now proceed with the action
    console.log(`\n[Action] Processing clarified request: "${answer}"`);
  } else {
    console.log("\n[Proceed] No clarification needed. Proceeding directly...");

    console.log(`\n[Action] Processing request: "${userInput}"`);
  }

  // ========================================================================
  // Display Metrics
  // ========================================================================

  console.log("\n" + "=".repeat(70));
  console.log("Metrics Summary");
  console.log("=".repeat(70));

  const stats = metrics.getStats();
  console.log(`Total questions: ${stats.total}`);
  console.log(`Resolution rate: ${(stats.resolvedRate * 100).toFixed(1)}%`);
  console.log(`Avg turns to resolution: ${stats.avgTurnsToResolution.toFixed(1)}`);
  console.log(
    `Phase advanced rate: ${(stats.phaseAdvancedRate * 100).toFixed(1)}%`
  );

  console.log("\n" + "=".repeat(70));
  console.log("Example complete!");
  console.log("=".repeat(70));
}

// ============================================================================
// Run Example
// ============================================================================

main().catch((error) => {
  console.error("\n[Error]", error);
  process.exit(1);
});
