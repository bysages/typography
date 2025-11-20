import type { GlyphData, RenderOptions } from "./types";

/**
 * Render glyph to SVG
 */
export function renderGlyph(glyph: GlyphData, options: RenderOptions): string {
  const scale = options.size / 1000; // Assuming 1000 units per em
  const padding = options.padding || 0;
  const color = options.color || "black";
  const bgColor = options.backgroundColor || "transparent";

  // Calculate bounds
  const bounds = calculateBounds(glyph);
  const width = Math.ceil((bounds.maxX - bounds.minX) * scale) + padding * 2;
  const height = Math.ceil((bounds.maxY - bounds.minY) * scale) + padding * 2;

  // Generate SVG path
  const pathData = glyph.path.commands
    .map((cmd) => {
      switch (cmd.type) {
        case "M":
          return `M ${(cmd.x - bounds.minX) * scale + padding} ${(cmd.y - bounds.minY) * scale + padding}`;
        case "L":
          return `L ${(cmd.x - bounds.minX) * scale + padding} ${(cmd.y - bounds.minY) * scale + padding}`;
        case "Q":
          return `Q ${(cmd.cx - bounds.minX) * scale + padding} ${(cmd.cy - bounds.minY) * scale + padding} ${(cmd.x - bounds.minX) * scale + padding} ${(cmd.y - bounds.minY) * scale + padding}`;
        case "C":
          return `C ${(cmd.cx1 - bounds.minX) * scale + padding} ${(cmd.cy1 - bounds.minY) * scale + padding} ${(cmd.cx2 - bounds.minX) * scale + padding} ${(cmd.cy2 - bounds.minY) * scale + padding} ${(cmd.x - bounds.minX) * scale + padding} ${(cmd.y - bounds.minY) * scale + padding}`;
        case "Z":
          return "Z";
        default:
          return "";
      }
    })
    .join(" ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${bgColor !== "transparent" ? `<rect width="${width}" height="${height}" fill="${bgColor}"/>` : ""}
  <path d="${pathData}" fill="${color}" stroke="${color}" stroke-width="1"/>
</svg>`;
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
      case "M":
      case "L":
        minX = Math.min(minX, cmd.x);
        minY = Math.min(minY, cmd.y);
        maxX = Math.max(maxX, cmd.x);
        maxY = Math.max(maxY, cmd.y);
        break;
      case "Q":
        minX = Math.min(minX, cmd.x, cmd.cx);
        minY = Math.min(minY, cmd.y, cmd.cy);
        maxX = Math.max(maxX, cmd.x, cmd.cx);
        maxY = Math.max(maxY, cmd.y, cmd.cy);
        break;
      case "C":
        minX = Math.min(minX, cmd.x, cmd.cx1, cmd.cx2);
        minY = Math.min(minY, cmd.y, cmd.cy1, cmd.cy2);
        maxX = Math.max(maxX, cmd.x, cmd.cx1, cmd.cx2);
        maxY = Math.max(maxY, cmd.y, cmd.cy1, cmd.cy2);
        break;
      case "Z":
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
