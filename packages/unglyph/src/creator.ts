import * as opentype from "opentype.js";
import type { GlyphData, FontOptions, ExportResult } from "./types";

/**
 * Convert unglyph PathCommand to opentype.Path
 */
function convertToOpenTypePath(
  commands: GlyphData["path"]["commands"],
): opentype.Path {
  const path = new opentype.Path();

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        path.moveTo(cmd.x, cmd.y);
        break;
      case "L":
        path.lineTo(cmd.x, cmd.y);
        break;
      case "Q":
        path.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y);
        break;
      case "C":
        path.bezierCurveTo(cmd.cx1, cmd.cy1, cmd.cx2, cmd.cy2, cmd.x, cmd.y);
        break;
      case "Z":
        path.close();
        break;
    }
  }

  return path;
}

/**
 * Create font from glyph data using opentype.js
 */
export function createFont(
  glyphs: GlyphData[],
  options: FontOptions,
): ExportResult {
  // Create required .notdef glyph
  const notdefGlyph = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: 650,
    path: new opentype.Path(),
  });

  // Create space glyph if not present
  const hasSpace = glyphs.some((g) => g.unicode === 32 || g.unicode === " ");
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

  // Convert our glyph data to opentype glyphs
  for (const glyph of glyphs) {
    // Skip space and .notdef as they're already handled
    if (glyph.unicode === 32 || glyph.unicode === " " || glyph.unicode === 0) {
      continue;
    }

    const path = convertToOpenTypePath(glyph.path.commands);
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
    familyName: options.familyName,
    styleName: options.styleName || "Regular",
    unitsPerEm: options.unitsPerEm || 1000,
    ascender: options.ascender || 800,
    descender: options.descender || -200,
    glyphs: otGlyphs,
  });

  // Convert to ArrayBuffer
  const buffer = font.toArrayBuffer();

  return {
    data: buffer,
    format: "otf",
    size: buffer.byteLength,
  };
}
