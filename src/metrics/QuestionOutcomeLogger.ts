/**
 * QuestionOutcomeLogger - Local metrics for question optimization
 *
 * Tracks structural outcomes from Stop→Ask→Proceed cycles.
 * All data is structural - no semantic content allowed.
 *
 * @packageDocumentation
 */

import type { QuestionOutcome, LadderStage } from "../types";

/**
 * Aggregated statistics from question outcomes
 */
export interface QuestionStats {
  /** Total number of outcomes */
  total: number;

  /** Percentage of stops that were resolved (0-1) */
  resolvedRate: number;

  /** Average turns to resolution (only resolved stops) */
  avgTurnsToResolution: number;

  /** Percentage of stops that advanced to next phase (0-1) */
  phaseAdvancedRate: number;

  /** Total resolved stops */
  totalResolved: number;

  /** Total unresolved stops */
  totalUnresolved: number;
}

/**
 * Exporter function for outcomes
 *
 * Called when logger.export() is invoked.
 * Receives structural outcomes only - no semantic content.
 */
export type OutcomeExporter = (outcomes: readonly QuestionOutcome[]) => void | Promise<void>;

/**
 * QuestionOutcomeLogger - Tracks structural question metrics
 *
 * Maintains an in-memory buffer of QuestionOutcome records for
 * local optimization. All data is structural - no user content.
 *
 * Use this to:
 * - Track question effectiveness per ladder stage
 * - Monitor resolution rates and turn counts
 * - Export metrics to your analytics system
 */
export class QuestionOutcomeLogger {
  private buffer: QuestionOutcome[] = [];
  private readonly maxBufferSize: number;

  /**
   * Create a new logger
   *
   * @param maxBufferSize - Maximum outcomes to store (default: 1000)
   */
  constructor(maxBufferSize = 1000) {
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Log a question outcome
   *
   * @param outcome - Structural outcome (no semantic content)
   */
  log(outcome: QuestionOutcome): void {
    this.buffer.push(outcome);

    // Trim buffer if it exceeds max size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift(); // Remove oldest
    }
  }

  /**
   * Get aggregated statistics for all outcomes
   *
   * @returns Aggregate stats
   */
  getStats(): QuestionStats {
    return this.computeStats(this.buffer);
  }

  /**
   * Get statistics filtered by ladder stage
   *
   * @param stage - Ladder stage to filter by
   * @returns Aggregate stats for the specified stage
   */
  getStatsByStage(stage: LadderStage): QuestionStats {
    const filtered = this.buffer.filter((o) => o.ladderStage === stage);
    return this.computeStats(filtered);
  }

  /**
   * Get all outcomes in buffer (read-only)
   *
   * @returns Frozen copy of outcomes
   */
  getBuffer(): readonly QuestionOutcome[] {
    return Object.freeze([...this.buffer]);
  }

  /**
   * Export outcomes to external system
   *
   * @param exporter - Function to export outcomes
   */
  async export(exporter: OutcomeExporter): Promise<void> {
    await exporter(this.getBuffer());
  }

  /**
   * Clear all outcomes from buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Compute statistics from outcomes
   */
  private computeStats(outcomes: QuestionOutcome[]): QuestionStats {
    if (outcomes.length === 0) {
      return {
        total: 0,
        resolvedRate: 0,
        avgTurnsToResolution: 0,
        phaseAdvancedRate: 0,
        totalResolved: 0,
        totalUnresolved: 0,
      };
    }

    const resolved = outcomes.filter((o) => o.stopResolved);
    const totalResolved = resolved.length;
    const totalUnresolved = outcomes.length - totalResolved;

    const resolvedRate = totalResolved / outcomes.length;

    const avgTurnsToResolution =
      totalResolved > 0
        ? resolved.reduce((sum, o) => sum + o.turnsToResolution, 0) /
          totalResolved
        : 0;

    const phaseAdvanced = outcomes.filter((o) => o.phaseAdvanced).length;
    const phaseAdvancedRate = phaseAdvanced / outcomes.length;

    return {
      total: outcomes.length,
      resolvedRate,
      avgTurnsToResolution,
      phaseAdvancedRate,
      totalResolved,
      totalUnresolved,
    };
  }
}
