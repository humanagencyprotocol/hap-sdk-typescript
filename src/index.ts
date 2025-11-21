/**
 * HAP SDK - TypeScript SDK for the Human Agency Protocol
 *
 * Enforces Stop→Ask→Proceed to keep AI aligned with human meaning.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types & Schemas
// ============================================================================

// Core structural types
export * from './types';

// ============================================================================
// Client & Communication
// ============================================================================

export { HapClient } from './hap-client/HapClient';
export type { HapClientConfig } from './hap-client/HapClient';

// ============================================================================
// Runtime Enforcement
// ============================================================================

export { StopGuard } from './runtime-guards/StopGuard';
export type {
  ClarificationResult,
  StopGuardMiddleware,
  StopGuardConfig,
} from './runtime-guards/StopGuard';

export {
  StopDetector,
  createManualDetector,
  createDetectorWithStrategy,
} from './runtime-guards/StopDetector';
export type {
  StopAnalysis,
  StopDetectionStrategy,
  StopDetectorConfig,
} from './runtime-guards/StopDetector';

export {
  GuardedAction,
  isStopped,
  isResolved,
} from './runtime-guards/GuardedAction';
export type {
  StoppedAction,
  ResolvedAction,
} from './runtime-guards/GuardedAction';

// ============================================================================
// Question Spec Conversion
// ============================================================================

export {
  QuestionSpecFactory,
  defaultQuestionSpecFactory,
} from './question-spec/QuestionSpecFactory';
export type {
  FieldTransformer,
  QuestionSpecFactoryConfig,
} from './question-spec/QuestionSpecFactory';

// ============================================================================
// Metrics & Logging
// ============================================================================

export { QuestionOutcomeLogger } from './metrics/QuestionOutcomeLogger';
export type {
  QuestionStats,
  OutcomeExporter,
} from './metrics/QuestionOutcomeLogger';

// ============================================================================
// Version Information
// ============================================================================

export const VERSION = '0.1.0';
export const PROTOCOL_VERSION = '0.1';
