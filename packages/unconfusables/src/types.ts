export type ConfusableType = "MA" | "MI" | "X";

export interface ConfusableRecord {
  source: string;
  target: string[];
  type: ConfusableType;
  description?: string;
}

export interface ConfusableMap {
  version: string;
  date: string;
  confusables: Record<string, ConfusableRecord>;
  reverseLookup: Record<string, string[]>;
}

export interface ConfusableMetadata {
  version: string;
  date: string;
  totalMappings: number;
  reverseLookupEntries: number;
  typeDistribution: {
    MA: number;
    MI: number;
    X: number;
  };
}
