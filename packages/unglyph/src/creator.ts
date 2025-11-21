import * as opentype from "opentype.js";
import type {
  GlyphData,
  FontOptions,
  FontData,
  FontGenerateOptions,
} from "./types";
import { convertToOpentypePath } from "./utils";

/**
 * Create font from glyph data using opentype.js
 */
export function createFont(
  glyphs: GlyphData[],
  options: FontOptions,
): FontData {
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
export function generateFont(
  fontData: FontData,
  options: FontGenerateOptions = {},
): Uint8Array {
  const {
    format = "otf",
    familyName = fontData.familyName || "Untitled Font",
    styleName = "Regular",
    unitsPerEm = fontData.unitsPerEm || 1000,
    ascender = fontData.ascent || 800,
    descender = fontData.descent || -200,
  } = options;

  // Create required .notdef glyph
  const notdefGlyph = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: 650,
    path: new opentype.Path(),
  });

  // Create space glyph if not present
  const hasSpace = fontData.glyphs.some(
    (g) => g.unicode === 32 || g.unicode === " ",
  );
  const otGlyphs: opentype.Glyph[] = [notdefGlyph];

  if (!hasSpace) {
    otGlyphs.push(
      new opentype.Glyph({
        name: "space",
        unicode: 32,
        advanceWidth: 300,
        path: new opentype.Path(),
      }),
    );
  }

  // Convert our unified glyphs to opentype glyphs
  for (const glyph of fontData.glyphs) {
    // Skip space and .notdef as they're already handled
    if (glyph.unicode === 32 || glyph.unicode === " " || glyph.unicode === 0) {
      continue;
    }

    const path = convertToOpentypePath(glyph.path);
    const unicodeValue =
      typeof glyph.unicode === "string"
        ? glyph.unicode.charCodeAt(0)
        : glyph.unicode;

    const otGlyph = new opentype.Glyph({
      name: glyph.name || `glyph${unicodeValue}`,
      unicode: unicodeValue,
      advanceWidth: glyph.advanceWidth,
      path: path,
    });

    otGlyphs.push(otGlyph);
  }

  // Create the font
  const font = new opentype.Font({
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
    case "otf":
      const arrayBuffer = font.toArrayBuffer();
      return new Uint8Array(arrayBuffer);
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
