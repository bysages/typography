import * as fontkit from "fontkit";
import { toUint8Array } from "undio";
import type { FontInput, FontData } from "./types";
import { convertFromFontkitGlyph } from "./utils";

/**
 * Parse font file and return FontData
 */
export function parseFont(input: FontInput): FontData {
  // Convert input to Uint8Array using undio
  const uint8Array = toUint8Array(input);

  // Parse font using fontkit
  const fontResult = fontkit.create(uint8Array);

  // Handle both Font and FontCollection - use the first Font from collection
  const font = "fonts" in fontResult ? fontResult.fonts[0] : fontResult;

  const fontData: FontData = {
    familyName: font.familyName || font.postscriptName || "Unknown",
    format: font.type,
    unitsPerEm: font.unitsPerEm,
    ascent: font.ascent,
    descent: font.descent,
    lineGap: font.lineGap,
    capHeight: font.capHeight,
    xHeight: font.xHeight,
    // Additional metadata from fontkit
    version: font.version ? font.version.toString() : undefined,
    copyright: font.copyright || undefined,
    weight: font["OS/2"]?.usWeightClass || undefined,
    italic: font.italicAngle !== 0,
    styleName: font.subfamilyName || "Regular",
    glyphs: [],
  };

  // Extract all glyphs from the font's character set
  // This ensures we only get glyphs that actually have Unicode mappings
  for (const codePoint of font.characterSet) {
    const fontkitGlyph = font.glyphForCodePoint(codePoint);

    if (fontkitGlyph) {
      // Convert fontkit glyph to our unified format
      const glyph = convertFromFontkitGlyph(
        fontkitGlyph,
        fontkitGlyph.id,
        font.ascent,
        codePoint,
      );
      fontData.glyphs.push(glyph);
    }
  }

  return fontData;
}
