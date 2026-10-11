/**
 * Simple horizontal text layout and SVG rendering over parsed FontData.
 * No OpenType shaping: advance widths (plus optional letter spacing) only,
 * so complex scripts and kerning are approximated.
 */

import type { BoundingBox, FontData, GlyphData, SVGRenderOptions } from "./types";
import { escapeSvgAttr } from "./utils";

export interface TextLayoutOptions {
  /** Extra spacing between glyphs, in font units. */
  letterSpacing?: number;
}

export interface TextLayout {
  glyphs: { glyph: GlyphData; x: number }[];
  /** Total advance width in font units. */
  width: number;
  /** Ink bounds of the laid-out text, in font units, when available. */
  bounds?: BoundingBox;
  /** Characters without a glyph in the font, in input order. */
  missing: string[];
}

/** Index glyphs by code point once so layout avoids a linear scan per char. */
function buildGlyphIndex(font: FontData): Map<number, GlyphData> {
  const index = new Map<number, GlyphData>();
  for (const glyph of font.glyphs) {
    const codePoint =
      typeof glyph.unicode === "string" ? glyph.unicode.codePointAt(0) : glyph.unicode;
    if (codePoint !== undefined && !index.has(codePoint)) index.set(codePoint, glyph);
    for (const cp of glyph.codePoints ?? []) {
      if (!index.has(cp)) index.set(cp, glyph);
    }
  }
  return index;
}

/** Lay out text on a horizontal baseline, in font units. */
export function layoutText(
  text: string,
  font: FontData,
  options: TextLayoutOptions = {},
): TextLayout {
  const letterSpacing = options.letterSpacing ?? 0;
  const glyphs: TextLayout["glyphs"] = [];
  const missing: string[] = [];
  const glyphIndex = buildGlyphIndex(font);
  const notdef = glyphIndex.get(0);
  let x = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const char of text) {
    const glyph = glyphIndex.get(char.codePointAt(0) ?? Number.NaN);
    if (!glyph) {
      missing.push(char);
      // Reserve the .notdef advance so following glyphs keep their positions.
      if (notdef) x += notdef.advanceWidth + letterSpacing;
      continue;
    }
    glyphs.push({ glyph, x });
    if (glyph.path.bounds) {
      minX = Math.min(minX, glyph.path.bounds.minX + x);
      minY = Math.min(minY, glyph.path.bounds.minY);
      maxX = Math.max(maxX, glyph.path.bounds.maxX + x);
      maxY = Math.max(maxY, glyph.path.bounds.maxY);
    }
    x += glyph.advanceWidth + letterSpacing;
  }

  const bounds =
    glyphs.length > 0 && Number.isFinite(minX)
      ? { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
      : undefined;

  // Width reflects the accumulated advances even when every character is
  // missing and only .notdef placeholders occupy the run.
  return {
    glyphs,
    width: text.length > 0 ? Math.max(0, x - letterSpacing) : 0,
    bounds,
    missing,
  };
}

function commandsToSVG(commands: GlyphData["path"]["commands"], dx: number): string {
  return commands
    .map((cmd) => {
      switch (cmd.type) {
        case "move":
          return `M ${cmd.x + dx} ${cmd.y}`;
        case "line":
          return `L ${cmd.x + dx} ${cmd.y}`;
        case "quadratic":
          return `Q ${cmd.cx + dx} ${cmd.cy} ${cmd.x + dx} ${cmd.y}`;
        case "cubic":
          return `C ${cmd.cx1 + dx} ${cmd.cy1} ${cmd.cx2 + dx} ${cmd.cy2} ${cmd.x + dx} ${cmd.y}`;
        case "close":
          return "Z";
      }
    })
    .join(" ");
}

export interface TextSVGOptions extends SVGRenderOptions {
  /** Extra spacing between glyphs, in font units. */
  letterSpacing?: number;
}

/** Render laid-out text as a standalone SVG string. */
export function renderTextToSVG(text: string, font: FontData, options: TextSVGOptions): string {
  const unitsPerEm = font.unitsPerEm ?? 1000;
  if (!Number.isFinite(options.size) || options.size <= 0) {
    throw new RangeError(`size must be a positive number, received ${options.size}`);
  }
  if (!Number.isFinite(unitsPerEm) || unitsPerEm <= 0) {
    throw new RangeError(`unitsPerEm must be a positive number, received ${unitsPerEm}`);
  }
  const scale = options.size / unitsPerEm;
  const padding = options.padding ?? 0;
  const layout = layoutText(text, font, { letterSpacing: options.letterSpacing });

  const bounds = layout.bounds ?? {
    minX: 0,
    minY: 0,
    maxX: layout.width,
    maxY: unitsPerEm * 0.8,
    width: layout.width,
    height: unitsPerEm * 0.8,
  };

  const paths = layout.glyphs
    .map(({ glyph, x }) => {
      const d = commandsToSVG(glyph.path.commands, x);
      return d.length > 0 ? `<path d="${d}"/>` : "";
    })
    .filter(Boolean)
    .join("");

  const padUnits = padding / scale;
  const vbX = bounds.minX - padUnits;
  const vbY = bounds.minY - padUnits;
  const vbWidth = bounds.width + padUnits * 2;
  const vbHeight = bounds.height + padUnits * 2;
  const fill = escapeSvgAttr(options.color ?? "#000000");
  const stroke =
    options.strokeColor && options.strokeWidth
      ? ` stroke="${escapeSvgAttr(options.strokeColor)}" stroke-width="${(options.strokeWidth / scale).toFixed(2)}"`
      : "";
  const background = options.backgroundColor
    ? `<rect x="${vbX}" y="${vbY}" width="${vbWidth}" height="${vbHeight}" fill="${escapeSvgAttr(options.backgroundColor)}"/>`
    : "";
  // Surface missing glyphs on the root element; renderers never silently drop
  // characters without a detectable trace.
  const missingAttr =
    layout.missing.length > 0
      ? ` data-missing="${layout.missing.map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase()}`).join(" ")}"`
      : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" data-missing${missingAttr} width="${(vbWidth * scale).toFixed(2)}" height="${(vbHeight * scale).toFixed(2)}" viewBox="${vbX.toFixed(2)} ${vbY.toFixed(2)} ${vbWidth.toFixed(2)} ${vbHeight.toFixed(2)}">`,
    background,
    `<g fill="${fill}"${stroke}>${paths}</g>`,
    "</svg>",
  ].join("");
}
