import opentypeModule from "opentype.js";
import type * as opentype from "opentype.js";

// opentype.js 2.x ships CJS; constructors live on the default export in Node ESM.
const ot = ((opentypeModule as unknown as { default?: typeof opentype }).default ??
  opentypeModule) as typeof opentype;

import { compress as compressWoff2 } from "woff2-encoder";

import { sfntToWoff } from "./subsetter";
import { buildTrueTypeFont } from "./truetype";
import type { FontData, FontMetadata, FontOptions, FontGenerateOptions, GlyphData } from "./types";
import { convertToOpentypePath } from "./utils";

/**
 * Create font from glyph data using opentype.js
 */
export function createFont(glyphs: GlyphData[], options: FontOptions): FontData {
  return {
    familyName: options.familyName,
    styleName: options.styleName,
    postscriptName: options.postscriptName,
    fullName: options.fullName,
    weight: options.weight,
    italic: options.italic,
    unitsPerEm: options.unitsPerEm || 1000,
    ascent: options.ascender || 800,
    descent: options.descender || -200,
    lineGap: options.lineGap,
    capHeight: options.capHeight,
    xHeight: options.xHeight,
    widthClass: options.widthClass,
    metadata: options.metadata,
    glyphs,
  };
}

/**
 * OTS requires the CFF Name INDEX entry to be printable ASCII (0x21-0x7E) and
 * at most 63 bytes; anything else makes browsers reject the whole font.
 */
export function toPostScriptName(family: string, style: string): string {
  // Keep only the name-table characters that are safe across OTS, CFF, and
  // filesystem consumers. Escaping by whole character prevents truncated
  // surrogate pairs and partial uXXXX escapes.
  const tokens = Array.from(`${family}-${style}`).map((char) => {
    const code = char.codePointAt(0) ?? 0;
    if (char === "-") return char;
    if (
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a)
    ) {
      return char;
    }
    if (code <= 0x20 || code === 0x7f) return "-";
    return `u${code.toString(16)}`;
  });

  let name = "";
  for (const token of tokens) {
    if (name.length + token.length > 63) break;
    name += token;
  }
  name = name.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  return name || "UntitledFont";
}

/**
 * Ensure the glyph list starts with .notdef and contains a space glyph;
 * opentype.js and the TrueType writer both expect that baseline.
 */
function prepareGlyphs(fontData: FontData): GlyphData[] {
  const result: GlyphData[] = [];
  const parsedNotdef = fontData.glyphs.find((glyph) => glyph.unicode === 0);
  result.push({
    ...parsedNotdef,
    index: 0,
    unicode: 0,
    name: parsedNotdef?.name ?? ".notdef",
    advanceWidth: parsedNotdef?.advanceWidth ?? 650,
    path: parsedNotdef?.path ?? { commands: [] },
  });
  const hasSpace = fontData.glyphs.some((glyph) => glyph.unicode === 32 || glyph.unicode === " ");
  if (!hasSpace) {
    result.push({
      index: result.length,
      unicode: 32,
      name: "space",
      advanceWidth: 300,
      path: { commands: [] },
    });
  }
  for (const glyph of fontData.glyphs) {
    if (glyph.unicode === 0) continue;
    result.push({ ...glyph, index: result.length });
  }
  return result;
}

function toOpentypeGlyph(glyph: GlyphData, ascender: number): opentype.Glyph {
  const path = convertToOpentypePath(glyph.path, ascender);
  // The primary mapping is glyph.unicode; codePoints adds any further
  // cmap entries the parser discovered for the same glyph.
  const primary =
    typeof glyph.unicode === "string" ? (glyph.unicode.codePointAt(0) ?? 0) : (glyph.unicode ?? 0);
  const unicodes = [...new Set([primary, ...(glyph.codePoints ?? [])])].filter(
    (code) => code !== 0 || glyph.name === ".notdef",
  );
  return new ot.Glyph({
    name: glyph.name || `glyph${primary}`,
    unicode: primary,
    unicodes,
    advanceWidth: glyph.advanceWidth,
    path,
  });
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
    styleName = fontData.styleName || "Regular",
    unitsPerEm = fontData.unitsPerEm || 1000,
    ascender = fontData.ascent || 800,
    descender = fontData.descent || -200,
    metadata: metadataOverride,
  } = options;
  const metadata: FontMetadata = metadataOverride ?? fontData.metadata ?? {};
  const version = metadata.version ?? fontData.version;
  const versionText = version
    ? version.startsWith("Version ")
      ? version
      : `Version ${version}`
    : undefined;
  // Keep the parsed PostScript name only when the family was not overridden,
  // so renamed fonts derive a fresh OTS-safe name instead of the stale one.
  const familyUnchanged = familyName === (fontData.familyName || "Untitled Font");
  const postscriptName =
    (familyUnchanged && fontData.postscriptName) || toPostScriptName(familyName, styleName);
  const fullName = fontData.fullName || `${familyName} ${styleName}`;
  const os2Overrides: Record<string, number> = {};
  if (fontData.xHeight !== undefined) os2Overrides.sxHeight = Math.round(fontData.xHeight);
  if (fontData.capHeight !== undefined) os2Overrides.sCapHeight = Math.round(fontData.capHeight);
  if (fontData.lineGap !== undefined) os2Overrides.sTypoLineGap = Math.round(fontData.lineGap);
  const processed = prepareGlyphs(fontData);

  if (format === "ttf") {
    return buildTrueTypeFont(
      { ...fontData, glyphs: processed },
      {
        familyName,
        styleName,
        postscriptName,
        fullName,
        unitsPerEm,
        ascent: ascender,
        descent: descender,
        lineGap: fontData.lineGap,
        weight: fontData.weight,
        widthClass: fontData.widthClass,
        italic: fontData.italic,
        metadata: { ...metadata, version: versionText?.replace(/^Version /, "") },
      },
    );
  }

  // Reuse the parsed .notdef outline and advance when present so a
  // generate round-trip keeps the original gid 0; otherwise synthesize an
  // empty one (opentype.js requires a .notdef glyph to exist).
  const otGlyphs = processed.map((glyph) => toOpentypeGlyph(glyph, ascender));

  // Create the font
  // opentype.js reads all name-table strings from top-level options.
  const font = new ot.Font({
    familyName,
    styleName,
    unitsPerEm,
    ascender,
    descender,
    weightClass: fontData.weight,
    widthClass: fontData.widthClass,
    fullName,
    postScriptName: postscriptName,
    ...(Object.keys(os2Overrides).length > 0 ? { tables: { os2: os2Overrides } } : {}),
    italicAngle: fontData.italic ? -12 : 0,
    ...(versionText ? { version: versionText } : {}),
    ...(metadata.copyright ? { copyright: metadata.copyright } : {}),
    ...(metadata.trademark ? { trademark: metadata.trademark } : {}),
    ...(metadata.manufacturer ? { manufacturer: metadata.manufacturer } : {}),
    ...(metadata.designer ? { designer: metadata.designer } : {}),
    ...(metadata.description ? { description: metadata.description } : {}),
    ...(metadata.manufacturerUrl ? { manufacturerURL: metadata.manufacturerUrl } : {}),
    ...(metadata.designerUrl ? { designerURL: metadata.designerUrl } : {}),
    ...(metadata.license ? { license: metadata.license } : {}),
    ...(metadata.licenseUrl ? { licenseURL: metadata.licenseUrl } : {}),
    glyphs: otGlyphs,
  } as unknown as opentype.FontConstructorOptions);

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
        `Unsupported font format: ${format as string}. Use "ttf", "otf", "woff", or "woff2".`,
      );
  }
}
