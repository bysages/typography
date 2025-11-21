import type {
  GlyphData,
  RenderOptions,
  SVGRenderOptions,
  CanvasRenderOptions,
  ImageRenderOptions,
} from "./types";

/**
 * Type guard to check if options are for Canvas rendering
 */
function isCanvasOptions(
  options: RenderOptions,
): options is CanvasRenderOptions {
  return "ctx" in options;
}

/**
 * Type guard to check if options are for Image rendering
 */
function isImageOptions(options: RenderOptions): options is ImageRenderOptions {
  return "format" in options;
}

/**
 * Calculate glyph bounds
 */
function calculateBounds(glyph: GlyphData) {
  if (glyph.path.bounds) {
    return glyph.path.bounds;
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const cmd of glyph.path.commands) {
    switch (cmd.type) {
      case "move":
      case "line":
        minX = Math.min(minX, cmd.x);
        minY = Math.min(minY, cmd.y);
        maxX = Math.max(maxX, cmd.x);
        maxY = Math.max(maxY, cmd.y);
        break;
      case "quadratic":
        minX = Math.min(minX, cmd.x, cmd.cx);
        minY = Math.min(minY, cmd.y, cmd.cy);
        maxX = Math.max(maxX, cmd.x, cmd.cx);
        maxY = Math.max(maxY, cmd.y, cmd.cy);
        break;
      case "cubic":
        minX = Math.min(minX, cmd.x, cmd.cx1, cmd.cx2);
        minY = Math.min(minY, cmd.y, cmd.cy1, cmd.cy2);
        maxX = Math.max(maxX, cmd.x, cmd.cx1, cmd.cx2);
        maxY = Math.max(maxY, cmd.y, cmd.cy1, cmd.cy2);
        break;
      case "close":
        // Close path doesn't change current position
        break;
    }
  }

  return {
    minX: minX === Infinity ? 0 : minX,
    minY: minY === Infinity ? 0 : minY,
    maxX: maxX === -Infinity ? 0 : maxX,
    maxY: maxY === -Infinity ? 0 : maxY,
  };
}

/**
 * Convert path commands to SVG path string
 */
function pathToSVG(
  glyph: GlyphData,
  bounds: any,
  scale: number,
  padding: number,
): string {
  return glyph.path.commands
    .map((cmd) => {
      switch (cmd.type) {
        case "move":
          return `M ${(cmd.x - bounds.minX) * scale + padding} ${(cmd.y - bounds.minY) * scale + padding}`;
        case "line":
          return `L ${(cmd.x - bounds.minX) * scale + padding} ${(cmd.y - bounds.minY) * scale + padding}`;
        case "quadratic":
          return `Q ${(cmd.cx - bounds.minX) * scale + padding} ${(cmd.cy - bounds.minY) * scale + padding} ${(cmd.x - bounds.minX) * scale + padding} ${(cmd.y - bounds.minY) * scale + padding}`;
        case "cubic":
          return `C ${(cmd.cx1 - bounds.minX) * scale + padding} ${(cmd.cy1 - bounds.minY) * scale + padding} ${(cmd.cx2 - bounds.minX) * scale + padding} ${(cmd.cy2 - bounds.minY) * scale + padding} ${(cmd.x - bounds.minX) * scale + padding} ${(cmd.y - bounds.minY) * scale + padding}`;
        case "close":
          return "Z";
        default:
          return "";
      }
    })
    .join(" ");
}

/**
 * Render glyph path to Canvas context
 */
function renderPathToCanvas(
  glyph: GlyphData,
  bounds: any,
  scale: number,
  padding: number,
  ctx: any,
  color?: string,
) {
  ctx.save();

  // Apply transformations
  ctx.translate(padding - bounds.minX * scale, padding - bounds.minY * scale);
  ctx.scale(scale, scale);

  // Set fill color
  if (color) {
    ctx.fillStyle = color;
  }

  // Begin path
  ctx.beginPath();

  // Render path commands
  for (const cmd of glyph.path.commands) {
    switch (cmd.type) {
      case "move":
        ctx.moveTo(cmd.x, cmd.y);
        break;
      case "line":
        ctx.lineTo(cmd.x, cmd.y);
        break;
      case "quadratic":
        ctx.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y);
        break;
      case "cubic":
        ctx.bezierCurveTo(cmd.cx1, cmd.cy1, cmd.cx2, cmd.cy2, cmd.x, cmd.y);
        break;
      case "close":
        ctx.closePath();
        break;
    }
  }

  // Fill the path
  ctx.fill();

  ctx.restore();
}

/**
 * Render glyph to SVG string
 */
export function renderGlyphToSVG(
  glyph: GlyphData,
  options: SVGRenderOptions,
): string {
  const scale = options.size / 1000; // Assuming 1000 units per em
  const padding = options.padding || 0;
  const color = options.color || "black";
  const bgColor = options.backgroundColor || "transparent";

  // Calculate bounds
  const bounds = calculateBounds(glyph);
  const width = Math.ceil((bounds.maxX - bounds.minX) * scale) + padding * 2;
  const height = Math.ceil((bounds.maxY - bounds.minY) * scale) + padding * 2;

  // Generate SVG path
  const pathData = pathToSVG(glyph, bounds, scale, padding);

  const stroke =
    options.strokeColor && options.strokeWidth
      ? ` stroke="${options.strokeColor}" stroke-width="${options.strokeWidth}"`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${bgColor !== "transparent" ? `<rect width="${width}" height="${height}" fill="${bgColor}"/>` : ""}
  <path d="${pathData}" fill="${color}"${stroke}/>
</svg>`;
}

/**
 * Render glyph to Canvas context
 */
export function renderGlyphToCanvas(
  glyph: GlyphData,
  options: CanvasRenderOptions,
): void {
  const scale = options.size / 1000;

  // Save context state
  options.ctx.save();

  // Apply transformations
  options.ctx.translate(options.x, options.y);
  options.ctx.scale(scale, scale);

  // Set fill color
  if (options.color) {
    options.ctx.fillStyle = options.color;
  }

  // Begin path
  options.ctx.beginPath();

  // Render path commands directly (no bounds transformation for positional rendering)
  for (const cmd of glyph.path.commands) {
    switch (cmd.type) {
      case "move":
        options.ctx.moveTo(cmd.x, cmd.y);
        break;
      case "line":
        options.ctx.lineTo(cmd.x, cmd.y);
        break;
      case "quadratic":
        options.ctx.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y);
        break;
      case "cubic":
        options.ctx.bezierCurveTo(
          cmd.cx1,
          cmd.cy1,
          cmd.cx2,
          cmd.cy2,
          cmd.x,
          cmd.y,
        );
        break;
      case "close":
        options.ctx.closePath();
        break;
    }
  }

  // Fill the path
  options.ctx.fill();

  // Restore context state
  options.ctx.restore();
}

/**
 * Render glyph to Image buffer
 */
export async function renderGlyphToImage(
  glyph: GlyphData,
  options: ImageRenderOptions,
): Promise<Buffer> {
  // Dynamic import canvas library
  const { createCanvas } = await import("@napi-rs/canvas");

  const scale = options.size / 1000;
  const padding = options.padding || 20;
  const color = options.color || "black";
  const bgColor = options.backgroundColor || "transparent";
  const format = options.format;
  const quality = options.quality ?? 1.0; // Default to highest quality

  // Calculate bounds
  const bounds = calculateBounds(glyph);
  const width = Math.ceil((bounds.maxX - bounds.minX) * scale) + padding * 2;
  const height = Math.ceil((bounds.maxY - bounds.minY) * scale) + padding * 2;

  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Set background
  if (bgColor !== "transparent") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Render glyph
  renderPathToCanvas(glyph, bounds, scale, padding, ctx, color);

  // Convert to buffer based on format
  if (format === "png") {
    return canvas.toBuffer("image/png");
  } else if (format === "jpeg") {
    return canvas.toBuffer("image/jpeg", quality);
  } else if (format === "webp") {
    return canvas.toBuffer("image/webp", quality);
  } else {
    // Should never happen due to type constraint
    throw new Error("Unsupported image format");
  }
}

/**
 * Unified render function with type-safe overloads
 */
export function renderGlyph(
  glyph: GlyphData,
  options: SVGRenderOptions,
): string;
export function renderGlyph(
  glyph: GlyphData,
  options: CanvasRenderOptions,
): void;
export function renderGlyph(
  glyph: GlyphData,
  options: ImageRenderOptions,
): Promise<Buffer>;
export function renderGlyph(
  glyph: GlyphData,
  options: RenderOptions,
): string | void | Promise<Buffer> {
  if (isCanvasOptions(options)) {
    return renderGlyphToCanvas(glyph, options);
  } else if (isImageOptions(options)) {
    return renderGlyphToImage(glyph, options as ImageRenderOptions);
  } else {
    return renderGlyphToSVG(glyph, options as SVGRenderOptions);
  }
}
