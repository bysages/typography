# unconfusables

![npm version](https://img.shields.io/npm/v/unconfusables)
![npm downloads](https://img.shields.io/npm/dw/unconfusables)
![npm license](https://img.shields.io/npm/l/unconfusables)

> The Unicode security layer of By Sages Typography — UTS #39 confusable detection, spoof-oriented skeleton normalization, identifier profiling, and script-aware restriction levels in a typed, tree-shakeable ESM package.

## Features

- 🔍 **Full confusables table** — prototype lookup, reverse source lookup, and multi-character target sequences are generated from the Unicode 18.0.0 security data rather than a hand-picked subset.
- 🧼 **Spec-aware skeletons** — normalization follows the UTS #39 internal-skeleton algorithm: NFD, confusable mapping, NFD again, with default-ignorable code points removed; directional spoof checks require explicit bidi analysis.
- 🎯 **Intentional subset** — curated `intentional.txt` pairs reduce false positives in spoof checking while the broad table remains available for analysis.
- 🪪 **Identifier profiling** — `Identifier_Status`, `Identifier_Type`, UAX #31 well-formedness, mixed-script detection, augmented script sets, and UTS #39 restriction levels.
- 🗂 **Two entry points** — the root entry focuses on confusable operations; `unconfusables/script` isolates larger script and identifier datasets so callers only pay for what they import.
- 📦 **Modern output** — pure ESM, side-effect-free entries, code-point-safe iteration, zero runtime dependencies, and complete TypeScript declarations.

## Installation

```bash
# pnpm
pnpm add unconfusables

# npm
npm install unconfusables

# yarn
yarn add unconfusables

# bun
bun add unconfusables
```

## Quick Start

Normalize first, then decide whether two strings are visually attack-equivalent:

```ts
import {
  areConfusable,
  detectConfusables,
  getConfusablePrototype,
  getConfusableSources,
  skeleton,
} from "unconfusables";

skeleton("pa\u200Bypal"); // "paypal"
areConfusable("paypal", "paypa1"); // true
getConfusablePrototype("0"); // "O"
getConfusableSources("O"); // every source with the same prototype
detectConfusables("g00gle");
// [{ index: 1, char: "0", target: "O", type: "MA" }]
```

Use the curated intentional pairs when a UI is checking user-supplied names or domains:

```ts
import { areIntentionalPair, detectIntentional } from "unconfusables";

detectIntentional("pa\u0443pal");
areIntentionalPair("A", "\u0391");
```

Script-aware checks live in a second entry so the main import stays small:

```ts
import {
  getAugmentedScriptSet,
  getRestrictionLevel,
  getScript,
  isIdentifierWellFormed,
  isMixedScript,
} from "unconfusables/script";

getScript("\u610F"); // "Hani"
isIdentifierWellFormed("hello"); // true
isIdentifierWellFormed("1abc"); // false
isMixedScript("cyrillic\u0442\u0435\u043A\u0441\u0442"); // true
getRestrictionLevel("hello"); // "ascii-only"
```

## License

- [MIT](../../LICENSE) © [By Sages](https://www.bysages.com/)
