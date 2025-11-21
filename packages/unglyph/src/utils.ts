import type { GlyphData, PathData, PathCommand } from "./types";
import fontkit from "fontkit";
import * as opentype from "opentype.js";

/**
 * Convert our unified PathData to opentype.js Path
 */
export function convertToOpentypePath(pathData: PathData): opentype.Path {
  const path = new opentype.Path();

  for (const cmd of pathData.commands) {
    switch (cmd.type) {
      case "move":
        path.moveTo(cmd.x, cmd.y);
        break;
      case "line":
        path.lineTo(cmd.x, cmd.y);
        break;
      case "quadratic":
        path.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y);
        break;
      case "cubic":
        path.bezierCurveTo(cmd.cx1, cmd.cy1, cmd.cx2, cmd.cy2, cmd.x, cmd.y);
        break;
      case "close":
        path.close();
        break;
    }
  }

  return path;
}

/**
 * Convert fontkit.Glyph to our unified GlyphData
 */
export function convertFromFontkitGlyph(
  fontkitGlyph: fontkit.Glyph,
  id: number,
  ascent?: number,
  unicode?: number,
): GlyphData {
  const codePoint = unicode || fontkitGlyph.codePoints[0] || id;

  // Generate glyph name from unicode if not available
  let glyphName = fontkitGlyph.name;
  if (!glyphName && codePoint) {
    // Standard unicode naming for common characters
    if (codePoint >= 65 && codePoint <= 90) {
      // A-Z
      glyphName = String.fromCharCode(codePoint);
    } else if (codePoint >= 97 && codePoint <= 122) {
      // a-z
      glyphName = String.fromCharCode(codePoint);
    } else if (codePoint === 32) {
      glyphName = "space";
    } else {
      glyphName = `uni${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
    }
  }

  return {
    index: fontkitGlyph.id,
    unicode: codePoint,
    name: glyphName,
    advanceWidth: fontkitGlyph.advanceWidth,
    path: convertFromFontkitPath(fontkitGlyph.path, ascent),
    codePoints: fontkitGlyph.codePoints,
    isMark: fontkitGlyph.isMark,
    isLigature: fontkitGlyph.isLigature,
  };
}

/**
 * Convert fontkit.Path to our unified PathData
 */
function convertFromFontkitPath(
  fontkitPath: fontkit.Path,
  ascent?: number,
): PathData {
  const commands: PathCommand[] = [];
  const baseline = ascent || 1900; // Use ascent as baseline for coordinate conversion

  for (const cmd of fontkitPath.commands) {
    switch (cmd.command) {
      case "moveTo":
        commands.push({
          type: "move",
          x: cmd.args[0],
          y: baseline - cmd.args[1],
        });
        break;
      case "lineTo":
        commands.push({
          type: "line",
          x: cmd.args[0],
          y: baseline - cmd.args[1],
        });
        break;
      case "quadraticCurveTo":
        commands.push({
          type: "quadratic",
          cx: cmd.args[0],
          cy: baseline - cmd.args[1],
          x: cmd.args[2],
          y: baseline - cmd.args[3],
        });
        break;
      case "bezierCurveTo":
        commands.push({
          type: "cubic",
          cx1: cmd.args[0],
          cy1: baseline - cmd.args[1],
          cx2: cmd.args[2],
          cy2: baseline - cmd.args[3],
          x: cmd.args[4],
          y: baseline - cmd.args[5],
        });
        break;
      case "closePath":
        commands.push({ type: "close" });
        break;
    }
  }

  // Convert bounds to match coordinate system
  const bbox = fontkitPath.bbox || {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    width: 0,
    height: 0,
  };

  const bounds = {
    minX: bbox.minX,
    minY: baseline - bbox.maxY,
    maxX: bbox.maxX,
    maxY: baseline - bbox.minY,
    width: bbox.width,
    height: bbox.height,
  };

  return {
    commands,
    bounds,
  };
}

/**
 * Convert our unified GlyphData to mock fontkit.Glyph for SVG generation
 */
export function convertToFontkitGlyph(glyph: GlyphData): fontkit.Glyph {
  const codePoint =
    typeof glyph.unicode === "string"
      ? glyph.unicode.charCodeAt(0)
      : glyph.unicode;

  const path: fontkit.Path = {
    commands: convertPathCommandsToFontkit(glyph.path.commands),
    bbox: glyph.path.bounds || {
      minX: 0,
      minY: 0,
      maxX: glyph.advanceWidth,
      maxY: 1000,
      width: glyph.advanceWidth,
      height: 1000,
    },
    cbox: glyph.path.bounds || {
      minX: 0,
      minY: 0,
      maxX: glyph.advanceWidth,
      maxY: 1000,
      width: glyph.advanceWidth,
      height: 1000,
    },
    toSVG() {
      return this.commands
        .map((cmd: fontkit.PathCommand) => {
          switch (cmd.command) {
            case "moveTo":
              return `M ${cmd.args[0]} ${cmd.args[1]}`;
            case "lineTo":
              return `L ${cmd.args[0]} ${cmd.args[1]}`;
            case "quadraticCurveTo":
              return `Q ${cmd.args[0]} ${cmd.args[1]} ${cmd.args[2]} ${cmd.args[3]}`;
            case "bezierCurveTo":
              return `C ${cmd.args[0]} ${cmd.args[1]} ${cmd.args[2]} ${cmd.args[3]} ${cmd.args[4]} ${cmd.args[5]}`;
            case "closePath":
              return "Z";
            default:
              return "";
          }
        })
        .filter(Boolean)
        .join(" ");
    },
    toFunction() {
      return function () {
        // Mock function - not implemented for simplicity
        console.warn("toFunction not implemented for mock fontkit paths");
      };
    },
    transform: function () {
      return this;
    },
    translate: function () {
      return this;
    },
    rotate: function () {
      return this;
    },
    scale: function () {
      return this;
    },
  };

  return {
    id: glyph.index,
    name: glyph.name || `glyph${glyph.index}`,
    codePoints: glyph.codePoints || [codePoint],
    path: path,
    bbox: path.bbox,
    cbox: path.cbox,
    advanceWidth: glyph.advanceWidth,
    isMark: glyph.isMark || false,
    isLigature: glyph.isLigature || false,
    render: function () {
      throw new Error("render function not implemented for converted glyphs");
    },
  };
}

/**
 * Convert our PathCommand array to fontkit PathCommand array
 */
function convertPathCommandsToFontkit(
  commands: PathCommand[],
): fontkit.PathCommand[] {
  return commands.map((cmd) => {
    switch (cmd.type) {
      case "move":
        return { command: "moveTo", args: [cmd.x, cmd.y] };
      case "line":
        return { command: "lineTo", args: [cmd.x, cmd.y] };
      case "quadratic":
        return {
          command: "quadraticCurveTo",
          args: [cmd.cx, cmd.cy, cmd.x, cmd.y],
        };
      case "cubic":
        return {
          command: "bezierCurveTo",
          args: [cmd.cx1, cmd.cy1, cmd.cx2, cmd.cy2, cmd.x, cmd.y],
        };
      case "close":
        return { command: "closePath", args: [] };
      default:
        throw new Error(`Unknown path command type: ${(cmd as any).type}`);
    }
  });
}
