/**
 * QuestionSpecFactory - Converts InquiryBlueprint to QuestionSpec
 *
 * Transforms blueprints from HAP Service into local QuestionSpec format
 * for the integrator's Question Engine. Supports custom field transformers.
 *
 * @packageDocumentation
 */

import type { InquiryBlueprint, QuestionSpec } from "../types";
import { ValidationError } from "../types/errors";

/**
 * Transformer function for tone or addressing fields
 */
export type FieldTransformer = (value: string) => string;

/**
 * Configuration for QuestionSpecFactory
 */
export interface QuestionSpecFactoryConfig {
  /** Custom transformer for tone field */
  toneTransformer?: FieldTransformer;

  /** Custom transformer for addressing field */
  addressingTransformer?: FieldTransformer;
}

/**
 * Factory for converting InquiryBlueprint to QuestionSpec.
 *
 * Provides a clean mapping from service blueprints to local specs,
 * with optional custom transformers for field values.
 */
export class QuestionSpecFactory {
  private readonly toneTransformer?: FieldTransformer;
  private readonly addressingTransformer?: FieldTransformer;

  constructor(config: QuestionSpecFactoryConfig = {}) {
    this.toneTransformer = config.toneTransformer;
    this.addressingTransformer = config.addressingTransformer;
  }

  /**
   * Convert InquiryBlueprint to QuestionSpec
   *
   * @param blueprint - Blueprint from HAP Service
   * @returns QuestionSpec for local Question Engine
   * @throws ValidationError if blueprint has invalid field values
   */
  fromBlueprint(blueprint: InquiryBlueprint): QuestionSpec {
    try {
      // Extract tone from constraints
      let tone = blueprint.constraints.tone;
      if (this.toneTransformer) {
        tone = this.toneTransformer(tone);
      }

      // Validate tone is one of the allowed values
      if (!this.isValidTone(tone)) {
        throw new ValidationError(
          `Invalid tone value: "${tone}". Must be one of: facilitative, probing, directive`
        );
      }

      // Extract addressing from constraints
      let addressing = blueprint.constraints.addressing;
      if (this.addressingTransformer) {
        addressing = this.addressingTransformer(addressing);
      }

      // Validate addressing is one of the allowed values
      if (!this.isValidAddressing(addressing)) {
        throw new ValidationError(
          `Invalid addressing value: "${addressing}". Must be one of: individual, group`
        );
      }

      // Create QuestionSpec with deep copy of targetStructures
      const spec: QuestionSpec = {
        ladderStage: blueprint.ladderStage,
        targetStructures: [...blueprint.targetStructures], // Deep copy
        tone: tone as "facilitative" | "probing" | "directive",
        addressing: addressing as "individual" | "group",
        stopCondition: blueprint.stopCondition,
      };

      // Pass through optional v0.2 fields
      if (blueprint.promptContext) {
        spec.promptContext = blueprint.promptContext;
      }
      if (blueprint.examples) {
        spec.examples = [...blueprint.examples]; // Deep copy
      }

      return spec;
    } catch (error) {
      // Wrap transformer errors with context
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ValidationError(
        `Failed to convert blueprint "${blueprint.id}" to QuestionSpec: ${(error as Error).message}`,
        { cause: error }
      );
    }
  }

  /**
   * Validate tone value
   */
  private isValidTone(value: string): boolean {
    return ["facilitative", "probing", "directive"].includes(value);
  }

  /**
   * Validate addressing value
   */
  private isValidAddressing(value: string): boolean {
    return ["individual", "group"].includes(value);
  }
}

/**
 * Default factory instance (no transformers)
 */
export const defaultQuestionSpecFactory = new QuestionSpecFactory();
