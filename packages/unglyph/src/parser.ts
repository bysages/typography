import * as fontkit from "fontkit";
import { toUint8Array } from "undio";

import type { ColorFormat, FontInput, FontData, FontMetadata, GlyphData } from "./types";
import { convertFromFontkitGlyph } from "./utils";

function openFont(uint8Array: Uint8Array) {
  const fontResult = fontkit.create(uint8Array as unknown as Buffer);
  // Handle both Font and FontCollection - use the first Font from collection
  return "fonts" in fontResult ? fontResult.fonts[0] : fontResult;
}

const METADATA_NAME_KEYS = [
  "copyright",
  "trademark",
  "manufacturer",
  "designer",
  "description",
  "vendorURL",
  "designerURL",
  "license",
  "licenseURL",
] as const;

const METADATA_FIELDS: Record<(typeof METADATA_NAME_KEYS)[number], keyof FontMetadata> = {
  copyright: "copyright",
  trademark: "trademark",
  manufacturer: "manufacturer",
  designer: "designer",
  description: "description",
  vendorURL: "manufacturerUrl",
  designerURL: "designerUrl",
  license: "license",
  licenseURL: "licenseUrl",
};

function readFontMetadata(font: {
  getName(key: string, lang: string): string | null;
}): FontMetadata {
  const metadata: FontMetadata = {};
  for (const key of METADATA_NAME_KEYS) {
    const value = font.getName(key, "en")?.trim();
    if (value) metadata[METADATA_FIELDS[key]] = value;
  }
  const version = font.getName("version", "en")?.trim();
  if (version) metadata.version = version.replace(/^Version\s+/, "");
  return metadata;
}

/**
 * Read only the name-table metadata of a font without decoding glyphs.
 */
export async function parseFontMetadata(input: FontInput): Promise<FontMetadata> {
  const uint8Array = await toUint8Array(input);
  return readFontMetadata(openFont(uint8Array));
}

/**
 * Parse font file and return FontData
 */
export async function parseFont(input: FontInput): Promise<FontData> {
  // undio normalizes supported input shapes; several conversions resolve
  // asynchronously, so parsing remains await-based across runtimes.
  const uint8Array = await toUint8Array(input);
  const font = openFont(uint8Array);

  const os2 = font["OS/2"];
  const fsSelection = (os2 as unknown as { fsSelection?: number } | undefined)?.fsSelection ?? 0;
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
    metadata: readFontMetadata(font),
    weight: os2?.usWeightClass || undefined,
    italic: font.italicAngle !== 0 || (fsSelection & 0x0001) === 1,
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
      (existing.codePoints ??= []).push(codePoint);
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
