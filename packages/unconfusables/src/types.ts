export type ConfusableType = "MA" | "MI" | "X";

export interface ConfusableRecord {
  /** Prototype replacement sequence, already joined into a string. */
  target: string;
  type: ConfusableType;
}

/**
 * A parsed Unicode confusables dataset (confusables.txt or intentional.txt).
 */
export interface ConfusablesDataset {
  version: string;
  date: string;
  confusables: Record<string, ConfusableRecord>;
}

/** intentional.txt pair list: the same source may map to several targets. */
export interface IntentionalDataset {
  version: string;
  date: string;
  pairs: { source: string; target: string }[];
}

export interface ConfusableMetadata {
  version: string;
  date: string;
  totalMappings: number;
  typeDistribution: {
    MA: number;
    MI: number;
    X: number;
  };
}

export interface IntentionalDetection {
  /** Code point index in the NFD-normalized input */
  index: number;
  char: string;
  targets: string[];
}

export interface ConfusablesOptions {
  /** Confusable type filter. Defaults to "MA" for normalization-style APIs. */
  type?: ConfusableType | "all";
}

export interface ConfusableDetection {
  /** Code point index in the original string */
  index: number;
  /** The original character */
  char: string;
  /** Prototype replacement sequence from the table */
  target: string;
  type: ConfusableType;
}

export type IdentifierStatus = "Allowed" | "Restricted";

/**
 * A parsed UTS #39 identifier range dataset (IdentifierStatus.txt or
 * IdentifierType.txt). Values not listed in IdentifierStatus default to
 * "Restricted"; values not listed in IdentifierType default to "Not_Character".
 */
export interface RangesDataset {
  version: string;
  ranges: [number, number, string][];
}

/** A UCD derived-property dataset whose property is the table itself, so
 * each range is just [start, end] with no repeated value column. */
export interface FlagRangesDataset {
  version: string;
  ranges: [number, number][];
}
