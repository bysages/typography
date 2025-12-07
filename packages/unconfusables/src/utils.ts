/**
 * Unicode Confusables Utility Functions
 */

import type {
  ConfusableRecord,
  ConfusableType,
  RandomConfusableOptions,
} from "./types";
import { confusables } from "./data";

// Get confusable mapping for a character
export function getConfusables(char: string): ConfusableRecord | null {
  if (char.length === 0) return null;

  return confusables.confusables[char[0]] || null;
}

// Get all characters that can be confusable with the given character
export function getConfusableSources(char: string): string[] {
  if (char.length === 0) return [];

  return confusables.reverseLookup[char[0]] || [];
}

// Normalize string by replacing confusable characters with their targets
export function normalizeString(
  text: string,
  type: ConfusableType = "MA",
): string {
  return text
    .split("")
    .map((char) => {
      const confusable = confusables.confusables[char];
      if (confusable && confusable.type === type) {
        return confusable.target[0];
      }
      return char;
    })
    .join("");
}

// Normalize string using all confusable types
export function normalizeStringAll(text: string): string {
  return text
    .split("")
    .map((char) => {
      const confusable = confusables.confusables[char];
      if (confusable) {
        return confusable.target[0];
      }
      return char;
    })
    .join("");
}

// Check if two strings are confusable with each other
export function areConfusable(
  str1: string,
  str2: string,
  type: ConfusableType = "MA",
): boolean {
  const normalized1 = normalizeString(str1, type);
  const normalized2 = normalizeString(str2, type);
  return normalized1 === normalized2;
}

// Get all possible confusable variations of a string
export function getConfusableVariations(
  text: string,
  type: ConfusableType = "MA",
): string[] {
  const variations = new Set<string>();
  variations.add(text);

  const chars = text.split("");
  const positions: number[][] = [];

  for (let i = 0; i < chars.length; i++) {
    const confusable = confusables.confusables[chars[i]];
    if (
      confusable &&
      confusable.type === type &&
      confusable.target.length > 0
    ) {
      positions.push([i, confusable.target.length]);
    }
  }

  for (const [pos] of positions) {
    const confusable = confusables.confusables[chars[pos]];
    for (const target of confusable!.target) {
      const variation = chars.slice();
      variation[pos] = target;
      variations.add(variation.join(""));
    }
  }

  return Array.from(variations);
}

// Replace character with random confusable
export function getRandomConfusable(
  char: string,
  options: RandomConfusableOptions = {},
): string {
  if (char.length === 0) return char;

  const confusable = confusables.confusables[char];
  if (!confusable || confusable.target.length === 0) return char;

  // Filter by type if specified
  if (options.type && confusable.type !== options.type) return char;

  // Filter out excluded characters
  let targets = confusable.target;
  if (options.exclude) {
    targets = targets.filter((target) => !options.exclude!.has(target));
    if (targets.length === 0) return char;
  }

  const randomIndex = Math.floor(Math.random() * targets.length);
  return targets[randomIndex];
}

// Randomly replace characters in string
export function randomizeConfusables(
  text: string,
  options: RandomConfusableOptions & { probability?: number } = {},
): string {
  const probability = options.probability ?? 0.5;

  return text
    .split("")
    .map((char) => {
      if (Math.random() < probability) {
        return getRandomConfusable(char, options);
      }
      return char;
    })
    .join("");
}

// Get metadata about the confusables dataset
export function getMetadata() {
  const typeStats = { MA: 0, MI: 0, X: 0 };
  for (const record of Object.values(confusables.confusables)) {
    typeStats[record.type]++;
  }

  return {
    version: confusables.version,
    date: confusables.date,
    totalMappings: Object.keys(confusables.confusables).length,
    reverseLookupEntries: Object.keys(confusables.reverseLookup).length,
    typeDistribution: typeStats,
  };
}
