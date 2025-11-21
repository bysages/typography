# unglyph 🔠

![npm version](https://img.shields.io/npm/v/unglyph)
![npm downloads](https://img.shields.io/npm/dw/unglyph)
![npm license](https://img.shields.io/npm/l/unglyph)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

A unified font glyph manipulation library with simple API for parsing, creating, and modifying fonts.

Built on top of proven font libraries like **fontkit** and **opentype.js**, unglyph provides a clean, type-safe interface for font operations while maintaining simplicity and ease of use.

## ✨ Features

- 🔍 **Font Parsing**: Parse TTF, OTF, WOFF, and WOFF2 fonts using fontkit
- 🔧 **Font Creation**: Create custom fonts from glyph data using opentype.js
- 📝 **Glyph Management**: Comprehensive CRUD operations with batch processing
- 🎨 **SVG Rendering**: Render glyphs to SVG with customizable styles
- 📦 **TypeScript**: Full TypeScript support with comprehensive type definitions
- 🏭 **Factory Pattern**: Consistent factory functions for easy instantiation
- 🔄 **Format Support**: Support for major font formats (TTF, OTF, WOFF, WOFF2)
- 🎯 **Simple API**: Clean, intuitive API following KISS principles

## 📥 Installation

```bash
# Using npm
npm install unglyph

# Using yarn
yarn add unglyph

# Using pnpm
pnpm add unglyph
```

## 🚀 Basic Usage

### Font Parsing

```typescript
import { parseFont, type FontData } from "unglyph";

// Parse font file
const font: FontData = parseFont(fontBuffer);

console.log(`Font: ${font.familyName}`);
console.log(`Format: ${font.format}`);
console.log(`Units per Em: ${font.unitsPerEm}`);

// Access glyph data
const glyphA = font.glyphs.find((g) => g.unicode === 65);
console.log(
  `Glyph A: ${glyphA?.name}, index: ${glyphA?.index}, advanceWidth: ${glyphA?.advanceWidth}`,
);
```

### Font Creation

```typescript
import {
  createFont,
  createGlyphManager,
  generateFont,
  type FontOptions,
  type FontData,
  type GlyphData,
  type PathCommand,
} from "unglyph";

// Create glyph manager
const manager = createGlyphManager();

// Add custom glyphs
const glyphA: GlyphData = {
  index: 1,
  unicode: 65, // 'A'
  name: "A",
  advanceWidth: 600,
  path: {
    commands: [
      { type: "move", x: 300, y: 0 },
      { type: "line", x: 100, y: 700 },
      { type: "line", x: 500, y: 700 },
      { type: "line", x: 300, y: 0 },
    ] as PathCommand[],
  },
};

manager.add(glyphA);

// Create FontData
const fontOptions: FontOptions = {
  familyName: "MyFont",
  styleName: "Regular",
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
};

const fontData: FontData = createFont(manager.list(), fontOptions);

// Generate font file (returns Uint8Array)
const fontBytes = generateFont(fontData, { format: "otf" });
// Save to file
fs.writeFileSync("myfont.otf", fontBytes);
```

### Glyph Management

```typescript
import { GlyphManager, createGlyphManager } from "unglyph";

// Create manager with initial glyphs
const manager = createGlyphManager(initialGlyphs);

// CRUD operations
manager.add(newGlyph);
const glyph = manager.get(65);
const exists = manager.has(65);
const removed = manager.remove(65);

// Batch operations
manager.addGlyphs([glyph1, glyph2, glyph3]);
manager.batch([
  { type: "add", glyph: newGlyph },
  { type: "update", index: 2, updates: { advanceWidth: 650 } },
  { type: "remove", index: 3 },
]);

// Find operations
const glyphA = manager.findByUnicode("A");
const capitalLetters = manager.find((g) => g.unicode >= 65 && g.unicode <= 90);
const allGlyphs = manager.list();
console.log(`Total glyphs: ${manager.count()}`);
```

### SVG Rendering

```typescript
import { renderGlyph } from "unglyph";

// Render glyph to SVG
const svg = renderGlyph(glyph, {
  size: 100,
  color: "#2563eb",
  backgroundColor: "white",
  padding: 20,
  strokeColor: "#1e40af",
  strokeWidth: 1,
});

console.log(svg); // Complete SVG string
// Save to file
fs.writeFileSync("glyph.svg", svg);
```

## 🔧 Advanced Usage

### Font Pipeline Example

```typescript
import {
  parseFont,
  createGlyphManager,
  createFont,
  generateFont,
  renderGlyph,
  type FontData,
} from "unglyph";

async function processFont(inputBuffer: ArrayBuffer) {
  // 1. Parse existing font
  const originalFont: FontData = parseFont(inputBuffer);

  // 2. Create manager and copy glyphs
  const manager = createGlyphManager(originalFont.glyphs);

  // 3. Modify glyphs (e.g., make all letters bold)
  const modifiedGlyphs = manager.list().map((glyph) => ({
    ...glyph,
    advanceWidth: glyph.advanceWidth * 1.2, // 20% wider for bold
    path: {
      ...glyph.path,
      // Add stroke offset for bold effect
      commands: addBoldOffset(glyph.path.commands),
    },
  }));

  // 4. Create new font data with modifications
  const newFontData: FontData = createFont(modifiedGlyphs, {
    familyName: `${originalFont.familyName} Bold`,
    styleName: "Bold",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
  });

  // 5. Generate font file
  return generateFont(newFontData, { format: "otf" });
}
```

### Custom Font Generation

```typescript
import { createGlyphManager, createFont, type GlyphData } from "unglyph";

function createIconFont(
  icons: Array<{ name: string; unicode: number; path: string }>,
) {
  const manager = createGlyphManager();

  // Add icons as glyphs
  icons.forEach((icon) => {
    const glyph: GlyphData = {
      index: icon.unicode,
      unicode: icon.unicode,
      name: icon.name,
      advanceWidth: 1000,
      path: {
        commands: parseSVGPath(icon.path), // Convert SVG path to commands
      },
    };
    manager.add(glyph);
  });

  // Create icon font data
  const fontData = createFont(manager.list(), {
    familyName: "Custom Icons",
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 850,
    descender: -150,
  });

  // Generate icon font file
  return generateFont(fontData, { format: "otf" });
}
```

## 📚 API Reference

### Core Functions

#### `parseFont(input: FontInput): FontData`

Parse font file and extract glyph information. Returns unified FontData structure.

#### `createFont(glyphs: GlyphData[], options: FontOptions): FontData`

Create font data from glyph data array.

#### `generateFont(fontData: FontData, options?: FontGenerateOptions): Uint8Array`

Generate font file from FontData. Returns file buffer (OTF, TTF, etc.).

#### `renderGlyph(glyph: GlyphData, options: RenderOptions): string`

Render single glyph to SVG string.

#### `createGlyphManager(initialGlyphs?: GlyphData[]): GlyphManager`

Create new glyph manager instance.

### Classes

#### `GlyphManager`

Manage font glyphs with CRUD operations:

- `add(glyph: GlyphData): void` - Add glyph
- `get(unicode: string | number): GlyphData | undefined` - Get glyph
- `update(unicode, updates): boolean` - Update glyph
- `remove(unicode): boolean` - Remove glyph
- `list(): GlyphData[]` - Get all glyphs
- `findByUnicode(unicode): GlyphData | undefined` - Find by Unicode
- `addGlyphs(glyphs: GlyphData[]): void` - Batch add
- `batch(operations: GlyphOperation[]): void` - Batch operations
- `count(): number` - Get glyph count
- `isEmpty(): boolean` - Check if empty

### Type Definitions

#### `GlyphData`

```typescript
interface GlyphData {
  index: number; // Glyph index in font
  unicode: string | number; // Unicode character or code point
  name?: string; // Optional glyph name
  advanceWidth: number; // Advance width
  leftSideBearing?: number; // Left side bearing
  rightSideBearing?: number; // Right side bearing
  path: PathData; // Path commands
}
```

#### `FontData`

```typescript
interface FontData {
  familyName?: string; // Font family name
  format?: string; // Font format (TTF, OTF, etc.)
  unitsPerEm?: number; // Units per em
  ascent?: number; // Ascender height
  descent?: number; // Descender depth
  lineGap?: number; // Line gap
  capHeight?: number; // Cap height
  xHeight?: number; // X-height
  glyphs: GlyphData[]; // Array of glyphs
}
```

#### `FontGenerateOptions`

```typescript
interface FontGenerateOptions {
  format?: "ttf" | "otf" | "woff" | "woff2"; // Export format (default: "otf")
  familyName?: string; // Font family name (uses font's name if not provided)
  styleName?: string; // Style name (default: "Regular")
  unitsPerEm?: number; // Units per em (uses font's value if not provided)
  ascender?: number; // Ascender height (uses font's value if not provided)
  descender?: number; // Descender depth (uses font's value if not provided)
}
```

#### `FontOptions`

```typescript
interface FontOptions {
  familyName: string; // Font family name
  styleName?: string; // Style name
  unitsPerEm?: number; // Units per em (default: 1000)
  ascender?: number; // Ascender height (default: 800)
  descender?: number; // Descender depth (default: -200)
  weight?: number; // Font weight (100-900)
  italic?: boolean; // Italic style
}
```

#### `RenderOptions`

```typescript
interface RenderOptions {
  size: number; // Size in pixels
  color?: string; // Fill color
  backgroundColor?: string; // Background color
  padding?: number; // Padding
  strokeColor?: string; // Stroke color
  strokeWidth?: number; // Stroke width
}
```

## 🏗️ Architecture

unglyph is built on top of proven font libraries:

- **fontkit**: Advanced font parsing with support for multiple font formats
- **opentype.js**: Font creation and OpenType/TrueType manipulation
- **undio**: Universal I/O handling for various data types

The library provides a unified, type-safe API that abstracts away the complexity of these underlying libraries while maintaining their power and flexibility.

## 📦 Package Structure

```
packages/unglyph/
├── src/
│   ├── types.ts          # TypeScript type definitions
│   ├── parser.ts          # Font parsing functionality
│   ├── creator.ts         # Font creation functionality
│   ├── renderer.ts        # SVG rendering functionality
│   ├── manager.ts         # Glyph manager class
│   └── index.ts           # Main exports
├── dist/                  # Built distribution files
├── package.json           # Package configuration
└── README.md              # This file
```

## 🔗 Related

- [fontkit](https://github.com/foliojs/fontkit) - Advanced font engine for Node and browser
- [opentype.js](https://opentype.js.org/) - OpenType and TrueType font parser and writer
- [undio](https://github.com/unjs/undio) - Universal I/O utility library

## 📄 License

[MIT](../../LICENSE) © [By Sages](https://www.bysages.com/)
