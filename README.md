# HAP SDK (TypeScript)

TypeScript/JavaScript SDK for the [Human Agency Protocol](https://humanagencyprotocol.org).

**Version:** 0.2.0 (in development)
**Protocol Version:** 0.1
**Status:** Development

**Latest Changes (v0.2.0):**
- Provider abstraction pattern (supports both HapClient and LocalHapProvider)
- Extended InquiryBlueprint with optional `promptContext` for LLM guidance
- Extended InquiryRequest with optional structural metadata
- Breaking change: `StopGuard` config now uses `provider` instead of `client`

---

## What is HAP?

The Human Agency Protocol enforces mandatory human checkpoints in AI systems. AI cannot proceed, escalate, or interpret ambiguous goals until it receives explicit human meaning and direction.

**Core mechanism: Stop → Ask → Proceed**

This SDK provides:
1. **Protocol compliance** - Integration with HAP Service Providers
2. **Local development** - File-based blueprint testing without a service (v0.2+)
3. **Local optimization** - Tools to improve question-asking over time (privacy-preserving)

---

## Installation

```bash
npm install hap-sdk
```

---

## Quick Start

```typescript
import { HapClient, StopGuard } from 'hap-sdk';

// 1. Create HAP provider (production)
const hapProvider = new HapClient({
  endpoint: process.env.HAP_ENDPOINT!,
  apiKey: process.env.HAP_API_KEY!,
});

// 2. Implement local QuestionEngine
const questionEngine = {
  async generateQuestion(context: any, spec: QuestionSpec): Promise<string> {
    // Your local LLM or rule system
    return myLocalLLM.generateQuestion(context, spec);
  },
};

// 3. Use StopGuard in your conversation flow
const stopGuard = new StopGuard({
  provider: hapProvider,
  questionEngine
});

async function handleUserInput(context: any) {
  const inquiryReq = detectStopCondition(context);

  const { clarified, question } = await stopGuard.ensureClarified(
    context,
    inquiryReq
  );

  if (!clarified && question) {
    // Show question to user, wait for answer
    const answer = await askUser(question);
    const updatedContext = updateContextWithAnswer(context, answer);

    // Send structural feedback to HAP
    await hapProvider.sendFeedback({
      blueprintId: "phase-progress",
      stopResolved: outcome.stopResolved,
    });
  }
}
```

**Key principle:** HAP never sees your context, questions, or answers. Only structural signals.

---

## Architecture

```
app / platform
   │
   ├── hap-sdk
   │     ├── hap-client         (protocol integration)
   │     ├── types              (structural types)
   │     ├── question-spec      (blueprint mapping)
   │     ├── runtime-guards     (stop/ask/proceed enforcement)
   │     └── metrics            (local optimization)
   │
   └── local-ai
         ├── gap-detector
         ├── question-engine    (your LLM/rules)
         └── optimization       (your strategy)
```

---

## Documentation

- **[Design Specification](https://github.com/humanagencyprotocol/protocol/blob/main/doc/hap_sdk_design_v0_1.md)** - Architecture and interfaces
- **[Development Plan](https://github.com/humanagencyprotocol/protocol/blob/main/doc/hap_sdk_dev_plan_v0_1.md)** - Implementation roadmap
- **[Testing Plan](https://github.com/humanagencyprotocol/protocol/blob/main/doc/hap_sdk_testing_plan_v0_1.md)** - Acceptance criteria
- **[Protocol Specification](https://github.com/humanagencyprotocol/protocol/blob/main/content/0.1/protocol.md)** - HAP v0.1

---

## Features

- ✅ **Type-safe** - Full TypeScript support with strict types
- ✅ **Privacy-first** - No semantic content leaves your system
- ✅ **Protocol enforcement** - Stop→Ask→Proceed guaranteed
- ✅ **Retry & circuit breaker** - Resilient network handling
- ✅ **Local optimization** - Improve question quality over time
- ✅ **Framework agnostic** - Works with any JS/TS environment

---

## Requirements

- Node.js 18+
- TypeScript 5.0+ (for development)

---

## Development

```bash
# Clone repository
git clone https://github.com/humanagencyprotocol/hap-sdk-typescript.git
cd hap-sdk-typescript

# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

---

## Examples

### Quick Start Examples

**Basic Node.js:**
```bash
npx tsx examples/basic-nodejs.ts
```

**Next.js API Route:**
```typescript
// pages/api/assistant.ts
import { HapClient, StopGuard } from 'hap-sdk';
// See examples/nextjs-api-route.ts for complete implementation
```

See the [examples/](./examples) directory for:
- **basic-nodejs.ts** - Interactive CLI demonstrating full Stop→Ask→Proceed flow
- **nextjs-api-route.ts** - Production-ready API endpoint with session handling
- **README.md** - Detailed setup instructions and troubleshooting

All examples include:
- Stop condition detection
- Question generation with local engine
- Metrics tracking
- Error handling patterns
- Privacy guarantees

---

## Version Mapping

| SDK Version | Protocol Version | Status |
|-------------|------------------|--------|
| 0.1.x       | 0.1              | Development |
| 0.2.x       | 0.1              | Planned (enforcement hardening) |

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) and review our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating. Security disclosures should follow [SECURITY.md](./SECURITY.md).

**Development process:**
1. Follow design specs in main protocol repo
2. All tests must pass (coverage ≥ 85%)
3. Security tests must pass (no API key leaks, no semantic content)
4. Update CHANGELOG.md

---

## License

Apache-2.0 - see [LICENSE](./LICENSE)

Third-party components are documented in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

---

## Related Projects

- **[Human Agency Protocol](https://github.com/humanagencyprotocol/protocol)** - Core protocol specification
- **HAP Python SDK** (coming soon) - `hap-sdk-python`
- **HAP Go SDK** (coming soon) - `hap-sdk-go`

---

## Support

- **Issues:** [GitHub Issues](https://github.com/humanagencyprotocol/hap-sdk-typescript/issues)
- **Protocol Spec:** [humanagencyprotocol.org](https://humanagencyprotocol.org)
- **Email:** [Contact form on website]

---

**AI Governance. Human Control.**
