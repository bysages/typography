/**
 * UTS #39 section 5.1/5.2: mixed-script detection and restriction levels.
 *
 * Self-contained subpath entry. Script data comes from the UCD (Scripts,
 * ScriptExtensions) plus CLDR script metadata; all script values are
 * 4-letter codes (Latn, Cyrl, ...). Common (Zyyy) and Inherited (Zinh)
 * characters resolve to the set of all scripts per section 5.1.
 */

import defaultIgnorableData from "./data/default-ignorable.json";
import identifierStatusData from "./data/identifier-status.json";
import scriptExtensionsData from "./data/script-extensions.json";
import scriptMetadataData from "./data/script-metadata.json";
import scriptsData from "./data/scripts.json";
import xidContinueData from "./data/xid-continue.json";
import xidStartData from "./data/xid-start.json";
import type {
  FlagRangesDataset,
  RangesDataset,
  ScriptIdUsage,
  ScriptMetadataDataset,
} from "./types";

/** UCD Script ranges (4-letter codes). Characters not listed default to "Zzzz" (Unknown). */
export const scripts: RangesDataset = scriptsData as RangesDataset;

/** UCD Script_Extensions ranges (space-separated 4-letter codes). */
export const scriptExtensions: RangesDataset = scriptExtensionsData as RangesDataset;

/** UTS #39 Identifier_Status ranges, used for the identifier profile check in section 5.2. */
export const identifierStatus: RangesDataset = identifierStatusData as RangesDataset;

/** UAX #31 XID_Start ranges: characters that may begin an identifier. */
export const xidStart: FlagRangesDataset = xidStartData as FlagRangesDataset;

/** UAX #31 XID_Continue ranges: characters that may continue an identifier. */
export const xidContinue: FlagRangesDataset = xidContinueData as FlagRangesDataset;

/** UCD Default_Ignorable_Code_Point ranges, skipped by well-formedness checks. */
export const defaultIgnorable: FlagRangesDataset = defaultIgnorableData as FlagRangesDataset;

/** CLDR script metadata: 4-letter code -> ID_Usage (RECOMMENDED, LIMITED_USE, EXCLUDED, ...). */
export const scriptMetadata: Record<string, ScriptIdUsage> = (
  scriptMetadataData as ScriptMetadataDataset
).scripts;

function findRangeValue(ranges: [number, number, string][], cp: number): string | null {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end, value] = ranges[mid];
    if (cp < start) hi = mid - 1;
    else if (cp > end) lo = mid + 1;
    else return value;
  }
  return null;
}

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

/** Reject multi-code-point strings in single-character APIs. */
function singleCodePoint(char: string): string {
  const points = Array.from(char);
  if (points.length !== 1) {
    throw new RangeError(`Expected a single code point, received ${points.length}`);
  }
  return points[0];
}

/** Script property for a character, as a 4-letter code. */
export function getScript(char: string): string {
  const cp = singleCodePoint(char).codePointAt(0);
  if (cp === undefined) return "Zzzz";
  return findRangeValue(scripts.ranges, cp) ?? "Zzzz";
}

/** Raw Script_Extensions values for a character, or [getScript(char)] when unlisted. */
export function getScriptExtensions(char: string): string[] {
  const cp = singleCodePoint(char).codePointAt(0);
  if (cp === undefined) return ["Zzzz"];
  const value = findRangeValue(scriptExtensions.ranges, cp);
  return value ? value.split(" ") : [getScript(char)];
}

/**
 * Augmented script set (UTS #39 section 5.1): the Script_Extensions with the
 * Hanb/Jpan/Kore/Hntl writing-system additions applied. Characters whose set
 * contains Common or Inherited resolve to "all".
 */
export function getAugmentedScriptSet(char: string): Set<string> | "all" {
  const raw = getScriptExtensions(char);
  if (raw.includes("Zyyy") || raw.includes("Zinh")) return "all";

  const set = new Set(raw);
  if (set.has("Hani")) {
    set.add("Hanb");
    set.add("Hntl");
    set.add("Jpan");
    set.add("Kore");
  }
  if (set.has("Hira")) set.add("Jpan");
  if (set.has("Kana")) set.add("Jpan");
  if (set.has("Hang")) set.add("Kore");
  if (set.has("Bopo")) set.add("Hanb");
  if (set.has("Latn")) set.add("Hntl");
  return set;
}

/**
 * Resolved script set for a string: the intersection of all augmented sets.
 * Returns "all" when every character is Common/Inherited (single-script),
 * "mixed" when the intersection is empty, otherwise the remaining scripts.
 */
export function resolveScriptSet(text: string): "all" | "mixed" | Set<string> {
  let acc: Set<string> | null = null;
  for (const char of text) {
    const augmented = getAugmentedScriptSet(char);
    if (augmented === "all") continue;
    const current: Set<string> | null = acc;
    if (current === null) {
      acc = augmented;
    } else {
      const next = new Set<string>();
      for (const script of current) {
        if (augmented.has(script)) next.add(script);
      }
      acc = next;
    }
    if (acc.size === 0) return "mixed";
  }
  return acc ?? "all";
}

/** True when the resolved script set is empty (UTS #39 section 5.1). */
export function isMixedScript(text: string): boolean {
  return resolveScriptSet(text) === "mixed";
}

/**
 * UAX #31 well-formedness: after dropping default-ignorable code points, the
 * first code point must be XID_Start and the rest XID_Continue. NFKC casefold
 * stability (the other half of the UTS #39 profile check) is not verified.
 */
export function isIdentifierWellFormed(text: string): boolean {
  let first = true;
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (hasRange(defaultIgnorable.ranges, cp)) continue;
    if (!hasRange((first ? xidStart : xidContinue).ranges, cp)) return false;
    first = false;
  }
  return true;
}

export type RestrictionLevel =
  | "ascii-only"
  | "single-script"
  | "highly-restrictive"
  | "moderately-restrictive"
  | "minimally-restrictive"
  | "unrestricted";

export const RESTRICTION_LEVELS = [
  "ascii-only",
  "single-script",
  "highly-restrictive",
  "moderately-restrictive",
  "minimally-restrictive",
  "unrestricted",
] as const;

function intersectWith(acc: Set<string>, augmented: Set<string>): Set<string> {
  return new Set([...acc].filter((script) => augmented.has(script)));
}

/**
 * Restriction level (UTS #39 section 5.2). The identifier profile check uses
 * Identifier_Status plus UAX #31 well-formedness: any failure yields
 * "unrestricted".
 */
export function getRestrictionLevel(text: string): RestrictionLevel {
  let allAscii = true;
  const soss: (Set<string> | "all")[] = [];

  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp > 0x7f) allAscii = false;
    if (!findRangeValue(identifierStatus.ranges, cp)) return "unrestricted";
    soss.push(getAugmentedScriptSet(char));
  }

  if (!isIdentifierWellFormed(text)) return "unrestricted";

  if (allAscii) return "ascii-only";

  let resolved: Set<string> | null = null;
  for (const augmented of soss) {
    if (augmented === "all") continue;
    resolved = resolved === null ? augmented : intersectWith(resolved, augmented);
    if (resolved.size === 0) break;
  }
  if (resolved === null || resolved.size > 0) return "single-script";

  const remaining = soss.filter(
    (augmented): augmented is Set<string> => augmented !== "all" && !augmented.has("Latn"),
  );

  for (const covering of ["Kore", "Hanb", "Jpan"]) {
    if (remaining.every((augmented) => augmented.has(covering))) return "highly-restrictive";
  }

  let intersection: Set<string> | null = null;
  for (const augmented of remaining) {
    intersection = intersection === null ? augmented : intersectWith(intersection, augmented);
  }
  const hasRecommended =
    intersection !== null &&
    [...intersection].some(
      (script) =>
        scriptMetadata[script] === "RECOMMENDED" && script !== "Cyrl" && script !== "Grek",
    );
  if (hasRecommended) return "moderately-restrictive";

  return "minimally-restrictive";
}

/** Numeric level (0 = ASCII-only ... 5 = unrestricted), handy for comparisons. */
export function getRestrictionLevelValue(text: string): number {
  return RESTRICTION_LEVELS.indexOf(getRestrictionLevel(text));
}
