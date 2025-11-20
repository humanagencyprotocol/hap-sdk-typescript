/**
 * HAP SDK - TypeScript SDK for the Human Agency Protocol
 *
 * @packageDocumentation
 */

// Types
export * from './types';

// Core modules
export { HapClient } from './hap-client/HapClient';
export { StopGuard } from './runtime-guards/StopGuard';
export { QuestionSpecFactory } from './question-spec/QuestionSpecFactory';
export { QuestionOutcomeLogger } from './metrics/QuestionOutcomeLogger';

// Version
export const VERSION = '0.1.0';
export const PROTOCOL_VERSION = '0.1';
