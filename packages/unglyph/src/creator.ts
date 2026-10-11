import opentypeModule from "opentype.js";
import type * as opentype from "opentype.js";

// opentype.js 2.x ships CJS; constructors live on the default export in Node ESM.
const ot = ((opentypeModule as unknown as { default?: typeof opentype }).default ??
  opentypeModule) as typeof opentype;

import { compress as compressWoff2 } from "woff2-encoder";

import { sfntToWoff } from "./subsetter";
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
export async function generateFont(
  fontData: FontData,
  options: FontGenerateOptions = {},
): Promise<Uint8Array> {
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

  // Convert our unified glyphs to opentype glyphs. Only gid 0 is rebuilt here;
  // an existing space glyph keeps its parsed advance and path.
  for (const glyph of fontData.glyphs) {
    if (glyph.unicode === 0) {
      continue;
    }

    const path = convertToOpentypePath(glyph.path, ascender);
    // The primary mapping is glyph.unicode; codePoints adds any further
    // cmap entries the parser discovered for the same glyph.
    const primary =
      typeof glyph.unicode === "string"
        ? (glyph.unicode.codePointAt(0) ?? 0)
        : (glyph.unicode ?? 0);
    const unicodes = [...new Set([primary, ...(glyph.codePoints ?? [])])];

    const otGlyph = new ot.Glyph({
      name: glyph.name || `glyph${primary}`,
      unicode: primary,
      unicodes,
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

  const bytes = new Uint8Array(font.toArrayBuffer());
  // opentype.js writes CFF outlines under the OTTO signature; that sfnt is
  // valid as-is and is what the container formats wrap.
  switch (format) {
    case "otf":
      return bytes;
    case "woff":
      return sfntToWoff(bytes);
    case "woff2":
      return compressWoff2(bytes);
    default:
      throw new Error(
        `Unsupported font format: ${format as string}. TrueType (glyf) outlines are not generated; use "otf", "woff", or "woff2".`,
      );
  }
}
