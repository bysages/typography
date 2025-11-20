import * as fontkit from "fontkit";
import { toArrayBuffer } from "undio";
import type { FontInput, GlyphData, PathCommand, ParseResult } from "./types";

/**
 * Parse font file and extract glyph data
 */
export function parseFont(input: FontInput): ParseResult {
  // Convert input to buffer using undio
  let arrayBuffer = toArrayBuffer(input);

  // For ArrayBuffers, create a fresh copy to ensure compatibility
  if (arrayBuffer instanceof ArrayBuffer) {
    const tempArray = new Uint8Array(arrayBuffer);
    arrayBuffer = tempArray.buffer.slice(
      tempArray.byteOffset,
      tempArray.byteOffset + tempArray.byteLength,
    );
  }

  // Parse font using fontkit
  const fontResult = fontkit.create(arrayBuffer);

  // Handle both Font and FontCollection
  const font = "fonts" in fontResult ? fontResult.fonts[0] : fontResult;

  // Extract glyphs
  const glyphs: GlyphData[] = [];

  for (let i = 0; i < font.numGlyphs; i++) {
    const fontGlyph = font.getGlyph(i);

    // Skip empty glyphs
    if (!fontGlyph.path || fontGlyph.path.commands.length === 0) {
      continue;
    }

    // Convert fontkit path to our path format
    const commands: PathCommand[] = [];
    for (const cmd of fontGlyph.path.commands) {
      switch (cmd.command) {
        case "moveTo":
          commands.push({ type: "M", x: cmd.args[0], y: cmd.args[1] });
          break;
        case "lineTo":
          commands.push({ type: "L", x: cmd.args[0], y: cmd.args[1] });
          break;
        case "quadraticCurveTo":
          commands.push({
            type: "Q",
            cx: cmd.args[0],
            cy: cmd.args[1],
            x: cmd.args[2],
            y: cmd.args[3],
          });
          break;
        case "bezierCurveTo":
          commands.push({
            type: "C",
            cx1: cmd.args[0],
            cy1: cmd.args[1],
            cx2: cmd.args[2],
            cy2: cmd.args[3],
            x: cmd.args[4],
            y: cmd.args[5],
          });
          break;
        case "closePath":
          commands.push({ type: "Z" });
          break;
      }
    }

    // Create glyph data
    const glyph: GlyphData = {
      unicode: fontGlyph.codePoints[0] || i, // Use first code point or index
      name: fontGlyph.name || `glyph${i}`,
      advanceWidth: fontGlyph.advanceWidth,
      path: {
        commands,
        bounds: {
          minX: fontGlyph.bbox.minX,
          minY: fontGlyph.bbox.minY,
          maxX: fontGlyph.bbox.maxX,
          maxY: fontGlyph.bbox.maxY,
        },
      },
    };

    glyphs.push(glyph);
  }

  return {
    glyphs,
    format: font.type || "unknown",
    familyName: font.familyName || "Unknown",
    glyphCount: glyphs.length,
  };
}
