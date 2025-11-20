import type { DataType } from "undio";

// Re-export DataType for convenience
export type { DataType } from "undio";

/**
 * Font input types
 */
export type FontInput = DataType;

/**
 * Glyph data structure
 */
export interface GlyphData {
  /** Unicode character or code point */
  unicode: string | number;
  /** Optional glyph name */
  name?: string;
  /** Advance width */
  advanceWidth: number;
  /** Path commands */
  path: PathData;
  /** Left side bearing (optional) */
  leftSideBearing?: number;
  /** Right side bearing (optional) */
  rightSideBearing?: number;
}

/**
 * Path commands
 */
export type PathCommand =
  | { type: "M"; x: number; y: number } // MoveTo
  | { type: "L"; x: number; y: number } // LineTo
  | { type: "Q"; cx: number; cy: number; x: number; y: number } // QuadraticCurve
  | {
      type: "C";
      cx1: number;
      cy1: number;
      cx2: number;
      cy2: number;
      x: number;
      y: number;
    } // CubicCurve
  | { type: "Z" }; // ClosePath

/**
 * Path data structure
 */
export interface PathData {
  commands: PathCommand[];
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Font options
 */
export interface FontOptions {
  /** Font family name */
  familyName: string;
  /** Style name */
  styleName?: string;
  /** Units per em */
  unitsPerEm?: number;
  /** Ascender height */
  ascender?: number;
  /** Descender depth */
  descender?: number;
  /** Font weight (100-900) */
  weight?: number;
  /** Font style: normal or italic */
  italic?: boolean;
}

/**
 * Rendering options
 */
export interface RenderOptions {
  /** Size in pixels */
  size: number;
  /** Color */
  color?: string;
  /** Background color */
  backgroundColor?: string;
  /** Padding */
  padding?: number;
  /** Stroke color */
  strokeColor?: string;
  /** Stroke width */
  strokeWidth?: number;
}

/**
 * Batch glyph operation
 */
export type GlyphOperation =
  | { type: "add"; glyph: GlyphData }
  | { type: "update"; unicode: string | number; updates: Partial<GlyphData> }
  | { type: "remove"; unicode: string | number };

/**
 * Font export format
 */
export type FontFormat = "ttf" | "otf" | "woff" | "woff2";

/**
 * Parse result
 */
export interface ParseResult {
  glyphs: GlyphData[];
  format: string;
  familyName: string;
  glyphCount: number;
}

/**
 * Export result
 */
export interface ExportResult {
  data: ArrayBuffer;
  format: FontFormat;
  size: number;
}
