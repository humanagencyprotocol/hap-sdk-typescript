/**
 * Blueprint loading utilities for LocalHapProvider.
 *
 * Handles loading blueprints from local filesystem or remote URLs.
 * Validates blueprint structure using Zod schemas.
 *
 * @packageDocumentation
 */

import * as fs from "fs";
import * as path from "path";
import type { InquiryBlueprint } from "../types/index";
import { InquiryBlueprintSchema } from "../types/schemas";

/**
 * Load a single blueprint from a file path.
 *
 * @param filePath - Absolute path to blueprint JSON file
 * @returns Validated blueprint
 * @throws {Error} If file doesn't exist, can't be read, or validation fails
 *
 * @internal
 */
export async function loadBlueprintFromFile(
  filePath: string
): Promise<InquiryBlueprint> {
  try {
    // Read file
    const fileContent = await fs.promises.readFile(filePath, "utf-8");

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(fileContent);
    } catch (parseError) {
      throw new Error(
        `Failed to parse blueprint JSON from ${filePath}: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      );
    }

    // Validate with Zod schema
    const result = InquiryBlueprintSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Blueprint validation failed for ${filePath}: ${result.error.message}`
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw validation or parse errors as-is
      if (
        error.message.includes("validation failed") ||
        error.message.includes("Failed to parse")
      ) {
        throw error;
      }
      // Wrap filesystem errors
      throw new Error(
        `Failed to load blueprint from ${filePath}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Load all blueprints from a directory.
 *
 * Scans the directory for .json files, loads and validates each one.
 * Skips files that fail to load/validate and continues with others.
 *
 * @param dirPath - Absolute path to directory containing blueprint JSON files
 * @returns Array of validated blueprints
 * @throws {Error} If directory doesn't exist or can't be read
 *
 * @internal
 */
export async function loadBlueprintsFromDirectory(
  dirPath: string
): Promise<InquiryBlueprint[]> {
  try {
    // Check if directory exists
    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    // Read directory contents
    const files = await fs.promises.readdir(dirPath);

    // Filter for .json files
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    if (jsonFiles.length === 0) {
      console.warn(
        `[LocalHapProvider] No .json files found in directory: ${dirPath}`
      );
      return [];
    }

    // Load all blueprints
    const blueprints: InquiryBlueprint[] = [];
    const errors: string[] = [];

    for (const file of jsonFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const blueprint = await loadBlueprintFromFile(filePath);
        blueprints.push(blueprint);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        errors.push(`${file}: ${errorMsg}`);
        console.warn(
          `[LocalHapProvider] Skipping invalid blueprint file ${file}: ${errorMsg}`
        );
      }
    }

    // If ALL files failed, throw error
    if (blueprints.length === 0 && errors.length > 0) {
      throw new Error(
        `Failed to load any blueprints from ${dirPath}. Errors:\n${errors.join("\n")}`
      );
    }

    console.log(
      `[LocalHapProvider] Loaded ${blueprints.length} blueprints from ${dirPath}` +
        (errors.length > 0 ? ` (skipped ${errors.length} invalid files)` : "")
    );

    return blueprints;
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw our custom errors as-is
      if (
        error.message.includes("Failed to load any blueprints") ||
        error.message.includes("not a directory")
      ) {
        throw error;
      }
      // Wrap filesystem errors
      throw new Error(
        `Failed to read directory ${dirPath}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Load blueprints from a remote URL.
 *
 * Fetches blueprint JSON from a URL and validates it.
 * The URL can return either:
 * - A single blueprint object
 * - An array of blueprint objects
 *
 * @param url - URL to fetch blueprints from
 * @returns Array of validated blueprints
 * @throws {Error} If fetch fails or validation fails
 *
 * @internal
 */
export async function loadBlueprintsFromURL(
  url: string
): Promise<InquiryBlueprint[]> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Handle both single blueprint and array of blueprints
    const blueprintsData = Array.isArray(data) ? data : [data];

    // Validate each blueprint
    const blueprints: InquiryBlueprint[] = [];
    const errors: string[] = [];

    for (let i = 0; i < blueprintsData.length; i++) {
      const result = InquiryBlueprintSchema.safeParse(blueprintsData[i]);
      if (!result.success) {
        errors.push(`Blueprint ${i}: ${result.error.message}`);
      } else {
        blueprints.push(result.data);
      }
    }

    if (blueprints.length === 0) {
      throw new Error(
        `Failed to validate any blueprints from ${url}. Errors:\n${errors.join("\n")}`
      );
    }

    if (errors.length > 0) {
      console.warn(
        `[LocalHapProvider] Loaded ${blueprints.length} blueprints from ${url} (skipped ${errors.length} invalid)`
      );
    } else {
      console.log(
        `[LocalHapProvider] Loaded ${blueprints.length} blueprints from ${url}`
      );
    }

    return blueprints;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load blueprints from ${url}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Determine if a source string is a URL or local path.
 *
 * @param source - Blueprint source (URL or path)
 * @returns true if source is a URL, false if it's a local path
 *
 * @internal
 */
export function isURL(source: string): boolean {
  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Load blueprints from either a local directory or remote URL.
 *
 * Automatically detects whether the source is a URL or local path.
 *
 * @param source - Blueprint source (URL or local directory path)
 * @returns Array of validated blueprints
 * @throws {Error} If loading or validation fails
 *
 * @internal
 */
export async function loadBlueprints(
  source: string
): Promise<InquiryBlueprint[]> {
  if (isURL(source)) {
    return loadBlueprintsFromURL(source);
  } else {
    // Resolve relative paths
    const resolvedPath = path.resolve(source);
    return loadBlueprintsFromDirectory(resolvedPath);
  }
}
