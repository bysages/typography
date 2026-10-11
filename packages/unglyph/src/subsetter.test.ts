import { describe, expect, it } from "vite-plus/test";

import { detectFontFormat } from "./subsetter";

function signature(tag: string): Uint8Array {
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) bytes[i] = tag.charCodeAt(i);
  return bytes;
}

describe("detectFontFormat", () => {
  it("recognizes the web font containers", () => {
    expect(detectFontFormat(signature("ttcf"))).toBe("collection");
    expect(detectFontFormat(signature("wOFF"))).toBe("woff");
    expect(detectFontFormat(signature("wOF2"))).toBe("woff2");
  });

  it("recognizes sfnt flavors", () => {
    const openType = new Uint8Array(4);
    openType[1] = 1; // 0x00010000 big-endian
    expect(detectFontFormat(openType)).toBe("sfnt");
    expect(detectFontFormat(signature("true"))).toBe("sfnt");
    expect(detectFontFormat(signature("OTTO"))).toBe("sfnt");
  });

  it("rejects unknown signatures", () => {
    expect(() => detectFontFormat(signature("nope"))).toThrow("Unrecognized font signature");
  });
});
