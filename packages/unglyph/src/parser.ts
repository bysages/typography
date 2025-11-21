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
    familyName: font.familyName,
    format: font.type,
    unitsPerEm: font.unitsPerEm,
    ascent: font.ascent,
    descent: font.descent,
    lineGap: font.lineGap,
    capHeight: font.capHeight,
    xHeight: font.xHeight,
    glyphs: [],
  };

  // Extract specific glyphs we need (A, B, C, space)
  const targetChars = [
    { char: "A", unicode: 65 },
    { char: "B", unicode: 66 },
    { char: "C", unicode: 67 },
    { char: " ", unicode: 32 },
  ];

  for (const { unicode } of targetChars) {
    const fontkitGlyph = font.glyphForCodePoint(unicode);

    if (fontkitGlyph) {
      // Convert fontkit glyph to our unified format
      // Space characters may not have path commands, which is normal
      const glyph = convertFromFontkitGlyph(
        fontkitGlyph,
        fontkitGlyph.id,
        font.ascent,
        unicode,
      );
      fontData.glyphs.push(glyph);
    }
  }

  return fontData;
}
