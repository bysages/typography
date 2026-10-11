import opentypeModule from "opentype.js";
import type * as opentype from "opentype.js";

// opentype.js 2.x ships CJS; constructors live on the default export in Node ESM.
const ot = ((opentypeModule as unknown as { default?: typeof opentype }).default ??
  opentypeModule) as typeof opentype;

import type { GlyphData, FontOptions, FontData, FontGenerateOptions } from "./types";
import { convertToOpentypePath } from "./utils";

/**
 * Create font from glyph data using opentype.js
 */
export function createFont(glyphs: GlyphData[], options: FontOptions): FontData {
  return {
    familyName: options.familyName,
    unitsPerEm: options.unitsPerEm || 1000,
    ascent: options.ascender || 800,
    descent: options.descender || -200,
    glyphs,
  };
}

/**
 * Generate font file from FontData
 */
export function generateFont(fontData: FontData, options: FontGenerateOptions = {}): Uint8Array {
  const {
    format = "otf",
    familyName = fontData.familyName || "Untitled Font",
    styleName = "Regular",
    unitsPerEm = fontData.unitsPerEm || 1000,
    ascender = fontData.ascent || 800,
    descender = fontData.descent || -200,
  } = options;

  // Create required .notdef glyph
  const notdefGlyph = new ot.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: 650,
    path: new ot.Path(),
  });

  // Create space glyph if not present
  const hasSpace = fontData.glyphs.some((g) => g.unicode === 32 || g.unicode === " ");
  const otGlyphs: opentype.Glyph[] = [notdefGlyph];

  if (!hasSpace) {
    otGlyphs.push(
      new ot.Glyph({
        name: "space",
        unicode: 32,
        advanceWidth: 300,
        path: new ot.Path(),
      }),
    );
  }

  // Convert our unified glyphs to opentype glyphs
  for (const glyph of fontData.glyphs) {
    // Skip space and .notdef as they're already handled
    if (glyph.unicode === 32 || glyph.unicode === " " || glyph.unicode === 0) {
      continue;
    }

    const path = convertToOpentypePath(glyph.path, fontData.ascent || 0);
    const unicodeValue =
      typeof glyph.unicode === "string" ? (glyph.unicode.codePointAt(0) ?? 0) : glyph.unicode;

    const otGlyph = new ot.Glyph({
      name: glyph.name || `glyph${unicodeValue}`,
      unicode: unicodeValue,
      advanceWidth: glyph.advanceWidth,
      path: path,
    });

    otGlyphs.push(otGlyph);
  }

  // Create the font
  const font = new ot.Font({
    familyName,
    styleName,
    unitsPerEm,
    ascender,
    descender,
    glyphs: otGlyphs,
  });

  // Convert to buffer based on format
  switch (format) {
    case "ttf":
    case "otf": {
      // opentype.js 2.x hardcodes the OTTO signature while writing glyf
      // outlines, which strict consumers such as subset-font reject.
      const bytes = new Uint8Array(font.toArrayBuffer());
      bytes.set([0x00, 0x01, 0x00, 0x00], 0);
      return bytes;
    }
    case "woff":
      // For WOFF, we'd need additional library support
      throw new Error("WOFF format not yet implemented");
    case "woff2":
      // For WOFF2, we'd need additional library support
      throw new Error("WOFF2 format not yet implemented");
    default:
      throw new Error(`Unsupported format: ${format as string}`);
  }
}
