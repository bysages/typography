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
import { parseFont } from "unglyph";

// Parse font file
const font = parseFont(fontBuffer);

console.log(`Font: ${font.familyName}`);
console.log(`Format: ${font.format}`);
console.log(`Glyphs: ${font.glyphCount}`);

// Access glyph data
const glyphA = font.glyphs.find((g) => g.unicode === 65);
console.log(`Glyph A: ${glyphA?.name}, advanceWidth: ${glyphA?.advanceWidth}`);
```

### Font Creation

```typescript
import {
  createFont,
  createGlyphManager,
  type FontOptions,
  type GlyphData,
} from "unglyph";

// Create glyph manager
const manager = createGlyphManager();

// Add custom glyphs
const glyphA: GlyphData = {
  unicode: 65, // 'A'
  name: "A",
  advanceWidth: 600,
  path: {
    commands: [
      { type: "M", x: 300, y: 0 },
      { type: "L", x: 100, y: 700 },
      { type: "L", x: 500, y: 700 },
      { type: "L", x: 300, y: 0 },
    ],
  },
};

manager.add(glyphA);

// Create font
const fontOptions: FontOptions = {
  familyName: "MyFont",
  styleName: "Regular",
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
};

const font = createFont(manager.list(), fontOptions);
// font.data contains the font file buffer (OTF format)
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
  { type: "update", unicode: 66, updates: { advanceWidth: 650 } },
  { type: "remove", unicode: 67 },
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
  renderGlyph,
} from "unglyph";

async function processFont(inputBuffer: ArrayBuffer) {
  // 1. Parse existing font
  const originalFont = parseFont(inputBuffer);

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

  // 4. Create new font with modifications
  const newFont = createFont(modifiedGlyphs, {
    familyName: `${originalFont.familyName} Bold`,
    styleName: "Bold",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
  });

  return newFont;
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
      unicode: icon.unicode,
      name: icon.name,
      advanceWidth: 1000,
      path: {
        commands: parseSVGPath(icon.path), // Convert SVG path to commands
      },
    };
    manager.add(glyph);
  });

  // Create icon font
  return createFont(manager.list(), {
    familyName: "Custom Icons",
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 850,
    descender: -150,
  });
}
```

## 📚 API Reference

### Core Functions

#### `parseFont(input: FontInput): ParseResult`

Parse font file and extract glyph information.

#### `createFont(glyphs: GlyphData[], options: FontOptions): ExportResult`

Create font from glyph data array.

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
  unicode: string | number; // Unicode character or code point
  name?: string; // Optional glyph name
  advanceWidth: number; // Advance width
  leftSideBearing?: number; // Left side bearing
  rightSideBearing?: number; // Right side bearing
  path: PathData; // Path commands
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
