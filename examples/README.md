# HAP SDK Examples

This directory contains example integrations demonstrating how to use the Human Agency Protocol SDK.

## Prerequisites

```bash
# Install dependencies
npm install

# Set environment variables
export HAP_ENDPOINT="https://api.hap.example.com"
export HAP_API_KEY="your-api-key"
```

## Examples

### 1. Basic Node.js Example

**File:** `basic-nodejs.ts`

A complete command-line example showing the full Stop→Ask→Proceed flow.

**Features:**
- Interactive CLI prompts
- Stop condition detection
- Question generation with local engine
- Metrics tracking
- Feedback submission

**Run:**
```bash
npx tsx examples/basic-nodejs.ts
```

**What it demonstrates:**
1. HAP Client initialization
2. Custom Question Engine implementation
3. StopGuard enforcement
4. Stop detection with custom logic
5. User clarification flow
6. Metrics aggregation

---

### 2. Next.js API Route

**File:** `nextjs-api-route.ts`

Production-ready API endpoint for integrating HAP into Next.js applications.

**Features:**
- RESTful API design
- Session management
- Clarification workflow
- Metrics endpoint
- Error handling

**Setup:**
```bash
# In your Next.js project
cp examples/nextjs-api-route.ts pages/api/assistant.ts

# Or for App Router:
cp examples/nextjs-api-route.ts app/api/assistant/route.ts
```

**Endpoints:**

**POST /api/assistant**
```json
{
  "message": "help me plan a project",
  "sessionId": "user-123"
}
```

Response (if clarification needed):
```json
{
  "type": "question",
  "question": {
    "text": "Could you clarify...",
    "blueprintId": "bp-123"
  }
}
```

Response (if no clarification needed):
```json
{
  "type": "answer",
  "message": "I'll help you with that..."
}
```

**POST /api/assistant** (with clarification):
```json
{
  "message": "help me plan a project",
  "sessionId": "user-123",
  "clarification": {
    "blueprintId": "bp-123",
    "answer": "I want to build a web app"
  }
}
```

**GET /api/assistant/metrics**
```json
{
  "total": 10,
  "resolvedRate": 0.8,
  "avgTurnsToResolution": 1.2,
  "phaseAdvancedRate": 0.6
}
```

---

## Key Concepts

### Stop→Ask→Proceed Flow

```
1. User Input → Context (semantic, stays local)
2. Stop Detection → InquiryRequest (structural, sent to HAP)
3. HAP Service → InquiryBlueprint (guidance for question)
4. Question Engine → Question (generated locally)
5. User Answer → Clarification (semantic, stays local)
6. Feedback → HAP Service (structural outcome only)
7. Proceed → Action
```

### Privacy Architecture

**Never sent to HAP:**
- User messages
- Generated questions
- User answers
- Any semantic content

**Only sent to HAP:**
- Ladder stage (meaning/purpose/intention/action)
- Agency mode (convergent/reflective)
- Stop trigger (boolean)
- Stop resolved (boolean)
- Pattern ID (structural identifier)

### Custom Question Engine

All examples use a simple Question Engine. In production, replace with:

- **Local LLM:** Ollama, LM Studio, etc.
- **Commercial API:** OpenAI, Anthropic (keep context local)
- **Rule-based:** Template system with domain logic

```typescript
const questionEngine: QuestionEngine = {
  async generateQuestion(context: unknown, spec: QuestionSpec) {
    // Your implementation
    return myLLM.generate({
      prompt: buildPrompt(context, spec),
      temperature: 0.7,
    });
  },
};
```

### Stop Detection Strategies

**Manual (used in examples):**
```typescript
const detector = new StopDetector();
const request = detector.createRequest({
  ladderStage: "meaning",
  agencyMode: "convergent",
  stopTrigger: detectAmbiguity(input),
});
```

**Custom Strategy:**
```typescript
const detector = new StopDetector({
  strategy: {
    analyze: (context: any) => ({
      shouldStop: context.confidence < 0.7,
      ladderStage: determineStage(context),
      agencyMode: "convergent",
    }),
  },
});

const request = await detector.detect(context);
```

---

## Testing Examples

Run E2E tests:
```bash
npm test -- e2e
```

---

## Troubleshooting

### "Invalid or missing API key"

Ensure `HAP_API_KEY` environment variable is set:
```bash
export HAP_API_KEY="your-key"
```

### "Network error"

Check `HAP_ENDPOINT` is correct and accessible:
```bash
curl $HAP_ENDPOINT/health
```

### "ValidationError: Invalid ladderStage"

Ensure ladder stage is one of:
- `meaning`
- `purpose`
- `intention`
- `action`

### "ValidationError: Invalid agencyMode"

Ensure agency mode is one of:
- `convergent`
- `reflective`

---

## Next Steps

1. **Customize Question Engine:** Integrate your LLM or rule system
2. **Add Persistence:** Store clarification history
3. **Implement Middleware:** Add logging, analytics, etc.
4. **Deploy:** Use in production with proper error handling

---

## Learn More

- [HAP SDK Documentation](https://github.com/humanagencyprotocol/hap-sdk-typescript)
- [Protocol Specification](https://humanagencyprotocol.org)
- [API Reference](../README.md#api-reference)

---

**Questions?** Open an issue at https://github.com/humanagencyprotocol/hap-sdk-typescript/issues
