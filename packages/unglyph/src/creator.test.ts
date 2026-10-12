import { describe, expect, it } from "vite-plus/test";

import { createFont, generateFont, toPostScriptName } from "./creator";
import { parseFont, parseFontMetadata } from "./parser";
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

describe("parseFontMetadata", () => {
  it("round-trips name-table metadata without decoding glyphs", async () => {
    const font = createFont([glyphA], {
      familyName: "Meta Font",
      styleName: "Regular",
      metadata: {
        copyright: "© 2026 BY SAGES",
        designer: "BY SAGES",
        version: "1.2.0",
        description: "Round trip",
        license: "OFL-1.1",
      },
    });
    const bytes = await generateFont(font, { format: "otf" });

    const metadata = await parseFontMetadata(bytes);
    expect(metadata.copyright).toBe("© 2026 BY SAGES");
    expect(metadata.designer).toBe("BY SAGES");
    expect(metadata.version).toBe("1.2.0");
    expect(metadata.description).toBe("Round trip");
    expect(metadata.license).toBe("OFL-1.1");

    const parsed = await parseFont(bytes);
    expect(parsed.metadata?.designer).toBe("BY SAGES");
    expect(parsed.metadata?.version).toBe("1.2.0");
  });
});

describe("round-trip", () => {
  const fullFont = () =>
    createFont([glyphA], {
      familyName: "Round Trip",
      styleName: "Demo",
      postscriptName: "RoundTrip-Demo",
      fullName: "Round Trip Demo Full",
      unitsPerEm: 2000,
      ascender: 1800,
      descender: -400,
      lineGap: 55,
      capHeight: 1400,
      xHeight: 950,
      widthClass: 4,
      weight: 550,
      italic: false,
      metadata: {
        copyright: "© 2026 BY SAGES",
        trademark: "SAGE",
        manufacturer: "BY SAGES",
        designer: "BY SAGES",
        description: "Round-trip probe",
        manufacturerUrl: "https://bysages.com",
        designerUrl: "https://bysages.com",
        license: "OFL-1.1",
        licenseUrl: "https://openfontlicense.org",
        version: "3.2.1",
      },
    });

  const expectScalars = (parsed: import("./types").FontData) => {
    expect(parsed.familyName).toBe("Round Trip");
    expect(parsed.styleName).toBe("Demo");
    expect(parsed.postscriptName).toBe("RoundTrip-Demo");
    expect(parsed.fullName).toBe("Round Trip Demo Full");
    expect(parsed.unitsPerEm).toBe(2000);
    expect(parsed.ascent).toBe(1800);
    expect(parsed.descent).toBe(-400);
    expect(parsed.xHeight).toBe(950);
    expect(parsed.capHeight).toBe(1400);
    expect(parsed.weight).toBe(550);
    expect(parsed.metadata?.version).toBe("3.2.1");
    expect(parsed.metadata?.copyright).toBe("© 2026 BY SAGES");
    expect(parsed.metadata?.trademark).toBe("SAGE");
    expect(parsed.metadata?.manufacturer).toBe("BY SAGES");
    expect(parsed.metadata?.designer).toBe("BY SAGES");
    expect(parsed.metadata?.description).toBe("Round-trip probe");
    expect(parsed.metadata?.manufacturerUrl).toBe("https://bysages.com");
    expect(parsed.metadata?.designerUrl).toBe("https://bysages.com");
    expect(parsed.metadata?.license).toBe("OFL-1.1");
    expect(parsed.metadata?.licenseUrl).toBe("https://openfontlicense.org");
  };

  it("preserves scalars through the CFF (otf) path", async () => {
    const bytes = await generateFont(fullFont(), { format: "otf" });
    const parsed = await parseFont(bytes);
    expectScalars(parsed);
    expect(parsed.metadata?.copyright).toBe("© 2026 BY SAGES");
  });

  it("preserves scalars through the TrueType (ttf) path", async () => {
    const bytes = await generateFont(fullFont(), { format: "ttf" });
    const parsed = await parseFont(bytes);
    expectScalars(parsed);
    expect(parsed.lineGap).toBe(55);
    expect(parsed.widthClass).toBe(4);
  });

  it("derives a fresh postscript name when the family is overridden", async () => {
    const bytes = await generateFont(fullFont(), { format: "otf", familyName: "Renamed" });
    const parsed = await parseFont(bytes);
    expect(parsed.familyName).toBe("Renamed");
    expect(parsed.postscriptName).toBe("Renamed-Demo");
  });

  it("reuses a parsed font directly as createFont input", async () => {
    const source = createFont([glyphA], {
      familyName: "Reuse Font",
      styleName: "Regular",
      unitsPerEm: 2000,
      ascender: 1800,
      descender: -400,
      capHeight: 1400,
      xHeight: 950,
      metadata: { designer: "BY SAGES", license: "OFL-1.1" },
    });
    const bytes = await generateFont(source, { format: "otf" });
    const parsed = await parseFont(bytes);

    // The parsed result carries the original copyright/version top-level
    // fields only when the source set them; here metadata flows back as-is.
    const rebuilt = createFont({ ...parsed });
    expect(rebuilt.familyName).toBe("Reuse Font");
    expect(rebuilt.unitsPerEm).toBe(2000);
    expect(rebuilt.ascent).toBe(1800);
    expect(rebuilt.descent).toBe(-400);
    expect(rebuilt.capHeight).toBe(1400);
    expect(rebuilt.xHeight).toBe(950);
    expect(rebuilt.metadata?.designer).toBe("BY SAGES");

    const out = await generateFont(rebuilt, { format: "ttf" });
    const reparsed = await parseFont(out);
    expect(reparsed.unitsPerEm).toBe(2000);
    expect(reparsed.metadata?.designer).toBe("BY SAGES");
  });
});
