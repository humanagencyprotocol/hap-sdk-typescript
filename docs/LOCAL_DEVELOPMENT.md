# Local Development Guide

This guide shows you how to develop and test HAP-enabled applications locally without connecting to a HAP service.

## Table of Contents

- [Quick Start](#quick-start)
- [Using LocalHapProvider](#using-localhapprovider)
- [Creating Blueprints](#creating-blueprints)
- [Selection Strategies](#selection-strategies)
- [Interpreting Metrics](#interpreting-metrics)
- [Best Practices](#best-practices)

---

## Quick Start

### 1. Install the SDK

```bash
npm install hap-sdk
```

### 2. Create a Blueprints Directory

```bash
mkdir blueprints
```

### 3. Add Seed Blueprints

The SDK comes with 13 seed blueprints in `node_modules/hap-sdk/blueprints/`. Copy them to your local directory:

```bash
cp -r node_modules/hap-sdk/blueprints/*.json ./blueprints/
```

### 4. Set Up LocalHapProvider

```typescript
import {
  LocalHapProvider,
  StopGuard,
  balancedSelector
} from 'hap-sdk';

const hapProvider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector
});

const stopGuard = new StopGuard({
  provider: hapProvider,
  questionEngine: yourQuestionEngine
});
```

---

## Using LocalHapProvider

### Configuration Options

```typescript
const provider = new LocalHapProvider({
  // Required: Path to blueprints directory or URL
  blueprintsPath: './blueprints',

  // Required: Blueprint selection strategy
  selector: balancedSelector,

  // Optional: Question outcome logger (auto-created if not provided)
  logger: myLogger,

  // Optional: Cache blueprints in memory (default: true)
  cache: true
});
```

### Loading Blueprints

LocalHapProvider loads blueprints from:

1. **Local directory** - All `.json` files in the specified path
2. **Remote URL** - Fetch from a URL (single blueprint or array)

```typescript
// From local directory
const provider1 = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector
});

// From remote URL
const provider2 = new LocalHapProvider({
  blueprintsPath: 'https://example.com/blueprints.json',
  selector: balancedSelector
});
```

### Blueprint Naming Convention

Blueprints follow the naming pattern:
```
{ladderStage}-{agencyMode}-{pattern}-v{version}.json
```

Examples:
- `meaning-convergent-ambiguous-v1.json`
- `purpose-reflective-values-v1.json`
- `action-convergent-details-v2.json`

---

## Creating Blueprints

### Blueprint Structure

```json
{
  "id": "meaning-convergent-ambiguous-v1",
  "intent": "clarify ambiguous language",
  "ladderStage": "meaning",
  "agencyMode": "convergent",
  "targetStructures": [
    "object_of_discussion",
    "pronoun_referent"
  ],
  "constraints": {
    "tone": "facilitative",
    "addressing": "individual"
  },
  "renderHint": "Ask for clarification",
  "examples": [
    "What do you mean by 'it'?",
    "Which one are you referring to?"
  ],
  "stopCondition": "meaning",
  "promptContext": {
    "role": "You are helping clarify ambiguous references.",
    "task": "Generate a question asking for specific clarification.",
    "constraints": [
      "Keep the question short and focused",
      "Use a facilitative tone"
    ],
    "format": "A single, direct question"
  }
}
```

### Field Descriptions

- **id**: Unique identifier (must match filename without `.json`)
- **intent**: Human-readable purpose
- **ladderStage**: `"meaning"` | `"purpose"` | `"intention"` | `"action"`
- **agencyMode**: `"convergent"` | `"reflective"`
- **targetStructures**: What the question should elicit
- **constraints**: Tone and addressing style
- **renderHint**: Short guidance for question generation
- **examples**: Example questions (for style reference, not templates)
- **stopCondition**: When to trigger this blueprint
- **promptContext**: LLM guidance (optional but recommended)

### Creating Custom Blueprints

1. **Identify the pattern** you want to address
2. **Choose the ladder stage** (meaning → purpose → intention → action)
3. **Select agency mode** (convergent for clarification, reflective for exploration)
4. **Write LLM guidance** in `promptContext`
5. **Add example questions** for style reference
6. **Test with real user input**

Example workflow:

```typescript
// 1. Create blueprint file
// blueprints/custom-pattern-v1.json

// 2. Test it
const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector
});

const request = {
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: true,
  stopPattern: 'custom-pattern'
};

const blueprint = await provider.requestInquiryBlueprint(request);
console.log('Selected blueprint:', blueprint.id);
```

---

## Selection Strategies

LocalHapProvider supports multiple blueprint selection strategies.

### Built-in Strategies

#### 1. Simple Latest Version

Always selects the newest version:

```typescript
import { simpleLatestVersionSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: simpleLatestVersionSelector
});
```

**Use when**: You want to always use the latest blueprints.

#### 2. Best Performance

Selects blueprints with highest success rate:

```typescript
import { bestPerformanceSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: bestPerformanceSelector
});
```

**Use when**: You want to maximize question resolution rate.

#### 3. Balanced (Recommended)

Balances performance with exploration (epsilon-greedy with ε=0.1):

```typescript
import { balancedSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector
});
```

**Use when**: You want to improve over time while exploring new blueprints.

#### 4. Context-Aware

Uses metadata (domain, complexity) for smarter selection:

```typescript
import { contextAwareSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: contextAwareSelector
});
```

**Use when**: You're providing rich metadata in requests.

#### 5. Epsilon-Greedy (Configurable)

```typescript
import { createEpsilonGreedySelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: createEpsilonGreedySelector(0.2) // 20% exploration
});
```

**Use when**: You want to tune exploration vs. exploitation.

#### 6. LRU (Least Recently Used)

Rotates through blueprints to gather more data:

```typescript
import { createLRUSelector } from 'hap-sdk';

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: createLRUSelector()
});
```

**Use when**: You want even data collection across all blueprints.

### Custom Selectors

Create your own selection logic:

```typescript
import type { BlueprintSelector } from 'hap-sdk';

const mySelector: BlueprintSelector = (candidates, request, metricsMap) => {
  // Your custom logic here
  // Example: Prefer blueprints with low usage count

  const sorted = candidates.sort((a, b) => {
    const metricsA = metricsMap.get(a.id);
    const metricsB = metricsMap.get(b.id);

    const countA = metricsA?.totalQuestions || 0;
    const countB = metricsB?.totalQuestions || 0;

    return countA - countB; // Prefer less-used blueprints
  });

  return sorted[0];
};

const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: mySelector
});
```

---

## Interpreting Metrics

LocalHapProvider integrates with `QuestionOutcomeLogger` to track blueprint performance.

### Accessing Metrics

```typescript
const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector
});

// Get metrics for all blueprints
const allMetrics = provider.getMetrics();

// Get metrics for a specific blueprint
const blueprintMetrics = provider.getMetrics('meaning-convergent-ambiguous-v1');
```

### Metrics Structure

```typescript
interface BlueprintMetrics {
  blueprintId: string;
  totalQuestions: number;      // How many times used
  resolvedCount: number;        // How many resolved
  unresolvedCount: number;      // How many unresolved
  resolvedRate: number;         // Success rate (0-1)
  avgTurnsToResolution: number; // Average conversation turns
  phaseAdvancedCount: number;   // How many advanced ladder
  phaseAdvancedRate: number;    // Advancement rate (0-1)
  lastUsed: number;             // Timestamp of last use
}
```

### Analyzing Performance

```typescript
const metrics = provider.getMetrics();

// Find best performing blueprints
const topBlueprints = Object.values(metrics)
  .sort((a, b) => b.resolvedRate - a.resolvedRate)
  .slice(0, 5);

console.log('Top 5 blueprints by resolution rate:');
topBlueprints.forEach(m => {
  console.log(`${m.blueprintId}: ${(m.resolvedRate * 100).toFixed(1)}%`);
});

// Find underperforming blueprints
const poorPerformers = Object.values(metrics)
  .filter(m => m.totalQuestions >= 10 && m.resolvedRate < 0.5);

console.log('Blueprints needing improvement:');
poorPerformers.forEach(m => {
  console.log(`${m.blueprintId}: ${(m.resolvedRate * 100).toFixed(1)}% (${m.totalQuestions} uses)`);
});
```

### Exporting Metrics

```typescript
import { QuestionOutcomeLogger } from 'hap-sdk';

const logger = new QuestionOutcomeLogger();

// Export to JSON
const exporter = {
  export: (stats) => {
    const data = JSON.stringify(stats, null, 2);
    require('fs').writeFileSync('./metrics.json', data);
  }
};

// Later...
const stats = logger.getStats();
exporter.export(stats);
```

---

## Best Practices

### 1. Start with Seed Blueprints

Use the provided 13 seed blueprints as a foundation:

```bash
cp -r node_modules/hap-sdk/blueprints/*.json ./blueprints/
```

### 2. Version Your Blueprints

When improving a blueprint, create a new version:

```bash
# Don't modify:
blueprints/meaning-convergent-ambiguous-v1.json

# Create new version:
blueprints/meaning-convergent-ambiguous-v2.json
```

### 3. Use Balanced Selection Initially

Start with `balancedSelector` to collect performance data:

```typescript
const provider = new LocalHapProvider({
  blueprintsPath: './blueprints',
  selector: balancedSelector  // Good default
});
```

### 4. Monitor Metrics Regularly

Check which blueprints perform well:

```typescript
setInterval(() => {
  const metrics = provider.getMetrics();
  const poor = Object.values(metrics)
    .filter(m => m.totalQuestions >= 10 && m.resolvedRate < 0.5);

  if (poor.length > 0) {
    console.warn('Low-performing blueprints detected:', poor);
  }
}, 3600000); // Check hourly
```

### 5. Test Blueprints Incrementally

Add blueprints one at a time and monitor:

```typescript
// Week 1: Use seed blueprints
// Week 2: Add custom meaning-stage blueprint
// Week 3: Add custom purpose-stage blueprint
// etc.
```

### 6. Provide Rich Metadata

Use metadata helpers for better selection:

```typescript
import {
  detectAmbiguityPattern,
  classifyDomain,
  estimateComplexity
} from 'hap-sdk';

const pattern = detectAmbiguityPattern(userInput);
const domain = classifyDomain(keywords);
const complexity = estimateComplexity({ hasAmbiguity: true });

const request = detector.createRequestWithMetadata({
  ladderStage: 'meaning',
  agencyMode: 'convergent',
  stopTrigger: true,
  stopPattern: pattern || undefined,
  domain,
  complexitySignal: complexity
});
```

### 7. Separate Development and Production

```typescript
const provider = process.env.NODE_ENV === 'production'
  ? new HapClient({ endpoint, apiKey })
  : new LocalHapProvider({ blueprintsPath: './blueprints', selector });
```

---

## Troubleshooting

### Blueprint Not Loading

**Problem**: Blueprint file exists but isn't being loaded.

**Solutions**:
1. Check filename matches pattern: `{stage}-{mode}-{pattern}-v{version}.json`
2. Verify JSON is valid: `cat blueprints/file.json | jq`
3. Check blueprint `id` matches filename (without `.json`)

### No Matching Blueprint

**Problem**: `No matching blueprints found for request`

**Solutions**:
1. Ensure you have blueprints for the requested stage+mode
2. Check `stopPattern` isn't too specific
3. Add fallback blueprints without patterns

### Selector Returns Null

**Problem**: Custom selector returns null or undefined

**Fix**: Always return a blueprint from candidates:

```typescript
const mySelector: BlueprintSelector = (candidates, request, metrics) => {
  if (candidates.length === 0) {
    throw new Error('No candidates provided');
  }

  // Your logic...

  return candidates[0]; // Always return something
};
```

---

## Next Steps

- Read the [Migration Guide](./MIGRATION.md) for upgrading from v0.1.x
- Review [API Documentation](./API.md) for detailed reference
- Check out [examples/](../examples/) for complete implementations
