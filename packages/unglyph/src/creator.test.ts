import { describe, expect, it } from "vite-plus/test";

import { createFont, generateFont, toPostScriptName } from "./creator";
import { parseFont } from "./parser";
import type { GlyphData } from "./types";

const glyphA: GlyphData = {
  index: 1,
  unicode: 65,
  name: "A",
  advanceWidth: 600,
  path: {
    commands: [
      { type: "move", x: 100, y: 0 },
      { type: "line", x: 300, y: 700 },
      { type: "line", x: 500, y: 0 },
      { type: "close" },
    ],
  },
};

describe("createFont", () => {
  it("preserves name-table metadata", () => {
    const font = createFont([glyphA], {
      familyName: "Test Font",
      styleName: "Regular",
      metadata: { version: "1.0.0", manufacturer: "BY SAGES" },
    });

    expect(font.familyName).toBe("Test Font");
    expect(font.metadata?.manufacturer).toBe("BY SAGES");
  });
});

describe("toPostScriptName", () => {
  it("builds a conventional OTS-safe name", () => {
    expect(toPostScriptName("Untitled Font", "Bold")).toBe("Untitled-Font-Bold");
    expect(toPostScriptName("思源黑体", "Regular")).toBe("u601du6e90u9ed1u4f53-Regular");
  });
});

describe("generateFont", () => {
  it("writes and reparses a TrueType font", async () => {
    const source = createFont([glyphA], {
      familyName: "Test Font",
      styleName: "Regular",
      metadata: { version: "1.0.0" },
    });
    const bytes = await generateFont(source, { format: "ttf" });

    expect(bytes[0]).toBe(0);
    expect(bytes[1]).toBe(1);
    const parsed = await parseFont(bytes);
    expect(parsed.familyName).toBe("Test Font");
    expect(parsed.version).toBe("Version 1.0.0");
    expect(parsed.glyphs.some((glyph) => glyph.unicode === 65)).toBe(true);
    const glyph = parsed.glyphs.find((item) => item.unicode === 65);
    expect(glyph?.path.commands.slice(0, 3)).toEqual([
      { type: "move", x: 100, y: 0 },
      { type: "line", x: 300, y: 700 },
      { type: "line", x: 500, y: 0 },
    ]);
  });

  it("preserves bold weight metadata", async () => {
    const source = createFont([glyphA], {
      familyName: "Bold Test",
      styleName: "Bold",
      weight: 700,
    });
    const parsed = await parseFont(await generateFont(source, { format: "ttf" }));
    expect(parsed.weight).toBe(700);
    expect(parsed.italic).toBe(false);
  });
});
