import type { DataType } from "undio";

/**
 * Font input types
 */
export type FontInput = DataType;

/**
 * Unified Glyph interface - our primary glyph data structure
 */
export interface GlyphData {
  /** Glyph index in font */
  index: number;
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
  /** Unicode code points (for ligatures) */
  codePoints?: number[];
  /** Is mark glyph */
  isMark?: boolean;
  /** Is ligature glyph */
  isLigature?: boolean;
}

/**
 * Path commands (unified format)
 */
export type PathCommand =
  | { type: "move"; x: number; y: number }
  | { type: "line"; x: number; y: number }
  | { type: "quadratic"; cx: number; cy: number; x: number; y: number }
  | {
      type: "cubic";
      cx1: number;
      cy1: number;
      cx2: number;
      cy2: number;
      x: number;
      y: number;
    }
  | { type: "close" };

/**
 * Path data structure
 */
export interface PathData {
  commands: PathCommand[];
  bounds?: BoundingBox;
}

/**
 * Bounding box
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
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
 * Base rendering options
 */
export interface BaseRenderOptions {
  /** Size in pixels */
  size: number;
  /** Color */
  color?: string;
}

/**
 * SVG rendering options
 */
export interface SVGRenderOptions extends BaseRenderOptions {
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
 * Canvas rendering options
 */
export interface CanvasRenderOptions extends BaseRenderOptions {
  /** Canvas 2D rendering context */
  ctx: any; // Compatible with both browser Canvas and @napi-rs/canvas
  /** X position */
  x: number;
  /** Y position */
  y: number;
}

/**
 * Image rendering options
 */
export interface ImageRenderOptions extends BaseRenderOptions {
  /** Background color */
  backgroundColor?: string;
  /** Padding */
  padding?: number;
  /** Image format */
  format: "png" | "jpeg" | "webp";
  /** Image quality (for JPEG/WebP) */
  quality?: number;
}

/**
 * Unified render options type
 */
export type RenderOptions =
  | SVGRenderOptions
  | CanvasRenderOptions
  | ImageRenderOptions;

/**
 * Batch glyph operation
 */
export type GlyphOperation =
  | { type: "add"; glyph: GlyphData }
  | { type: "update"; index: number; updates: Partial<GlyphData> }
  | { type: "remove"; index: number };

/**
 * Font export format
 */
export type FontFormat = "ttf" | "otf" | "woff" | "woff2";

/**
 * Font generation options
 */
export interface FontGenerateOptions {
  /** Export format */
  format?: FontFormat;
  /** Font family name (optional, uses font's family name if not provided) */
  familyName?: string;
  /** Style name */
  styleName?: string;
  /** Units per em (optional, uses font's value if not provided) */
  unitsPerEm?: number;
  /** Ascender height (optional, uses font's value if not provided) */
  ascender?: number;
  /** Descender depth (optional, uses font's value if not provided) */
  descender?: number;
}

/**
 * Unified Font Data - data structure for font information
 */
export interface FontData {
  // Font metadata (from parsed fonts)
  familyName?: string;
  format?: string;
  unitsPerEm?: number;
  ascent?: number;
  descent?: number;
  lineGap?: number;
  capHeight?: number;
  xHeight?: number;
  version?: string;
  copyright?: string;
  weight?: number;
  italic?: boolean;
  styleName?: string;

  // Glyph data
  glyphs: GlyphData[];
}
