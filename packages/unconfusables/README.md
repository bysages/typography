# unconfusables 🛡️

![npm version](https://img.shields.io/npm/v/unconfusables)
![npm downloads](https://img.shields.io/npm/dw/unconfusables)
![npm license](https://img.shields.io/npm/l/unconfusables)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

A powerful and efficient Unicode confusable characters detection and string normalization library based on Unicode Security Mechanisms (UTS #39).

UTS #39 defines security mechanisms for handling Unicode characters, including confusable character mappings for detecting homograph attacks and phishing attempts.

## ✨ Features

- 🔍 **Confusable Detection**: Identify characters that can be visually confused with others
- 🔧 **String Normalization**: Convert strings to their canonical forms
- 🎲 **Random Replacement**: Replace characters with random confusable alternatives
- 🛡️ **Security Applications**: Detect potential phishing attacks and homograph attacks
- 🌐 **Unicode Support**: Comprehensive support for Unicode confusable mappings
- ⚡️ **High Performance**: Efficient lookup algorithms with 6296+ confusable mappings
- 📝 **TypeScript**: Full TypeScript support with comprehensive type definitions
- 🔄 **Bidirectional Lookup**: Forward and reverse confusable character lookup
- 🎭 **Variation Generation**: Generate all possible confusable variations of strings
- 📊 **Metadata Access**: Access confusable dataset information and statistics

## 📥 Installation

```bash
# Using npm
npm install unconfusables

# Using yarn
yarn add unconfusables

# Using pnpm
pnpm add unconfusables
```

## 🚀 Basic Usage

```typescript
import {
  getConfusables,
  normalizeString,
  areConfusable,
  getConfusableVariations,
  getRandomConfusable,
  randomizeConfusables,
} from "unconfusables";

// Character confusable lookup
console.log(getConfusables("0"));
// { source: "0", target: ["O"], type: "MA", description: "..." }

console.log(getConfusables("1"));
// { source: "1", target: ["l"], type: "MA", description: "..." }

// String normalization
console.log(normalizeString("paypa1")); // "paypal"
console.log(normalizeString("g00gle")); // "gOOgle"
console.log(normalizeString("admin")); // "adrin"

// Confusable detection
console.log(areConfusable("0l", "Ol")); // true
console.log(areConfusable("paypal", "paypa1")); // true
console.log(areConfusable("google", "goog1e")); // true

// Generate confusable variations
const variations = getConfusableVariations("admin");
console.log(variations); // ["admin", "adrin", "adnin"]

// Random character replacement
console.log(getRandomConfusable("a")); // Random confusable of "a"
console.log(getRandomConfusable("0")); // "O" or other confusable

// With options: only MA type, exclude certain characters
console.log(
  getRandomConfusable("a", { type: "MA", exclude: new Set(["a", "A"]) }),
);

// Random string replacement (30% probability)
const randomized = randomizeConfusables("paypal", { probability: 0.3 });
console.log(randomized); // "paypal" with some characters randomly replaced
```

## 🔧 Advanced Usage

### 🌐 Unicode Security Applications

```typescript
import {
  normalizeString,
  areConfusable,
  getConfusableVariations,
} from "unconfusables";

// Phishing detection
function detectPhishingUrl(url: string) {
  const normalized = normalizeString(url);
  const legitimateSites = ["paypal.com", "google.com", "microsoft.com"];

  for (const site of legitimateSites) {
    if (normalized.includes(normalizeString(site))) {
      return { suspicious: true, looksLike: site };
    }
  }
  return { suspicious: false };
}

console.log(detectPhishingUrl("paypa1.com"));
// { suspicious: true, looksLike: "paypal.com" }

console.log(detectPhishingUrl("g00gle.com"));
// { suspicious: true, looksLike: "google.com" }
```

### 🎭 String Variation Generation

```typescript
import {
  getConfusableVariations,
  getConfusableSources,
  getRandomConfusable,
  randomizeConfusables,
} from "unconfusables";

// Generate all possible confusable variations
const text = "admin";
const variations = getConfusableVariations(text);
console.log(`"${text}" has ${variations.length} confusable variations:`);
variations.forEach((v) => console.log(`  - ${v}`));

// Random character replacement
const randomChar = getRandomConfusable("a");
console.log(`Random confusable for "a": ${randomChar}`);

// With options: only MA type
const randomMA = getRandomConfusable("a", { type: "MA" });
console.log(`Random MA confusable for "a": ${randomMA}`);

// Excluding specific characters
const randomExcluded = getRandomConfusable("a", {
  exclude: new Set(["a", "A"]),
});
console.log(`Random confusable for "a" excluding "a"/"A": ${randomExcluded}`);

// Randomize entire string with options
const randomString = randomizeConfusables("paypal", {
  type: "MA",
  probability: 0.4,
});
console.log(`Randomized "paypal" (40% probability, MA only): ${randomString}`);

// Check what characters can be confused with a target character
const sources = getConfusableSources("O");
console.log(
  `Characters that look like "O": ${sources.slice(0, 10).join(", ")}...`,
);
// Characters that look like "O": ⒇, ⑽, 🄞, ⒛, ㏳, ㍬, ㏽, Ꜵ, Ю, ⒑...
```

### 📊 Dataset Information

```typescript
import { getMetadata, confusables } from "unconfusables";

const metadata = getMetadata();
console.log(`Unicode Confusables Dataset:`);
console.log(`  Version: ${metadata.version}`);
console.log(`  Total mappings: ${metadata.totalMappings}`);
console.log(`  Type distribution:`, metadata.typeDistribution);

// Find interesting mappings
const interestingMappings = Object.entries(confusables.confusables)
  .filter(([_, record]) => record.target.length > 1)
  .slice(0, 5);

console.log("\nMulti-target mappings:");
interestingMappings.forEach(([source, record]) => {
  console.log(
    `  '${source}' -> ${record.target.map((t) => `'${t}'`).join(", ")}`,
  );
});
```

### 🔒 Security Scenarios

```typescript
import {
  areConfusable,
  normalizeString,
  getConfusablesVariations,
} from "unconfusables";

// Homograph attack detection
function detectHomographAttack(str1: string, str2: string): boolean {
  return areConfusable(str1, str2, "MA"); // Only Major confusables
}

// Domain security check
function checkDomainSecurity(domain: string): {
  safe: boolean;
  risks: string[];
  variations: string[];
} {
  const variations = getConfusableVariations(domain);
  const risks = [];

  // Check for common high-risk confusables
  const riskyChars = ["а", "о", "с", "е", "і"]; // Cyrillic lookalikes
  const normalized = normalizeString(domain);

  for (const char of riskyChars) {
    if (domain.includes(char) && domain !== normalized) {
      risks.push(`Contains risky character: ${char}`);
    }
  }

  return {
    safe: risks.length === 0,
    risks,
    variations,
  };
}

console.log(checkDomainSecurity("paypal.com"));
// { safe: true, risks: [], variations: ["paypal"] }

console.log(checkDomainSecurity("paypa1.com"));
// { safe: false, risks: ["Contains risky character: 1"], variations: ["paypa1", "paypal"] }
```

## 📚 API Reference

### 🔍 Character Lookup

#### `getConfusables(char: string): ConfusableRecord | null`

Get confusable mapping for a single character.

### 🔧 String Operations

#### `normalizeString(text: string, type?: ConfusableType): string`

Normalize string by replacing confusable characters with their targets.

#### `normalizeStringAll(text: string): string`

Normalize string using all confusable types.

#### `areConfusable(str1: string, str2: string, type?: ConfusableType): boolean`

Check if two strings are confusable with each other.

#### `getConfusableVariations(text: string, type?: ConfusableType): string[]`

Get all possible confusable variations of a string.

### 📊 Dataset Information

#### `getMetadata(): ConfusableMetadata`

Get metadata about the confusables dataset.

#### `getConfusableSources(char: string): string[]`

Get all characters that can be confusable with the given character.

### 🌐 Raw Data Access

#### `confusables: ConfusableMap`

Access the complete confusable mapping dataset for advanced usage.

## 🔧 Configuration

### Confusable Types

- **"MA"** (Major): High-priority confusables that are most likely to cause confusion
- **"MI"** (Minor): Less likely confusables
- **"X"**: Other confusable relationships

```typescript
// Only apply Major confusables (default)
console.log(normalizeString("text", "MA"));

// Apply all confusable types
console.log(normalizeStringAll("text"));
```

## ⚡ Performance

- 📈 **6296+ confusable mappings** from Unicode UTS #39
- 🚀 **O(1) character lookup** with hash table
- 💾 **Efficient string processing** with optimized algorithms
- 📦 **Small footprint** despite comprehensive Unicode support

## 🔗 Related

- [Unicode Security Mechanisms (UTS #39)](https://www.unicode.org/reports/tr39/)
- [Unicode Confusables Table](https://www.unicode.org/reports/tr39/#confusables)

## 📄 License

[MIT](../../LICENSE) © [By Sages](https://www.bysages.com/)
