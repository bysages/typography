# By Sages Typography

[![npm downloads](https://img.shields.io/npm/dw/unconfusables)](https://www.npmjs.com/package/unconfusables)
[![GitHub Stars](https://img.shields.io/github/stars/bysages/typography)](https://github.com/bysages/typography/stargazers)
![GitHub License](https://img.shields.io/github/license/bysages/typography)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

> Typography is the By Sages typography toolkit: Unicode-aware text security, unified OCR across system and AI engines, and font engineering for parsing, rendering, creation, and subsetting — one set of composable packages with runtime-neutral TypeScript APIs.

[Report Issues](https://github.com/bysages/typography/issues) · [Discussions](https://github.com/bysages/typography/discussions)

⭐ **If Typography is useful to you, a star helps other developers find it.**

## Why Typography?

- 🔐 **Text that can be checked** — `unconfusables` implements Unicode Security Mechanisms with confusable skeletons, intentional-confusable detection, identifier profiling, script analysis, and restriction levels.
- 🧠 **One OCR contract** — `unocr` normalizes image input and results, then lets you swap system OCR, Tesseract CLI, Tesseract.js, browser Shape Detection, or an AI vision model without changing application code.
- 🔤 **Fonts without a bespoke pipeline** — `unglyph` reads font metadata, glyphs, variation axes, and color-format capabilities; renders glyphs; writes TrueType and CFF-based OpenType; and subsets with HarfBuzz.
- 🌍 **Same code across runtimes** — core APIs are typed ESM designed for Node and modern browsers, with platform-specific engines isolated behind optional drivers or optional rendering dependencies.
- 🧩 **Composable by design** — each package solves one part of the typography stack, so a security audit, an OCR service, and a font tool can share the same foundation without pulling in the rest.

## Packages

| Package                                             | Version                                            | Description                                                    |
| --------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| [unconfusables](./packages/unconfusables/README.md) | ![npm](https://img.shields.io/npm/v/unconfusables) | Unicode confusables, identifier profiling, and script analysis |
| [unocr](./packages/unocr/README.md)                 | ![npm](https://img.shields.io/npm/v/unocr)         | Unified OCR with native, CLI, browser, WASM, and AI drivers    |
| [unglyph](./packages/unglyph/README.md)             | ![npm](https://img.shields.io/npm/v/unglyph)       | Font parsing, rendering, creation, metadata, and subsetting    |

## Quick Start

Install the package for the task:

```bash
pnpm add unconfusables
# or unocr / unglyph
```

Check whether text relies on visually confusable characters:

```ts
import { areConfusable, detectConfusables, skeleton } from "unconfusables";

skeleton("pa\u200Bypal"); // "paypal"
areConfusable("paypal", "paypa1"); // true
detectConfusables("g00gle");
```

Recognize text with the best OCR backend available on the current host:

```ts
import { createOCRManager } from "unocr";
import autoDriver from "unocr/drivers/auto";

const ocr = createOCRManager({ driver: autoDriver() });
const result = await ocr.recognize(image);
await ocr.dispose();
```

Parse and render a font, or turn glyph paths back into a font file:

```ts
import { createFont, generateFont, parseFont, renderGlyphToSVG } from "unglyph";

const source = await parseFont(fontBytes);
const glyph = source.glyphs.find((item) => item.unicode === 65);
const svg = renderGlyphToSVG(glyph, { size: 64 });

const font = createFont(glyphs, { familyName: "Example", styleName: "Regular" });
const bytes = await generateFont(font, { format: "ttf" });
```

## Development

### Prerequisites

- **Node.js** 20.x or higher
- **pnpm** 10.x or higher
- **Git** for version control

### Getting Started

1. **Clone the repository**:

   ```bash
   git clone https://github.com/bysages/typography.git
   cd typography
   ```

2. **Install dependencies and build packages**:

   ```bash
   pnpm install
   ```

3. **Start from a playground** when you want to explore a package:

   ```bash
   pnpm dev
   ```

### Development Commands

```bash
pnpm build        # Build every package
pnpm check        # Format, lint, and type check
pnpm test         # Run all tests
pnpm release      # Run package release tasks
```

The `playground/` directory keeps runnable examples for each package; use those examples as integration checks while changing parser, driver, or Unicode-data behavior.

## Versioning

This project follows [Semantic Versioning](https://semver.org/). While the major version is `0` (pre-1.0), breaking API changes are released as **minor** version bumps (`0.x.0`) rather than patch releases — the public API is expected to keep evolving until the `1.0.0` stabilization release. Pin exact versions in downstream projects if you require stability between minor updates.

## Contributing

We welcome contributions! Use conventional commits (`feat:`, `fix:`, and related types), add or update tests for behavior changes, and run `pnpm check` and `pnpm test` before submitting a pull request.

## Support & Community

- 📫 [Report Issues](https://github.com/bysages/typography/issues)

If Typography is useful to you, a [⭐ star](https://github.com/bysages/typography/stargazers) helps other developers find it.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

Built with ❤️ by [By Sages](https://www.bysages.com/)
