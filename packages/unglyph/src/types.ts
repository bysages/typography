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
 * OpenType `name` table metadata accepted at font creation time.
 */
export interface FontMetadata {
  /** Copyright notice (nameID 0). */
  copyright?: string;
  /** Trademark (nameID 7). */
  trademark?: string;
  /** Manufacturer / vendor name (nameID 8). */
  manufacturer?: string;
  /** Designer name (nameID 9). */
  designer?: string;
  /** Long description (nameID 10). */
  description?: string;
  /** Vendor URL (nameID 11). */
  manufacturerUrl?: string;
  /** Designer URL (nameID 12). */
  designerUrl?: string;
  /** License text (nameID 13). */
  license?: string;
  /** License URL (nameID 14). */
  licenseUrl?: string;
  /** Version string, e.g. "1.0.0" (nameID 5); a "Version " prefix is added when missing. */
  version?: string;
}

/**
 * Font options
 */
export interface FontOptions {
  /** Additional name-table metadata written through to generated fonts. */
  metadata?: FontMetadata;
  /** Font family name */
  familyName: string;
  /** Explicit PostScript name; derived from family/style when omitted. */
  postscriptName?: string;
  /** Explicit full name; derived from family + style when omitted. */
  fullName?: string;
  /** hhea line gap (written to OS/2 typo metrics on CFF output). */
  lineGap?: number;
  /** OS/2 capital height. */
  capHeight?: number;
  /** OS/2 lowercase height. */
  xHeight?: number;
  /** OS/2 width class (1-9). */
  widthClass?: number;
  /** Style name */
  styleName?: string;
  /** Units per em */
  unitsPerEm?: number;
  /** Ascender height */
  ascender?: number;
  /** Descender depth */
  descender?: number;
  /** OS/2 usWeightClass for the default instance (e.g. 400). */
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
  /** Font units per em for scaling. Defaults to 1000. */
  unitsPerEm?: number;
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
 * Minimal 2D canvas context surface the renderer needs; structurally
 * compatible with the browser CanvasRenderingContext2D and @napi-rs/canvas.
 */
export interface CanvasContext2D {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(cx1: number, cy1: number, cx2: number, cy2: number, x: number, y: number): void;
  fill(): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
}

/**
 * Canvas rendering options
 */
export interface CanvasRenderOptions extends BaseRenderOptions {
  /** Font units per em for scaling. Defaults to 1000. */
  unitsPerEm?: number;
  /** Canvas 2D rendering context */
  ctx: CanvasContext2D;
  /** X position */
  x: number;
  /** Y position */
  y: number;
}

/**
 * Image rendering options
 */
export interface ImageRenderOptions extends BaseRenderOptions {
  /** Font units per em for scaling. Defaults to 1000. */
  unitsPerEm?: number;
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
export type RenderOptions = SVGRenderOptions | CanvasRenderOptions | ImageRenderOptions;

/**
 * Batch glyph operation
 */
export type GlyphOperation =
  | { type: "add"; glyph: GlyphData }
  | { type: "update"; index: number; updates: Partial<GlyphData> }
  | { type: "remove"; index: number };

/**
 * Font export format. TTF uses TrueType glyf outlines; OTF uses CFF outlines.
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
  /** Additional name-table metadata; overrides `FontData.metadata`. */
  metadata?: FontMetadata;
}

/**
 * Unified Font Data - data structure for font information
 */
export interface FontData {
  // Font metadata (from parsed fonts)
  familyName?: string;
  /** Name-table metadata captured at creation time. */
  metadata?: FontMetadata;
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

  postscriptName?: string;
  fullName?: string;
  /** OS/2 usWidthClass (1-9). */
  widthClass?: number;
  /** Variable font axes, e.g. { wght: { min, default, max } }. */
  variationAxes?: Record<string, VariationAxisInfo>;
  /** Color font capabilities detected in the font tables. */
  colorFormats?: ColorFormat[];

  // Glyph data
  glyphs: GlyphData[];
}

export type ColorFormat = "COLRv0" | "COLRv1" | "CBDT" | "sbix" | "SVG";

export interface VariationAxisInfo {
  name: string;
  min: number;
  default: number;
  max: number;
}
