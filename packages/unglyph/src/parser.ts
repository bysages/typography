import * as fontkit from "fontkit";
import { toUint8Array } from "undio";

import type { ColorFormat, FontInput, FontData, GlyphData } from "./types";
import { convertFromFontkitGlyph } from "./utils";

/**
 * Parse font file and return FontData
 */
export async function parseFont(input: FontInput): Promise<FontData> {
  // undio normalizes every supported input (paths and streams included),
  // and several of them only resolve asynchronously.
  const uint8Array = await toUint8Array(input);

  // Parse font using fontkit
  const fontResult = fontkit.create(uint8Array);

  // Handle both Font and FontCollection - use the first Font from collection
  const font = "fonts" in fontResult ? fontResult.fonts[0] : fontResult;

  const os2 = font["OS/2"];
  const variationAxes: FontData["variationAxes"] = {};
  for (const [axisTag, axis] of Object.entries(font.variationAxes ?? {})) {
    variationAxes[axisTag] = {
      name: (axis as { name?: string }).name ?? axisTag,
      min: (axis as { min: number }).min,
      default: (axis as { default: number }).default,
      max: (axis as { max: number }).max,
    };
  }

  const colorFormats: ColorFormat[] = [];
  const tableSource = font as unknown as Record<string, unknown>;
  if (tableSource.COLR) {
    colorFormats.push(
      (tableSource.COLR as { version?: number }).version === 1 ? "COLRv1" : "COLRv0",
    );
  }
  if (tableSource.CBDT || tableSource.CBLC) colorFormats.push("CBDT");
  if (tableSource.sbix) colorFormats.push("sbix");
  if (tableSource.SVG) colorFormats.push("SVG");

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
    weight: os2?.usWeightClass || undefined,
    italic: font.italicAngle !== 0,
    styleName: font.subfamilyName || "Regular",
    postscriptName: font.postscriptName || undefined,
    fullName: font.fullName || undefined,
    widthClass: os2?.usWidthClass || undefined,
    variationAxes: Object.keys(variationAxes).length > 0 ? variationAxes : undefined,
    colorFormats: colorFormats.length > 0 ? colorFormats : undefined,
    glyphs: [],
  };

  // Extract all glyphs from the font's character set, deduplicated by glyph id.
  // Multiple code points frequently map to the same GID; all of them are kept
  // in the glyph's codePoints list.
  const glyphsById = new Map<number, GlyphData>();
  for (const codePoint of font.characterSet) {
    const fontkitGlyph = font.glyphForCodePoint(codePoint);
    if (!fontkitGlyph) continue;

    const existing = glyphsById.get(fontkitGlyph.id);
    if (existing) {
      existing.codePoints = [...(existing.codePoints ?? []), codePoint];
      continue;
    }

    const glyph = convertFromFontkitGlyph(fontkitGlyph, fontkitGlyph.id, font.ascent, codePoint);
    glyphsById.set(fontkitGlyph.id, glyph);
  }
  // Keep the .notdef glyph (gid 0) so layout can fall back to it for
  // missing characters even when the cmap has no mapping for it.
  if (!glyphsById.has(0)) {
    const notdef = (
      font as unknown as { glyphs?: { get(id: number): import("fontkit").Glyph | undefined } }
    ).glyphs?.get(0);
    if (notdef) {
      glyphsById.set(0, convertFromFontkitGlyph(notdef, 0, font.ascent, 0));
    }
  }
  fontData.glyphs = [...glyphsById.values()];

  return fontData;
}
