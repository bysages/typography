import { describe, expect, it } from "vite-plus/test";

import { createGlyphManager } from "./manager";
import { layoutText, renderTextToSVG } from "./text";
import type { FontData } from "./types";

const font: FontData = {
  familyName: "Test",
  unitsPerEm: 1000,
  ascent: 800,
  descent: -200,
  glyphs: [
    {
      index: 0,
      name: "A",
      unicode: 65,
      advanceWidth: 600,
      path: {
        commands: [
          { type: "move", x: 0, y: 0 },
          { type: "line", x: 600, y: 800 },
        ],
        bounds: { minX: 0, minY: 0, maxX: 600, maxY: 800, width: 600, height: 800 },
      },
    },
    {
      index: 1,
      name: "emoji",
      unicode: "\u{1F600}",
      advanceWidth: 1000,
      path: { commands: [], bounds: undefined },
    },
  ],
};

describe("layoutText", () => {
  it("resolves astral characters through the glyph index", () => {
    const layout = layoutText("A\u{1F600}", font);
    expect(layout.glyphs.map((entry) => entry.glyph.name)).toEqual(["A", "emoji"]);
  });

  it("reports missing characters instead of skipping silently", () => {
    const layout = layoutText("A?A", font);
    expect(layout.missing).toEqual(["?"]);
    expect(layout.glyphs).toHaveLength(2);
    expect(layout.width).toBe(1200);
  });

  it("returns empty layout for empty text", () => {
    const layout = layoutText("", font);
    expect(layout.width).toBe(0);
    expect(layout.missing).toEqual([]);
    expect(layout.bounds).toBeUndefined();
  });
});

describe("renderTextToSVG", () => {
  it("converts stroke-width from px to font units", () => {
    // size 100 / upem 1000 -> scale 0.1; 2px = 20 font units
    const svg = renderTextToSVG("A", font, { size: 100, strokeColor: "red", strokeWidth: 2 });
    expect(svg).toContain('stroke-width="20.00"');
  });

  it("omits stroke without color", () => {
    const svg = renderTextToSVG("A", font, { size: 100, strokeWidth: 2 });
    expect(svg).not.toContain("stroke=");
  });
});

describe("GlyphManager.findByUnicode", () => {
  it("matches astral code points", () => {
    const manager = createGlyphManager([
      {
        index: 0,
        name: "emoji",
        unicode: "\u{1F600}",
        advanceWidth: 1000,
        path: { commands: [], bounds: undefined },
      },
    ]);
    expect(manager.findByUnicode("\u{1F600}")?.name).toBe("emoji");
    expect(manager.findByUnicode(0x1f600)?.name).toBe("emoji");
  });
});
