# unglyph

![npm version](https://img.shields.io/npm/v/unglyph)
![npm downloads](https://img.shields.io/npm/dw/unglyph)
![npm license](https://img.shields.io/npm/l/unglyph)

> The font engineering layer of By Sages Typography — parse real font binaries into normalized glyph data, render them, subset with HarfBuzz, and build TrueType or CFF-based OpenType fonts from a typed path model.

## Features

- 🔍 **Broad font input** — read TTF, OTF, WOFF, WOFF2, and TrueType Collections through `fontkit`; preserve cmap alternatives, `.notdef`, advances, variation axes, width/weight, and color-format capabilities.
- 🏗 **Creation without CFF-only limits** — export TrueType `glyf` outlines, CFF-based OTF, and WOFF/WOFF2 containers; write standard name metadata, PostScript-safe names, metrics, and cmap subtables.
- 🧩 **One glyph model** — the same normalized path commands feed rendering, editing, parsing, and generation, so an icon pipeline does not need one representation for SVG and another for fonts.
- 🎨 **Rendering built in** — generate SVG, draw to a Canvas 2D context, or rasterize through the optional Node `@napi-rs/canvas` dependency; compose text with a simple horizontal advance layout when full shaping is unnecessary.
- ✂️ **Production-safe subsetting** — `unglyph/subset` uses HarfBuzz WASM and preserves GSUB/GPOS closure; instance variable-font axes and emit WOFF or WOFF2 in Node and browsers.
- 🌍 **Runtime-neutral core** — parsing, creation, SVG rendering, and subsetting are designed for Node and modern browsers; platform compression APIs handle WOFF/WOFF2 without bundled polyfills.

## Installation

```bash
# pnpm
pnpm add unglyph

# npm
npm install unglyph

# yarn
yarn add unglyph

# bun
bun add unglyph
```

## Quick Start

Inspect a font and render a glyph:

```ts
import { parseFont, renderGlyphToSVG } from "unglyph";

const font = await parseFont(fontBytes);
console.log(font.familyName, font.glyphs.length, font.variationAxes);

const glyph = font.glyphs.find((item) => item.unicode === 65);
const svg = renderGlyphToSVG(glyph, {
  size: 64,
  color: "#111111",
  backgroundColor: "transparent",
});
```

Only need the name table? Skip glyph decoding entirely:

```ts
import { parseFontMetadata } from "unglyph";

const metadata = await parseFontMetadata(fontBytes);
console.log(metadata.designer, metadata.license, metadata.version);
```

Create glyph data once and export it as a real font:

```ts
import { createFont, generateFont } from "unglyph";

const font = createFont(glyphs, {
  familyName: "Example Icons",
  styleName: "Regular",
  ascender: 800,
  descender: -200,
  metadata: {
    manufacturer: "BY SAGES",
    description: "Generated icon font",
    version: "1.0.0",
  },
});

const ttf = await generateFont(font, { format: "ttf" });
const otf = await generateFont(font, { format: "otf" });
const woff2 = await generateFont(font, { format: "woff2" });
```

For an existing font, subset the glyphs actually used while keeping shaping intact:

```ts
import { subsetFont } from "unglyph/subset";

const latin = await subsetFont(fontBytes, "Hello world", {
  targetFormat: "woff2",
});

const regular = await subsetFont(variableFontBytes, "Hello world", {
  variationAxes: { wght: 400 },
});
```

> `createFont` rebuilds from extracted paths, so it intentionally drops hinting and original layout features. Use `subsetFont` when the output must remain a faithful, shippable font; use creation APIs for generated fonts such as icon and picture fonts. Scalar identity — names, metrics, OS/2 heights and width class, and full name-table metadata — is preserved across a `parseFont` → `createFont` → `generateFont` round trip; variable axes, color tables, and layout features are not rebuilt.

The normalized path model uses SVG direction: `y` increases downward and the baseline is `0`. Node-only image rendering requires installing `@napi-rs/canvas`.

## License

- [MIT](../../LICENSE) © [By Sages](https://www.bysages.com/)
