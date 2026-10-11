# unconfusables

Unicode confusable detection, spoof checking, and string normalization based on the Unicode Security Mechanisms (UTS #39). Data is generated from the Unicode 18.0.0 security tables.

## Features

- **Prototype lookup** — the full UTS #39 confusables table (6,700+ mappings, target sequences supported)
- **Skeleton normalization** — NFD → confusable mapping → NFD, with default-ignorable removal
- **Intentional confusables** — the curated `intentional.txt` pair list for low-false-positive spoof detection
- **Identifier profiling** — UTS #39 `Identifier_Status` / `Identifier_Type` range checks
- **Script analysis** — mixed-script detection and restriction levels via the `unconfusables/script` subpath
- **Pure ESM** with full TypeScript definitions

## Installation

```bash
pnpm add unconfusables
```

## Basic Usage

```typescript
import {
  getConfusables,
  getConfusablePrototype,
  getConfusableSources,
  skeleton,
  areConfusable,
  detectConfusables,
  getConfusableVariations,
  randomizeConfusables,
} from "unconfusables";

// Prototype lookup: the target is the replacement sequence from confusables.txt
getConfusables("0");
// => { target: "O", type: "MA" }
getConfusablePrototype("\u030B");
// => "\u0301\u0301" (combining double acute maps to two grave accents)

// Reverse lookup: all sources whose prototype equals the given sequence
getConfusableSources("O");
// => ["0", "O", "\u039F", "\u041E", ...]

// UTS #39 skeleton: NFD, map, NFD. Default-ignorable code points are dropped.
skeleton("pa\u200Bypal"); // => "paypal"
areConfusable("paypal", "paypa1"); // => true

// Position-level detection (index is the code point index after NFD)
detectConfusables("g00gle");
// => [{ index: 1, char: "0", target: "O", type: "MA" }, ...]

// Every single-character substitution that keeps the same skeleton
getConfusableVariations("admin");

// Replace characters with their prototype sequences (for visual tests)
randomizeConfusables("paypal", { probability: 0.3 });
```

## Intentional Confusables

The full table is broad; `intentional.txt` is the curated subset recommended for spoof detection.

```typescript
import { getIntentionalTargets, detectIntentional, areIntentionalPair } from "unconfusables";

getIntentionalTargets("C"); // => ["\u0421", "\u216D"] (Cyrillic Es, Roman numeral one hundred)
detectIntentional("pa\u0443pal");
// => [{ index: 2, char: "\u0443", targets: ["y"] }]
areIntentionalPair("A", "\u0391"); // => true
```

## Identifier Profiling

```typescript
import { getIdentifierStatus, getIdentifierTypes } from "unconfusables";

getIdentifierStatus("A"); // "Allowed"
getIdentifierStatus("\u2C13"); // "Restricted" (unlisted defaults to Restricted)
getIdentifierTypes("A"); // ["Recommended"]
getIdentifierTypes("-"); // ["Inclusion"]
```

## Script Analysis (subpath export)

Script data (UCD Scripts + ScriptExtensions + CLDR metadata) ships separately to keep the main entry small:

```typescript
import {
  isIdentifierWellFormed,
  getScript,
  getAugmentedScriptSet,
  isMixedScript,
  getRestrictionLevel,
} from "unconfusables/script";

getScript("\u610F"); // "Hani"
isMixedScript("cyrillic\u0442\u0435\u043A\u0441\u0442"); // true

// UAX #31 well-formedness (XID_Start / XID_Continue, default-ignorables skipped)
isIdentifierWellFormed("hello"); // true
isIdentifierWellFormed("1abc"); // false (identifiers cannot start with a digit)

// UTS #39 5.2 restriction levels, strictest to loosest.
// Fails the profile (Restricted Identifier_Status or not well-formed) => "unrestricted".
getRestrictionLevel("hello"); // "ascii-only"
getRestrictionLevel("1abc"); // "unrestricted"
getRestrictionLevel("\u65E5\u672C\u8A9E"); // "single-script"
getRestrictionLevel("abc\u304A\u308A\u304C\u307F"); // "highly-restrictive"
```

## API

### Character lookup

| Function                                         | Description                                                   |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `getConfusables(char): ConfusableRecord \| null` | Prototype mapping for a character                             |
| `getConfusablePrototype(char): string`           | The prototype sequence, or the character itself when unmapped |
| `getConfusableSources(prototype): string[]`      | All characters whose prototype equals the given sequence      |

### Skeleton and detection

| Function                                                   | Description                                               |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| `skeleton(text, options?): string`                         | UTS #39 skeleton; `{ type }` filters MA/MI/X, default all |
| `normalizeString(text, type?): string`                     | Skeleton with a type filter (default `"MA"`)              |
| `normalizeStringAll(text): string`                         | Skeleton across all types                                 |
| `areConfusable(a, b, type?): boolean`                      | Skeleton equality check                                   |
| `detectConfusables(text, options?): ConfusableDetection[]` | Position-level detections (NFD code point indices)        |
| `getConfusableVariations(text, options?): string[]`        | All single-character substitutions with equal skeleton    |
| `randomizeConfusables(text, { probability }?): string`     | Replace characters with their prototypes at random        |

### Intentional pairs

| Function                                          | Description                                     |
| ------------------------------------------------- | ----------------------------------------------- |
| `getIntentionalTargets(char): string[]`           | Curated confusable targets for a character      |
| `detectIntentional(text): IntentionalDetection[]` | Position-level intentional detections           |
| `areIntentionalPair(a, b): boolean`               | Whether two characters form an intentional pair |

### Identifier profiling

| Function                                               | Description                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `getIdentifierStatus(char): "Allowed" \| "Restricted"` | UTS #39 Identifier_Status (unlisted = Restricted)               |
| `getIdentifierTypes(char): string[]`                   | UTS #39 Identifier_Type values (unlisted = `["Not_Character"]`) |

### Dataset access

| Export                              | Type                 | Description                                                |
| ----------------------------------- | -------------------- | ---------------------------------------------------------- |
| `confusables`                       | `ConfusablesDataset` | Full prototype table (`{ source: { target, type } }`)      |
| `intentional`                       | `IntentionalDataset` | Curated pair list (`{ source, target }[]`)                 |
| `identifierStatus`                  | `RangesDataset`      | Identifier_Status ranges                                   |
| `identifierType`                    | `RangesDataset`      | Identifier_Type ranges                                     |
| `defaultIgnorable`                  | `FlagRangesDataset`  | `Default_Ignorable_Code_Point` ranges used by the skeleton |
| `getReverseLookup(dataset)`         | —                    | Prototype → sources map, cached per dataset                |
| `getMetadata(): ConfusableMetadata` | —                    | Version, date, mapping count, MA/MI/X distribution         |

The `unconfusables/script` subpath adds `scripts`, `scriptExtensions`, `scriptMetadata`, `identifierStatus`, `xidStart`, `xidContinue`, `defaultIgnorable`, `getScript`, `getScriptExtensions`, `getAugmentedScriptSet`, `resolveScriptSet`, `isMixedScript`, `isIdentifierWellFormed`, `getRestrictionLevel`, `getRestrictionLevelValue`, plus the `RestrictionLevel` type and `RESTRICTION_LEVELS` ordering array.

## Notes

- `target` values are **sequences**, not alternatives: `\u030B` (combining double acute) maps to `\u0301\u0301` (two grave accents). Joining is already done for you.
- `detectConfusables` indices are code point indices within the NFD-normalized input, which keeps them aligned with `skeleton` behavior.
- Data files are generated by `scripts/update.ts` from the pinned Unicode 18.0.0 security tables.

## Related

- [UTS #39: Unicode Security Mechanisms](https://www.unicode.org/reports/tr39/)
- [UCD Security Data](https://www.unicode.org/Public/18.0.0/security/)

## License

MIT © [By Sages](https://www.bysages.com/)
