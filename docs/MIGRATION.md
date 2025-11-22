# Migration Guide: v0.1.x → v0.2.x

This guide helps you upgrade from HAP SDK v0.1.x to v0.2.x.

## Overview

v0.2.x introduces:
- **LocalHapProvider** for local development
- **Metadata helpers** for pattern detection and classification
- **Provider abstraction** (HapProvider interface)
- **Breaking change**: StopGuard configuration

---

## Breaking Changes

### 1. StopGuard Configuration

**Breaking:** The `client` parameter has been renamed to `provider`.

#### v0.1.x (Old)

```typescript
import { HapClient, StopGuard } from 'hap-sdk';

const hapClient = new HapClient({ endpoint, apiKey });

const stopGuard = new StopGuard({
  client: hapClient,  // OLD
  questionEngine
});
```

#### v0.2.x (New)

```typescript
import { HapClient, StopGuard } from 'hap-sdk';

const hapProvider = new HapClient({ endpoint, apiKey });

const stopGuard = new StopGuard({
  provider: hapProvider,  // NEW
  questionEngine
});
```

**Why**: The provider abstraction allows both `HapClient` (production) and `LocalHapProvider` (development) to work with `StopGuard`.

**Migration steps**:
1. Rename `client` to `provider` in StopGuard config
2. Optionally rename variable from `hapClient` to `hapProvider`

---

## New Features

### 1. LocalHapProvider (No Breaking Changes)

**New in v0.2.x**: Develop locally without a HAP service.

```typescript
import { LocalHapProvider, balancedSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector
});

const stopGuard = new StopGuard({ provider, questionEngine });
```

**Migration**: Optional. Existing code using `HapClient` continues to work unchanged.

### 2. Metadata Helpers (No Breaking Changes)

**New in v0.2.x**: Auto-detect patterns, classify domains, estimate complexity.

```typescript
import {
  detectAmbiguityPattern,
  classifyDomain,
  estimateComplexity,
  StopDetector
} from 'hap-sdk';

const detector = new StopDetector();

// Old way (still works)
const request1 = detector.createRequest({
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: true
});

// New way (enhanced)
const pattern = detectAmbiguityPattern(userInput);
const domain = classifyDomain(['code', 'test']);
const complexity = estimateComplexity({ hasAmbiguity: true });

const request2 = detector.createRequestWithMetadata({
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: true,
  stopPattern: pattern || undefined,
  domain,
  complexitySignal: complexity
});
```

**Migration**: Optional. Use `createRequestWithMetadata` for better blueprint selection.

### 3. Selection Strategies (No Breaking Changes)

**New in v0.2.x**: Multiple built-in blueprint selection strategies.

```typescript
import {
  simpleLatestVersionSelector,
  bestPerformanceSelector,
  balancedSelector,
  contextAwareSelector,
  createEpsilonGreedySelector,
  createLRUSelector
} from 'hap-sdk';

// Use with LocalHapProvider
const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector  // Choose your strategy
});
```

**Migration**: Only needed if using LocalHapProvider.

---

## Migration Checklist

### Minimal Migration (Breaking Changes Only)

- [ ] Replace `client:` with `provider:` in StopGuard config
- [ ] Test that existing functionality works
- [ ] Done!

### Full Migration (Adopt New Features)

- [ ] Replace `client:` with `provider:` in StopGuard config
- [ ] Set up LocalHapProvider for development
- [ ] Copy seed blueprints to local directory
- [ ] Choose a selection strategy
- [ ] Add metadata helpers to detection logic
- [ ] Use `createRequestWithMetadata` in your code
- [ ] Monitor metrics and optimize
- [ ] Update tests to use LocalHapProvider

---

## Step-by-Step Migration

### Step 1: Update Dependencies

```bash
npm install hap-sdk@^0.2.0
```

### Step 2: Fix Breaking Changes

```typescript
// Before (v0.1.x)
const stopGuard = new StopGuard({
  client: hapClient,
  questionEngine
});

// After (v0.2.x)
const stopGuard = new StopGuard({
  provider: hapProvider,  // Just rename this parameter
  questionEngine
});
```

### Step 3: Test Existing Functionality

```bash
npm test
```

Your existing code should work without other changes.

### Step 4: (Optional) Add Local Development

```typescript
// Add environment-based provider selection
const hapProvider = process.env.NODE_ENV === 'production'
  ? new HapClient({ endpoint: process.env.HAP_ENDPOINT!, apiKey: process.env.HAP_API_KEY! })
  : new LocalHapProvider({ blueprintsPath: './blueprints', selector: balancedSelector });

const stopGuard = new StopGuard({ provider: hapProvider, questionEngine });
```

### Step 5: (Optional) Add Metadata Helpers

```typescript
import { detectAmbiguityPattern, classifyDomain, estimateComplexity } from 'hap-sdk';

// In your stop detection logic:
const pattern = detectAmbiguityPattern(userInput);
const domain = classifyDomain(extractKeywords(context));
const complexity = estimateComplexity({
  numEntities: countEntities(context),
  hasAmbiguity: pattern !== null,
  priorStops: sessionData.stopCount
});

const request = detector.createRequestWithMetadata({
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: isAmbiguous,
  stopPattern: pattern || undefined,
  domain,
  complexitySignal: complexity
});
```

---

## Code Examples

### Before (v0.1.x)

```typescript
import { HapClient, StopGuard, StopDetector } from 'hap-sdk';

const hapClient = new HapClient({
  endpoint: process.env.HAP_ENDPOINT!,
  apiKey: process.env.HAP_API_KEY!
});

const stopGuard = new StopGuard({
  client: hapClient,  // OLD parameter name
  questionEngine
});

const detector = new StopDetector();

const request = detector.createRequest({
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: detectAmbiguity(context)
});

const result = await stopGuard.ensureClarified(context, request);
```

### After (v0.2.x) - Minimal Changes

```typescript
import { HapClient, StopGuard, StopDetector } from 'hap-sdk';

const hapProvider = new HapClient({
  endpoint: process.env.HAP_ENDPOINT!,
  apiKey: process.env.HAP_API_KEY!
});

const stopGuard = new StopGuard({
  provider: hapProvider,  // NEW parameter name
  questionEngine
});

const detector = new StopDetector();

const request = detector.createRequest({
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: detectAmbiguity(context)
});

const result = await stopGuard.ensureClarified(context, request);
```

### After (v0.2.x) - With New Features

```typescript
import {
  HapClient,
  LocalHapProvider,
  StopGuard,
  StopDetector,
  balancedSelector,
  detectAmbiguityPattern,
  classifyDomain,
  estimateComplexity
} from 'hap-sdk';

// Environment-based provider
const hapProvider = process.env.NODE_ENV === 'production'
  ? new HapClient({
      endpoint: process.env.HAP_ENDPOINT!,
      apiKey: process.env.HAP_API_KEY!
    })
  : new LocalHapProvider({
      blueprintsPath: './blueprints',
      selector: balancedSelector
    });

const stopGuard = new StopGuard({
  provider: hapProvider,
  questionEngine
});

const detector = new StopDetector();

// Enhanced with metadata
const pattern = detectAmbiguityPattern(userInput);
const domain = classifyDomain(extractKeywords(context));
const complexity = estimateComplexity({
  hasAmbiguity: pattern !== null,
  numEntities: 5
});

const request = detector.createRequestWithMetadata({
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: pattern !== null,
  stopPattern: pattern || undefined,
  domain,
  complexitySignal: complexity
});

const result = await stopGuard.ensureClarified(context, request);
```

---

## TypeScript Changes

### New Types

```typescript
// HapProvider interface (abstraction)
interface HapProvider {
  requestInquiryBlueprint(request: InquiryRequest): Promise<InquiryBlueprint>;
  sendFeedback(payload: FeedbackPayload): Promise<void>;
}

// BlueprintSelector (for LocalHapProvider)
type BlueprintSelector = (
  candidates: InquiryBlueprint[],
  request: InquiryRequest,
  metricsMap: Map<string, BlueprintMetrics>
) => InquiryBlueprint;

// Extended InquiryRequest (optional metadata)
interface InquiryRequest {
  ladderStage: LadderStage;
  agencyMode: AgencyMode;
  stopTrigger: boolean;
  stopCondition?: StopCondition;

  // New optional fields in v0.2.x
  stopPattern?: string;
  domain?: string;
  complexitySignal?: number;
  sessionContext?: {
    previousStops: number;
    consecutiveStops: number;
    averageResolutionTurns: number;
  };
}
```

### Type Compatibility

All v0.1.x types remain compatible. New fields are optional.

---

## Testing Migration

### Update Test Setup

```typescript
// Before (v0.1.x)
import { HapClient } from 'hap-sdk';

const mockClient = {
  requestInquiryBlueprint: vi.fn(),
  sendFeedback: vi.fn()
};

const stopGuard = new StopGuard({
  client: mockClient,
  questionEngine
});

// After (v0.2.x) - Option 1: Update parameter name
const stopGuard = new StopGuard({
  provider: mockClient,  // Just rename
  questionEngine
});

// After (v0.2.x) - Option 2: Use LocalHapProvider
import { LocalHapProvider, balancedSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './test/fixtures/blueprints',
  selector: balancedSelector
});

const stopGuard = new StopGuard({ provider, questionEngine });
```

---

## Common Issues

### Issue 1: "Property 'client' does not exist on type 'StopGuardConfig'"

**Cause**: Using old parameter name.

**Fix**:
```typescript
// Change this:
const stopGuard = new StopGuard({ client: hapClient, questionEngine });

// To this:
const stopGuard = new StopGuard({ provider: hapProvider, questionEngine });
```

### Issue 2: Type errors with InquiryRequest

**Cause**: TypeScript sees new optional fields.

**Fix**: No action needed. Optional fields don't break existing code. To use them:

```typescript
const request: InquiryRequest = {
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: true,
  // New fields are optional
  stopPattern: 'ambiguous-pronoun',  // Optional
  domain: 'software-development'      // Optional
};
```

### Issue 3: LocalHapProvider - "No matching blueprints found"

**Cause**: No blueprints match the request.

**Fix**: Ensure blueprints directory has files for the requested stage+mode:

```bash
ls blueprints/meaning-convergent-*.json
ls blueprints/purpose-*.json
```

Copy seed blueprints if missing:

```bash
cp -r node_modules/hap-sdk/blueprints/*.json ./blueprints/
```

---

## Rollback Plan

If you encounter issues, you can roll back:

```bash
npm install hap-sdk@^0.1.0
```

Then revert the `client` → `provider` rename:

```typescript
const stopGuard = new StopGuard({
  client: hapClient,  // v0.1.x parameter name
  questionEngine
});
```

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/humanagencyprotocol/hap-sdk-typescript/issues)
- **Docs**: [Local Development Guide](./LOCAL_DEVELOPMENT.md)
- **Examples**: [examples/](../examples/)

---

## Summary

**Required changes**:
- Rename `client:` to `provider:` in StopGuard config

**Recommended additions**:
- Use LocalHapProvider for local development
- Use metadata helpers for better blueprint selection
- Monitor metrics and optimize over time

The migration is straightforward—most code works unchanged except for the one parameter rename.
