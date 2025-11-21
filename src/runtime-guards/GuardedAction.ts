/**
 * GuardedAction - Type-safe enforcement of Stop→Ask→Proceed
 *
 * Provides compile-time and runtime enforcement that actions cannot
 * proceed without resolving stop conditions.
 *
 * This is the enforcement mechanism that makes bypassing the protocol
 * difficult and obvious.
 *
 * @packageDocumentation
 */

import { UnresolvedStopError } from "../types/errors";
import type { LadderStage } from "../types";

/**
 * Result of a stopped action (clarification needed)
 *
 * This type intentionally does NOT have a proceed() method.
 * The only way to proceed is to resolve the stop condition.
 */
export interface StoppedAction {
  readonly stopped: true;
  readonly question: string;
  readonly blueprintId: string;
  readonly ladderStage: LadderStage;

  /**
   * Resolve the stop condition and enable proceeding
   *
   * @param answer - User's answer to the clarification question
   * @returns ResolvedAction that can proceed
   */
  resolve(answer: string): ResolvedAction;
}

/**
 * Result of a resolved action (can proceed)
 *
 * Only this type has a proceed() method.
 */
export interface ResolvedAction {
  readonly stopped: false;
  readonly answer?: string;

  /**
   * Proceed with the action now that clarification is complete
   *
   * @param action - The action to execute
   * @returns Result of the action
   */
  proceed<T>(action: () => T | Promise<T>): Promise<T>;
}

/**
 * GuardedAction - Enforces Stop→Ask→Proceed at the type level
 *
 * Creates actions that cannot proceed without resolving stop conditions.
 * This provides compile-time safety against bypassing the protocol.
 *
 * @example
 * ```typescript
 * const guard = GuardedAction.create({
 *   question: "What should we build?",
 *   blueprintId: "bp-123",
 *   ladderStage: "meaning"
 * });
 *
 * // TypeScript error: proceed() doesn't exist on StoppedAction
 * // guard.proceed(() => buildSomething());
 *
 * // Must resolve first
 * const resolved = guard.resolve(userAnswer);
 * const result = await resolved.proceed(() => buildSomething());
 * ```
 */
export class GuardedAction {
  /**
   * Create a stopped action that requires clarification
   *
   * @param params - Stop condition details
   * @returns StoppedAction that must be resolved before proceeding
   */
  static create(params: {
    question: string;
    blueprintId: string;
    ladderStage: LadderStage;
  }): StoppedAction {
    return new StoppedActionImpl(
      params.question,
      params.blueprintId,
      params.ladderStage
    );
  }

  /**
   * Create an already-resolved action (no stop condition)
   *
   * @returns ResolvedAction that can proceed immediately
   */
  static createResolved(): ResolvedAction {
    return new ResolvedActionImpl(undefined);
  }

  /**
   * Create from clarification result
   *
   * This is a convenience method for integrating with StopGuard.
   *
   * @param result - Clarification result from StopGuard
   * @returns StoppedAction or ResolvedAction depending on clarified status
   */
  static fromClarificationResult(result: {
    clarified: boolean;
    question?: string;
    blueprintId?: string;
    ladderStage?: LadderStage;
  }): StoppedAction | ResolvedAction {
    if (result.clarified) {
      return GuardedAction.createResolved();
    }

    if (!result.question || !result.blueprintId || !result.ladderStage) {
      throw new Error(
        "Unclarified result must include question, blueprintId, and ladderStage"
      );
    }

    return GuardedAction.create({
      question: result.question,
      blueprintId: result.blueprintId,
      ladderStage: result.ladderStage,
    });
  }
}

/**
 * Implementation of StoppedAction
 */
class StoppedActionImpl implements StoppedAction {
  readonly stopped = true as const;

  constructor(
    readonly question: string,
    readonly blueprintId: string,
    readonly ladderStage: LadderStage
  ) {}

  resolve(answer: string): ResolvedAction {
    return new ResolvedActionImpl(answer);
  }

  /**
   * Runtime enforcement: Throw error if someone tries to proceed without resolving
   *
   * This method doesn't exist in the interface, but we add it for runtime safety.
   * TypeScript will prevent calling it, but if someone bypasses TypeScript,
   * this will throw.
   */
  proceed(): never {
    throw new UnresolvedStopError({
      stopCondition: "both",
      ladderStage: this.ladderStage,
    });
  }
}

/**
 * Implementation of ResolvedAction
 */
class ResolvedActionImpl implements ResolvedAction {
  readonly stopped = false as const;

  constructor(readonly answer?: string) {}

  async proceed<T>(action: () => T | Promise<T>): Promise<T> {
    return await action();
  }
}

/**
 * Type guard to check if action is stopped
 */
export function isStopped(
  action: StoppedAction | ResolvedAction
): action is StoppedAction {
  return action.stopped === true;
}

/**
 * Type guard to check if action is resolved
 */
export function isResolved(
  action: StoppedAction | ResolvedAction
): action is ResolvedAction {
  return action.stopped === false;
}
