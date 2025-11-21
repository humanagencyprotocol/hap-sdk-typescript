# Changelog

All notable changes to the HAP SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-11-21

### Added

#### Core Types & Validation
- Complete TypeScript type definitions for HAP v0.1
- Zod schema validation for all protocol types
- Error taxonomy: `NetworkError`, `ValidationError`, `ProtocolError`, `StopError`, `ConfigurationError`
- Comprehensive type safety tests (43 tests)

#### HAP Client
- `HapClient` for HAP Service integration
- Request/response handling with validation
- Retry logic with exponential backoff (1s, 2s, 4s)
- Circuit breaker pattern for service degradation
- API key protection (never leaked in logs/errors)
- 14 tests covering success/failure/security scenarios

#### Runtime Enforcement
- `StopGuard` - Core Stop→Ask→Proceed enforcement
  - `ensureClarified()` method with privacy guarantee
  - Middleware hooks for observability
  - Context never sent to HAP (architectural guarantee)
  - 22 tests with 100% coverage of enforcement logic

- `StopDetector` - Stop condition detection helpers
  - Manual request creation with validation
  - Pluggable custom detection strategies
  - Validates ladder stages and agency modes
  - 26 tests covering all validation scenarios

- `GuardedAction` - Type-safe enforcement mechanism
  - `StoppedAction` type without `proceed()` method
  - `ResolvedAction` type with `proceed()` method
  - Runtime enforcement throws `UnresolvedStopError`
  - Type guards for stopped/resolved checking
  - 27 tests proving enforcement works

#### Question Spec Conversion
- `QuestionSpecFactory` - Blueprint → QuestionSpec mapping
- Custom transformers for tone and addressing fields
- Deep copy of target structures (prevents mutation)
- Validation of all constraint values
- 27 tests covering conversion and transformation

#### Metrics & Logging
- `QuestionOutcomeLogger` - Local metrics tracking
- In-memory buffer with configurable size (default: 1000)
- Statistics aggregation: `getStats()` and `getStatsByStage()`
- Privacy-first design (no semantic content)
- Export functionality for analytics systems
- 22 tests verifying privacy and accuracy

#### Examples & Documentation
- Basic Node.js example with interactive CLI
- Next.js API route example for production use
- Comprehensive examples README with troubleshooting
- 9 E2E tests verifying examples work correctly

### Features

- **Stop→Ask→Proceed Enforcement:** TypeScript + runtime enforcement prevents bypassing
- **Privacy by Architecture:** Context never leaves local system
- **Retry & Circuit Breaker:** Resilient network handling
- **Local Optimization:** Track question effectiveness
- **Framework Agnostic:** Works with any JS/TS environment
- **Full Type Safety:** Strict TypeScript with comprehensive types

### Test Coverage

- **Total Tests:** 190 tests passing
- **Coverage Targets:**
  - Overall: 85%+
  - Runtime Guards: 100% (enforcement logic is critical)
  - Types: 95%+
  - HAP Client: 90%+
- **Test Categories:**
  - Unit tests: 172
  - Integration tests: 9
  - E2E tests: 9

### Documentation

- Complete API documentation
- Example integrations (Node.js, Next.js)
- Privacy architecture explanation
- Troubleshooting guide
- Protocol specification links

### Build & Distribution

- ESM, CJS, and TypeScript declaration files
- Published to npm as `hap-sdk`
- Compatible with Node.js 18+
- Single runtime dependency (`zod`) with permissive MIT license

### Security

- API keys never leaked in errors or logs
- Semantic content never transmitted to HAP Service
- Schema validation prevents content injection
- Type system prevents semantic fields in structural payloads

## [0.0.1] - 2025-11-13

### Added
- Initial project setup
- Repository structure
- Build configuration

---

## Version Mapping

| SDK Version | Protocol Version | Status |
|-------------|------------------|--------|
| 0.1.0       | 0.1              | ✅ Released |
| 0.2.x       | 0.1              | 📅 Planned (enforcement hardening) |

---

## Upgrade Guide

### From 0.0.x to 0.1.0

This is the first public release. No upgrade path from pre-release versions.

**Installation:**
```bash
npm install hap-sdk@0.1.0
```

**Basic Usage:**
```typescript
import { HapClient, StopGuard } from 'hap-sdk';

const client = new HapClient({
  endpoint: process.env.HAP_ENDPOINT,
  apiKey: process.env.HAP_API_KEY,
});

const stopGuard = new StopGuard({
  client,
  questionEngine: yourQuestionEngine,
});

const result = await stopGuard.ensureClarified(context, request);
```

See [examples/](./examples/) for complete integration examples.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## Links

- [GitHub Repository](https://github.com/humanagencyprotocol/hap-sdk-typescript)
- [Protocol Specification](https://humanagencyprotocol.org)
- [npm Package](https://www.npmjs.com/package/hap-sdk)
- [Issue Tracker](https://github.com/humanagencyprotocol/hap-sdk-typescript/issues)
