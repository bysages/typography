import { describe, expect, it } from "vite-plus/test";

import {
  areConfusable,
  areIntentionalPair,
  detectConfusables,
  detectIntentional,
  getConfusablePrototype,
  getConfusableSources,
  getConfusables,
  getIntentionalTargets,
  getMetadata,
  randomizeConfusables,
  skeleton,
} from "./index";
import { getRestrictionLevel, getScript, isIdentifierWellFormed, isMixedScript } from "./script";

describe("skeleton", () => {
  it("maps sequence prototypes as one replacement", () => {
    // U+030B (combining double acute) maps to U+0301 U+0301
    expect(skeleton("\u030B")).toBe(skeleton("\u0301\u0301"));
    expect(getConfusablePrototype("\u030B")).toBe("\u0301\u0301");
  });

  it("removes default-ignorable code points", () => {
    expect(skeleton("a\u200Bb")).toBe("ab");
  });

  it("keeps reverse lookup consistent with sequence targets", () => {
    const sources = getConfusableSources("O");
    expect(sources.length).toBeGreaterThan(1);
    expect(sources).toContain("0");
  });
});

describe("lookup", () => {
  it("returns joined string targets", () => {
    expect(getConfusables("0")).toMatchObject({ target: "O", type: "MA" });
  });

  it("reports dataset metadata", () => {
    const meta = getMetadata();
    expect(meta.totalMappings).toBeGreaterThan(6000);
    expect(meta.version).toBe("18.0.0");
  });

  it("detects skeleton equality", () => {
    expect(areConfusable("paypal", "paypa1")).toBe(true);
    expect(areConfusable("paypal", "python")).toBe(false);
  });

  it("randomizes into prototype sequences", () => {
    expect(randomizeConfusables("0", { probability: 1 })).toBe("O");
    expect(randomizeConfusables("0", { probability: 0 })).toBe("0");
  });
});

describe("intentional pairs", () => {
  it("returns every curated target", () => {
    expect(getIntentionalTargets("C")).toEqual(["\u0421", "\u216D"]);
  });

  it("detects positions and pair membership", () => {
    expect(areIntentionalPair("A", "\u0391")).toBe(true);
    expect(areIntentionalPair("A", "B")).toBe(false);
    expect(detectIntentional("\u0421A")).toEqual([{ index: 1, char: "A", targets: ["\u0391"] }]);
  });
});

describe("isIdentifierWellFormed", () => {
  it("accepts identifiers that start with XID_Start", () => {
    expect(isIdentifierWellFormed("hello")).toBe(true);
    expect(isIdentifierWellFormed("caf\u00E9_1")).toBe(true);
  });

  it("rejects underscores and digits in leading position", () => {
    expect(isIdentifierWellFormed("_private1")).toBe(false);
    expect(isIdentifierWellFormed("1abc")).toBe(false);
  });

  it("rejects non-XID_Start starts and stray continuations", () => {
    expect(isIdentifierWellFormed("1abc")).toBe(false);
    expect(isIdentifierWellFormed("")).toBe(true);
  });

  it("skips default-ignorable code points", () => {
    expect(isIdentifierWellFormed("a\u200Bb")).toBe(true);
    expect(isIdentifierWellFormed("\u200B")).toBe(true);
  });
});

describe("getRestrictionLevel profile check", () => {
  it("still classifies valid identifiers", () => {
    expect(getRestrictionLevel("hello")).toBe("ascii-only");
    expect(getRestrictionLevel("abc\u304A\u308A\u304C\u307F")).toBe("highly-restrictive");
  });

  it("yields unrestricted when well-formedness fails", () => {
    expect(getRestrictionLevel("1abc")).toBe("unrestricted");
  });
});

describe("default-ignorable handling", () => {
  it("does not report mappings for ignorable code points", () => {
    expect(detectConfusables("\u3164")).toEqual([]);
  });

  it("strips skeleton-relevant ignorable code points before confusable mapping", () => {
    // U+3164 HANGUL FILLER is both a confusable source and default-ignorable;
    // UTS #39 requires stripping before mapping, so it must vanish entirely.
    expect(skeleton("\u3164")).toBe("");
    expect(skeleton("a\u3164b")).toBe("ab");
  });
});

describe("script alias normalization", () => {
  it("maps inherited marks to Zinh so Common/Inherited resolve to all scripts", () => {
    expect(getScript("\u0300")).toBe("Zinh");
  });

  it("maps Coptic to Copt so Script_Extensions intersect", () => {
    expect(getScript("\u2C80")).toBe("Copt");
  });

  it("treats inherited marks as single-script with Coptic text", () => {
    // U+0300 combining grave above + U+2C80 coptic capital alpha
    expect(isMixedScript("\u0300\u2C80")).toBe(false);
  });
});

describe("intentional pair symmetry", () => {
  it("matches in both directions", () => {
    const [source, target] =
      getIntentionalTargets("A").length > 0
        ? ["A", getIntentionalTargets("A")[0]]
        : ["l", getIntentionalTargets("l")[0]];
    expect(areIntentionalPair(source, target)).toBe(true);
    expect(areIntentionalPair(target, source)).toBe(true);
  });
});

describe("single code point validation", () => {
  it("rejects multi-code-point input", () => {
    expect(() => getConfusablePrototype("ab")).toThrow(RangeError);
    expect(() => getConfusables("ab")).toThrow(RangeError);
    expect(() => getScript("ab")).toThrow(RangeError);
  });
});
