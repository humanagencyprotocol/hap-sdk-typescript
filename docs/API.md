# API Reference

Complete API documentation for HAP SDK v0.2.x.

## Table of Contents

- [Overview](#overview)
- [Provider Abstraction](#provider-abstraction)
  - [HapProvider Interface](#happrovider-interface)
  - [HapClient](#hapclient)
  - [LocalHapProvider](#localhapprovider)
- [Runtime Guards](#runtime-guards)
  - [StopGuard](#stopguard)
  - [StopDetector](#stopdetector)
  - [GuardedAction](#guardedaction)
- [Metadata Helpers](#metadata-helpers)
- [Blueprint Selectors](#blueprint-selectors)
- [Question Spec](#question-spec)
- [Metrics](#metrics)
- [Types](#types)
- [Errors](#errors)

---

## Overview

The HAP SDK provides TypeScript types and runtime enforcement for the Human Agency Protocol. The API is organized around:

1. **Providers** - HapClient (production) and LocalHapProvider (development)
2. **Guards** - StopGuard enforces Stop→Ask→Proceed pattern
3. **Metadata** - Helpers for creating privacy-safe structural signals
4. **Selectors** - Blueprint selection strategies for LocalHapProvider
5. **Types** - Complete TypeScript definitions for HAP v0.1

**Key architectural guarantee**: All semantic content (context, questions, answers) stays strictly local. Only structural signals (patterns, stages, domains) may be shared with HAP services.

---

## Provider Abstraction

### HapProvider Interface

The base interface that both `HapClient` and `LocalHapProvider` implement.

```typescript
interface HapProvider {
  /**
   * Request an inquiry blueprint from the provider
   * @param request - Structural inquiry request (no semantic content)
   * @returns Promise<InquiryBlueprint> - Blueprint for generating questions
   */
  requestInquiryBlueprint(request: InquiryRequest): Promise<InquiryBlueprint>;

  /**
   * Send feedback about question outcome
   * @param payload - Structural feedback (no semantic content)
   */
  sendFeedback(payload: FeedbackPayload): Promise<void>;
}
```

**Purpose**: Abstracts provider implementation so StopGuard works with both production and local providers.

---

### HapClient

Production HAP service client with retry logic and circuit breaker.

#### Constructor

```typescript
new HapClient(config: HapClientConfig)
```

**Config**:
```typescript
interface HapClientConfig {
  /** HAP service endpoint URL */
  endpoint: string;

  /** API key for authentication */
  apiKey: string;

  /** Optional timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Optional max retries (default: 3) */
  maxRetries?: number;
}
```

#### Example

```typescript
import { HapClient } from 'hap-sdk';

const client = new HapClient({
  endpoint: process.env.HAP_ENDPOINT!,
  apiKey: process.env.HAP_API_KEY!,
  timeout: 10000,
  maxRetries: 3
});
```

#### Methods

**`requestInquiryBlueprint(request: InquiryRequest): Promise<InquiryBlueprint>`**

Requests a blueprint from the HAP service.

- Validates request structure
- Retries with exponential backoff (1s, 2s, 4s)
- Circuit breaker for service degradation
- Never leaks API key in errors/logs

**`sendFeedback(payload: FeedbackPayload): Promise<void>`**

Sends feedback about question outcome to HAP service.

#### Security

- API keys never appear in errors or logs
- Request validation prevents semantic content leakage
- All network errors are sanitized

---

### LocalHapProvider

File-based blueprint provider for local development without HAP service.

#### Constructor

```typescript
new LocalHapProvider(config: LocalHapProviderConfig)
```

**Config**:
```typescript
interface LocalHapProviderConfig {
  /**
   * Path to blueprints directory or remote URL
   * Examples: "./blueprints", "https://example.com/blueprints.json"
   */
  blueprintsPath: string;

  /**
   * Blueprint selection strategy (required)
   * See: Blueprint Selectors section
   */
  selector: BlueprintSelector;

  /**
   * Optional metrics logger for tracking performance
   */
  logger?: QuestionOutcomeLogger;

  /**
   * Enable blueprint caching (default: true)
   */
  cache?: boolean;
}
```

#### Example

```typescript
import { LocalHapProvider, balancedSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector
});

const stopGuard = new StopGuard({ provider, questionEngine });
```

#### Methods

**`requestInquiryBlueprint(request: InquiryRequest): Promise<InquiryBlueprint>`**

Returns a blueprint selected from local files.

1. Loads blueprints from directory/URL (cached)
2. Filters by ladderStage and agencyMode
3. Optionally filters by stopPattern (if provided)
4. Calls selector function with candidates
5. Returns selected blueprint

**`sendFeedback(payload: FeedbackPayload): Promise<void>`**

Records feedback in the local metrics logger.

**`getMetrics(blueprintId?: string): BlueprintMetrics | Record<string, BlueprintMetrics>`**

Returns metrics for a specific blueprint or all blueprints.

```typescript
// All metrics
const allMetrics = provider.getMetrics();

// Specific blueprint
const metrics = provider.getMetrics('meaning-convergent-ambiguous-v1');
console.log(`Success rate: ${metrics.resolvedRate * 100}%`);
```

#### Blueprint Loading

**From local directory**:
```typescript
const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector
});
```

**From remote URL**:
```typescript
const provider = new LocalHapProvider({
  blueprintsPath: 'https://example.com/blueprints.json',
  selector: balancedSelector,
  cache: true  // Cache downloaded blueprints
});
```

#### Blueprint Naming Convention

Files must follow the pattern:
```
{ladderStage}-{agencyMode}-{pattern}-v{version}.json
```

Examples:
- `meaning-convergent-ambiguous-v1.json`
- `purpose-reflective-values-v2.json`
- `action-convergent-details-v1.json`

---

## Runtime Guards

### StopGuard

Enforces Stop→Ask→Proceed pattern with privacy guarantee.

#### Constructor

```typescript
new StopGuard(config: StopGuardConfig)
```

**Config**:
```typescript
interface StopGuardConfig {
  /** HAP provider (HapClient or LocalHapProvider) */
  provider: HapProvider;

  /** Question engine for generating questions from blueprints */
  questionEngine: QuestionEngine;

  /** Optional hooks for observability */
  hooks?: {
    onStop?: (request: InquiryRequest) => void;
    onBlueprint?: (blueprint: InquiryBlueprint) => void;
    onQuestion?: (question: string) => void;
    onAnswer?: (answer: string) => void;
    onProceed?: () => void;
  };
}
```

#### Example

```typescript
import { HapClient, StopGuard } from 'hap-sdk';

const provider = new HapClient({ endpoint, apiKey });

const stopGuard = new StopGuard({
  provider,
  questionEngine: myQuestionEngine,
  hooks: {
    onStop: (req) => console.log('Stopped at:', req.ladderStage),
    onProceed: () => console.log('Proceeding with action')
  }
});
```

#### Methods

**`ensureClarified<T>(context: T, request: InquiryRequest): Promise<GuardedAction<T>>`**

Enforces the Stop→Ask→Proceed pattern.

**Returns**: `GuardedAction<T>` - Sealed action that requires resolution

**Privacy guarantee**: Context `T` is never sent to the provider. Only the structural `request` is transmitted.

```typescript
const action = await stopGuard.ensureClarified(
  { userId: 123, task: "Delete files" },  // Context stays local
  {
    ladderStage: 'action',
    agencyMode: 'convergent',
    stopTrigger: true,
    stopCondition: 'specifics'
  }
);

// action.stopped === true (cannot proceed yet)
// action.question === "Which files should I delete?"

const answer = await askUser(action.question);

const resolved = await action.resolve(answer);
// resolved.stopped === false
// resolved.proceed() is now available
```

---

### StopDetector

Helper for creating InquiryRequests with validation.

#### Constructor

```typescript
new StopDetector()
```

#### Methods

**`createRequest(params: InquiryRequestParams): InquiryRequest`**

Creates a validated InquiryRequest.

```typescript
const detector = new StopDetector();

const request = detector.createRequest({
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: true,
  stopCondition: 'meaning'
});
```

**`createRequestWithMetadata(params: InquiryRequestWithMetadataParams): InquiryRequest`**

Creates a request with optional metadata (v0.2+).

```typescript
import { detectAmbiguityPattern, classifyDomain, estimateComplexity } from 'hap-sdk';

const detector = new StopDetector();

const pattern = detectAmbiguityPattern(userInput);
const domain = classifyDomain(['code', 'test']);
const complexity = estimateComplexity({ hasAmbiguity: true });

const request = detector.createRequestWithMetadata({
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: true,

  // Optional metadata for better blueprint selection
  stopPattern: pattern || undefined,
  domain,
  complexitySignal: complexity,
  sessionContext: {
    previousStops: 5,
    consecutiveStops: 2,
    averageResolutionTurns: 1.5
  }
});
```

---

### GuardedAction

Type-safe enforcement mechanism that prevents bypassing the Ask step.

#### Types

**`StoppedAction<T>`** - Action that requires resolution (no `proceed()` method)

```typescript
interface StoppedAction<T> {
  stopped: true;
  context: T;
  question: string;
  blueprint: InquiryBlueprint;
  resolve(answer: string): Promise<ResolvedAction<T>>;
}
```

**`ResolvedAction<T>`** - Action that can proceed

```typescript
interface ResolvedAction<T> {
  stopped: false;
  context: T;
  proceed(): void;
}
```

#### Type Guards

```typescript
import { isStopped, isResolved } from 'hap-sdk';

if (isStopped(action)) {
  // TypeScript knows: action has .question and .resolve()
  const answer = await askUser(action.question);
  const resolved = await action.resolve(answer);
}

if (isResolved(action)) {
  // TypeScript knows: action has .proceed()
  action.proceed();
}
```

#### Runtime Enforcement

```typescript
const action = await stopGuard.ensureClarified(context, request);

if (action.stopped) {
  // Attempting to call proceed() will throw UnresolvedStopError
  // action.proceed(); // ❌ TypeScript error + runtime error

  // Must resolve first
  const resolved = await action.resolve(answer);
  resolved.proceed(); // ✅ Now allowed
}
```

---

## Metadata Helpers

Privacy-safe utilities for creating structural metadata (v0.2+).

### Constants

**`StopPatterns`** - Common stop patterns (15 patterns)

```typescript
import { StopPatterns } from 'hap-sdk';

// Meaning-level
StopPatterns.AMBIGUOUS_PRONOUN
StopPatterns.VAGUE_QUANTIFIER
StopPatterns.UNCLEAR_OBJECT
StopPatterns.MISSING_CONTEXT
StopPatterns.TECHNICAL_JARGON

// Purpose-level
StopPatterns.UNCLEAR_DIRECTION
StopPatterns.MISSING_GOAL
StopPatterns.AMBIGUOUS_INTENT
StopPatterns.CONFLICTING_OBJECTIVES

// Intention-level
StopPatterns.MULTIPLE_PATHS
StopPatterns.UNCLEAR_APPROACH
StopPatterns.MISSING_CONSTRAINTS

// Action-level
StopPatterns.INSUFFICIENT_DETAILS
StopPatterns.MISSING_PARAMETERS
StopPatterns.UNCLEAR_SEQUENCE
```

**`Domains`** - Domain classifications (9 domains)

```typescript
import { Domains } from 'hap-sdk';

Domains.SOFTWARE_DEVELOPMENT
Domains.DATA_ANALYSIS
Domains.CONTENT_CREATION
Domains.PROJECT_MANAGEMENT
Domains.RESEARCH
Domains.DESIGN
Domains.EDUCATION
Domains.CUSTOMER_SUPPORT
Domains.GENERAL
```

**`ComplexityLevels`** - Complexity scale (1-5)

```typescript
import { ComplexityLevels } from 'hap-sdk';

ComplexityLevels.VERY_LOW    // 1
ComplexityLevels.LOW         // 2
ComplexityLevels.MEDIUM      // 3
ComplexityLevels.HIGH        // 4
ComplexityLevels.VERY_HIGH   // 5
```

### Functions

**`detectAmbiguityPattern(text: string): string | null`**

Auto-detects common ambiguity patterns in text.

```typescript
import { detectAmbiguityPattern } from 'hap-sdk';

const pattern1 = detectAmbiguityPattern("Can you update it?");
// Returns: "ambiguous-pronoun"

const pattern2 = detectAmbiguityPattern("Make it better");
// Returns: "vague-quantifier"

const pattern3 = detectAmbiguityPattern("Hello world");
// Returns: null (no pattern detected)
```

**`classifyDomain(keywords: string[]): string`**

Classifies domain from keywords.

```typescript
import { classifyDomain } from 'hap-sdk';

const domain1 = classifyDomain(['code', 'test', 'deploy']);
// Returns: "software-development"

const domain2 = classifyDomain(['analyze', 'metrics', 'data']);
// Returns: "data-analysis"

const domain3 = classifyDomain(['hello']);
// Returns: "general"
```

**`estimateComplexity(signals: ComplexitySignals): number`**

Estimates complexity from structural signals.

```typescript
import { estimateComplexity } from 'hap-sdk';

const complexity = estimateComplexity({
  numEntities: 10,        // Number of entities/concepts
  hasAmbiguity: true,     // Contains ambiguity
  priorStops: 3,          // Previous stops in session
  isMultiStep: true       // Multi-step task
});
// Returns: 4 (on scale of 1-5)
```

**`createSessionContext(history: StopHistory): SessionContext`**

Builds session metadata from stop history.

```typescript
import { createSessionContext } from 'hap-sdk';

const context = createSessionContext([
  { resolved: true, turns: 1 },
  { resolved: true, turns: 2 },
  { resolved: false, turns: 3 }
]);

// Returns:
// {
//   previousStops: 3,
//   consecutiveStops: 0,
//   averageResolutionTurns: 1.5
// }
```

---

## Blueprint Selectors

Strategies for selecting blueprints in LocalHapProvider (v0.2+).

### Interface

```typescript
type BlueprintSelector = (
  candidates: InquiryBlueprint[],
  request: InquiryRequest,
  metricsMap: Map<string, BlueprintMetrics>
) => InquiryBlueprint;
```

### Built-in Selectors

**`simpleLatestVersionSelector`** - Always picks newest version

```typescript
import { simpleLatestVersionSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: simpleLatestVersionSelector
});
```

**`bestPerformanceSelector`** - Picks highest success rate

```typescript
import { bestPerformanceSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: bestPerformanceSelector
});
```

**`balancedSelector`** - Epsilon-greedy (ε=0.1) for exploration

```typescript
import { balancedSelector } from 'hap-sdk';

// 90% best performance, 10% random exploration
const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector  // ✅ Recommended default
});
```

**`contextAwareSelector`** - Uses metadata for smart selection

```typescript
import { contextAwareSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: contextAwareSelector  // Uses stopPattern, domain, complexity
});
```

**`createEpsilonGreedySelector(epsilon: number)`** - Configurable exploration

```typescript
import { createEpsilonGreedySelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: createEpsilonGreedySelector(0.2)  // 20% exploration
});
```

**`createLRUSelector()`** - Least-recently-used rotation

```typescript
import { createLRUSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: createLRUSelector()  // Rotates through all blueprints
});
```

### Custom Selectors

```typescript
import type { BlueprintSelector } from 'hap-sdk';

const mySelector: BlueprintSelector = (candidates, request, metricsMap) => {
  // Example: Prefer blueprints with <100 uses
  for (const candidate of candidates) {
    const metrics = metricsMap.get(candidate.id);
    if (!metrics || metrics.totalQuestions < 100) {
      return candidate;
    }
  }

  // Fallback to first candidate
  return candidates[0];
};

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: mySelector
});
```

---

## Question Spec

Converts InquiryBlueprint to QuestionSpec for question engines.

### QuestionSpecFactory

```typescript
import { QuestionSpecFactory } from 'hap-sdk';

const factory = new QuestionSpecFactory();

const spec = factory.createQuestionSpec(blueprint);
// spec.targetStructures, spec.constraints, etc.
```

### Custom Transformers

```typescript
const factory = new QuestionSpecFactory({
  toneTransformer: (tone) => {
    if (tone === 'facilitative') return 'friendly';
    return tone;
  },
  addressingTransformer: (addr) => {
    if (addr === 'individual') return 'you';
    return addr;
  }
});
```

---

## Metrics

### QuestionOutcomeLogger

Tracks question outcomes locally (no semantic content).

#### Constructor

```typescript
new QuestionOutcomeLogger(maxSize?: number)
```

Default maxSize: 1000 entries

#### Methods

**`logOutcome(outcome: QuestionOutcome): void`**

```typescript
logger.logOutcome({
  blueprintId: 'meaning-convergent-ambiguous-v1',
  ladderStage: 'meaning',
  resolved: true,
  turnsToResolution: 1,
  phaseAdvanced: false,
  timestamp: Date.now()
});
```

**`getStats(): OutcomeStats`**

```typescript
const stats = logger.getStats();
console.log(`Resolution rate: ${stats.overallResolutionRate * 100}%`);
console.log(`Avg turns: ${stats.avgTurnsToResolution}`);
```

**`getStatsByStage(): Record<LadderStage, StageStats>`**

```typescript
const byStage = logger.getStatsByStage();
console.log(`Meaning stage: ${byStage.meaning.resolutionRate * 100}%`);
```

**`export(exporter: MetricsExporter): void`**

```typescript
logger.export({
  export: (stats) => {
    console.log(JSON.stringify(stats, null, 2));
  }
});
```

---

## Types

### Core Types

**`LadderStage`**
```typescript
type LadderStage = 'meaning' | 'purpose' | 'intention' | 'action';
```

**`AgencyMode`**
```typescript
type AgencyMode = 'convergent' | 'reflective';
```

**`StopCondition`**
```typescript
type StopCondition = 'meaning' | 'direction' | 'both';
```

### InquiryRequest

```typescript
interface InquiryRequest {
  ladderStage: LadderStage;
  agencyMode: AgencyMode;
  stopTrigger: boolean;
  stopCondition?: StopCondition;

  // Optional metadata (v0.2+)
  stopPattern?: string;           // kebab-case pattern identifier
  domain?: string;                // kebab-case domain
  complexitySignal?: number;      // 1-5 scale
  sessionContext?: {
    previousStops: number;
    consecutiveStops: number;
    averageResolutionTurns: number;
  };
}
```

### InquiryBlueprint

```typescript
interface InquiryBlueprint {
  id: string;
  intent: string;
  ladderStage: LadderStage;
  agencyMode: AgencyMode;
  targetStructures: string[];
  constraints: {
    tone: string;
    addressing: string;
  };
  renderHint: string;
  examples: string[];
  stopCondition: StopCondition;

  // Optional LLM guidance (v0.2+)
  promptContext?: {
    role: string;
    task: string;
    constraints: string[];
    format: string;
  };
}
```

### FeedbackPayload

```typescript
interface FeedbackPayload {
  blueprintId: string;
  resolved: boolean;
  turnsToResolution?: number;
  phaseAdvanced?: boolean;
}
```

### BlueprintMetrics

```typescript
interface BlueprintMetrics {
  blueprintId: string;
  totalQuestions: number;
  resolvedCount: number;
  unresolvedCount: number;
  resolvedRate: number;           // 0-1
  avgTurnsToResolution: number;
  phaseAdvancedCount: number;
  phaseAdvancedRate: number;      // 0-1
  lastUsed: number;               // timestamp
}
```

---

## Errors

### Error Hierarchy

```typescript
import {
  HapError,
  NetworkError,
  ValidationError,
  ProtocolError,
  StopError,
  ConfigurationError
} from 'hap-sdk';
```

**`HapError`** - Base error class

**`NetworkError`** - Network/HTTP failures
- `message`: Error description
- `statusCode?`: HTTP status code
- `cause?`: Original error

**`ValidationError`** - Invalid input data
- `message`: What failed validation
- `errors?`: Detailed validation errors

**`ProtocolError`** - HAP protocol violations
- `message`: Protocol issue description

**`StopError`** - Stop condition violations
- `UnresolvedStopError`: Attempt to proceed without resolving

**`ConfigurationError`** - Invalid configuration
- `message`: Configuration issue

### Error Handling

```typescript
import { NetworkError, ValidationError } from 'hap-sdk';

try {
  const blueprint = await provider.requestInquiryBlueprint(request);
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Network issue:', error.message);
    console.error('Status:', error.statusCode);
  } else if (error instanceof ValidationError) {
    console.error('Invalid request:', error.errors);
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## Version History

| SDK Version | Protocol Version | Key Changes |
|-------------|------------------|-------------|
| 0.2.x       | 0.1              | LocalHapProvider, metadata helpers, selectors |
| 0.1.x       | 0.1              | Initial release |

---

## Related Documentation

- [Migration Guide](./MIGRATION.md) - Upgrading from v0.1.x
- [Local Development Guide](./LOCAL_DEVELOPMENT.md) - Using LocalHapProvider
- [README](../README.md) - Quick start and examples
- [CHANGELOG](../CHANGELOG.md) - Release notes

---

## Support

- **GitHub**: [Issues](https://github.com/humanagencyprotocol/hap-sdk-typescript/issues)
- **Protocol**: [humanagencyprotocol.org](https://humanagencyprotocol.org)
- **npm**: [hap-sdk](https://www.npmjs.com/package/hap-sdk)
