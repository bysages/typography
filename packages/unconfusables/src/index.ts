/**
 * Unicode Confusables Library
 *
 * Handling of Unicode confusable characters, spoof detection, and string
 * normalization based on Unicode Security Mechanisms (UTS #39).
 */

export * from "./types";

export * from "./utils";

export {
  confusables,
  intentional,
  identifierStatus,
  identifierType,
  defaultIgnorable,
  getReverseLookup,
} from "./data";
