/**
 * Unicode Confusables Utility Functions
 *
 * All string iteration is code-point based (astral-plane safe), and
 * normalization follows the UTS #39 skeleton algorithm: NFD, apply the
 * confusable mapping, then NFD again.
 */

import {
  confusables,
  defaultIgnorable,
  getReverseLookup,
  intentional,
  identifierStatus,
  identifierType,
} from "./data";
import type {
  ConfusableDetection,
  ConfusableMetadata,
  ConfusableRecord,
  ConfusableType,
  ConfusablesOptions,
  IdentifierStatus,
  IdentifierType,
  IntentionalDetection,
} from "./types";

function hasRange(ranges: [number, number][], cp: number): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end] = ranges[mid];
    if (cp < start) hi = mid - 1;
    else if (cp > end) lo = mid + 1;
    else return true;
  }
  return false;
}

function isDefaultIgnorable(char: string): boolean {
  const cp = char.codePointAt(0);
  return cp !== undefined && hasRange(defaultIgnorable.ranges, cp);
}

function matchesType(record: ConfusableRecord, type: ConfusableType | "all" | undefined): boolean {
  if (!type || type === "all") return true;
  return record.type === type;
}

/** Resolve the confusable prototype mapping for a character. */
export function getConfusables(char: string): ConfusableRecord | null {
  return confusables.confusables[singleCodePoint(char)] ?? null;
}

/** Get all source characters whose prototype equals the given prototype string. */
export function getConfusableSources(prototype: string): string[] {
  return [...(getReverseLookup(confusables).get(prototype) ?? [])];
}

/** Reject multi-code-point strings in single-character APIs. */
export function singleCodePoint(char: string): string {
  const points = Array.from(char);
  if (points.length !== 1) {
    throw new RangeError(`Expected a single code point, received ${points.length}`);
  }
  return points[0];
}

/**
 * UTS #39 internal skeleton: NFD, strip default-ignorable code points, map
 * through the confusable table, NFD again. This is direction-insensitive;
 * callers needing directional spoof checks must apply explicit bidi analysis.
 * Stripping runs before mapping so ignorable characters are never remapped.
 */
export function skeleton(text: string, options: ConfusablesOptions = {}): string {
  let out = "";
  for (const char of text.normalize("NFD")) {
    if (isDefaultIgnorable(char)) continue;
    const record = confusables.confusables[char];
    out += record && matchesType(record, options.type) ? record.target : char;
  }
  return out.normalize("NFD");
}

export function normalizeString(text: string, type: ConfusableType | "all" = "MA"): string {
  return skeleton(text, { type });
}

/**
 * Normalize using all confusable types.
 */
export function normalizeStringAll(text: string): string {
  return skeleton(text, { type: "all" });
}

/** Check whether two strings become identical after skeleton normalization. */
export function areConfusable(
  str1: string,
  str2: string,
  type: ConfusableType | "all" = "MA",
): boolean {
  return skeleton(str1, { type }) === skeleton(str2, { type });
}

/**
 * Detect confusable characters in a string. `index` is the code point index
 * within the NFD-normalized input, matching skeleton normalization.
 */
export function detectConfusables(
  text: string,
  options: ConfusablesOptions = {},
): ConfusableDetection[] {
  const detections: ConfusableDetection[] = [];
  let index = 0;
  for (const char of text.normalize("NFD")) {
    if (isDefaultIgnorable(char)) continue;
    const record = confusables.confusables[char];
    if (record && matchesType(record, options.type)) {
      detections.push({ index, char, target: record.target, type: record.type });
    }
    index++;
  }
  return detections;
}

/** Get every single-character confusable variation of a string. */
export function getConfusableVariations(text: string, options: ConfusablesOptions = {}): string[] {
  const normalized = text.normalize("NFD");
  const variations = new Set<string>([normalized]);
  const chars = Array.from(normalized);

  for (let i = 0; i < chars.length; i++) {
    const record = confusables.confusables[chars[i]];
    if (!record || !matchesType(record, options.type)) continue;
    for (const source of getConfusableSources(record.target)) {
      if (source === chars[i]) continue;
      const variation = chars.slice();
      variation[i] = source;
      variations.add(variation.join(""));
    }
  }

  return Array.from(variations);
}

/** Get the prototype replacement sequence for a character. */
export function getConfusablePrototype(char: string): string {
  const first = singleCodePoint(char);
  return confusables.confusables[first]?.target ?? first;
}

/** Randomly replace characters in a string with their prototype sequences. */
export function randomizeConfusables(text: string, options: { probability?: number } = {}): string {
  const probability = options.probability ?? 0.5;
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError(`probability must be within [0, 1], received ${probability}`);
  }
  return Array.from(text)
    .map((char) => (Math.random() < probability ? getConfusablePrototype(char) : char))
    .join("");
}

/** Binary search an Identifier range table for the code point of a single character. */
function findIdentifierRange(
  ranges: [number, number, string][],
  char: string,
): [number, number, string] | null {
  const cp = char.codePointAt(0);
  if (cp === undefined) return null;
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end] = ranges[mid];
    if (cp < start) hi = mid - 1;
    else if (cp > end) lo = mid + 1;
    else return ranges[mid];
  }
  return null;
}

/**
 * UTS #39 Identifier_Status for a character. Characters not listed in the
 * dataset default to "Restricted", so this always returns a status.
 */
export function getIdentifierStatus(char: string): IdentifierStatus {
  return findIdentifierRange(identifierStatus.ranges, singleCodePoint(char))
    ? "Allowed"
    : "Restricted";
}

/**
 * UTS #39 Identifier_Type values for a character. Characters not listed in
 * the dataset default to ["Not_Character"].
 */
export function getIdentifierTypes(char: string): IdentifierType[] {
  const hit = findIdentifierRange(identifierType.ranges, singleCodePoint(char));
  if (!hit) return ["Not_Character"];
  return hit[2].split(" ") as IdentifierType[];
}

let intentionalIndex: Map<string, string[]> | null = null;

/** Intentional confusable targets for a character (may be several). */
export function getIntentionalTargets(char: string): string[] {
  intentionalIndex ??= new Map(
    [...Map.groupBy(intentional.pairs, (pair) => pair.source)].map(
      ([source, pairs]) => [source, pairs.map((pair) => pair.target)] as const,
    ),
  );
  return intentionalIndex.get(char) ?? [];
}

/** Detect intentional confusables with positions in the input string. */
export function detectIntentional(text: string): IntentionalDetection[] {
  const detections: IntentionalDetection[] = [];
  let index = 0;
  for (const char of text) {
    const targets = getIntentionalTargets(char);
    if (targets.length > 0) detections.push({ index, char, targets });
    index++;
  }
  return detections;
}

/** True when the two characters form an intentional confusable pair in
 * either direction; the Unicode table itself is directional. */
export function areIntentionalPair(a: string, b: string): boolean {
  return getIntentionalTargets(a).includes(b) || getIntentionalTargets(b).includes(a);
}

/** Metadata about the confusables dataset. */
export function getMetadata(): ConfusableMetadata {
  const typeDistribution = { MA: 0, MI: 0, X: 0 };
  for (const record of Object.values(confusables.confusables)) {
    typeDistribution[record.type]++;
  }
  return {
    version: confusables.version,
    date: confusables.date,
    totalMappings: Object.keys(confusables.confusables).length,
    typeDistribution,
  };
}
