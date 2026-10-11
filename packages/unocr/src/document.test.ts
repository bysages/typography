import { describe, expect, it } from "vite-plus/test";

import { documentToHast, documentToHtml, formatDocument } from "./document";
import { hocrToDocument } from "./drivers/cli";
import { pageToDocument } from "./drivers/tesseract";

describe("hocrToDocument", () => {
  const hocr = `<!DOCTYPE html><html><body>
<div class="ocr_page" title="bbox 0 0 1000 500">
  <div class="ocr_line" title="bbox 100 100 900 140; baseline 0 0">
    <span class="ocrx_word" title="bbox 100 100 200 140; x_wconf 95.5">Hello</span>
    <span class="ocrx_word" title="bbox 210 100 300 140; x_wconf 1">w\u00F6rld</span>
  </div>
</div>
</body></html>`;

  it("normalizes boxes against the page frame", () => {
    const line = hocrToDocument(hocr).lines[0];
    expect(line.box?.x).toBeCloseTo(0.1);
    expect(line.box?.width).toBeCloseTo(0.8);
    expect(line.box?.y).toBeCloseTo(0.2);
    expect(line.box?.height).toBeCloseTo(0.08);
  });

  it("treats x_wconf as a percentage", () => {
    const line = hocrToDocument(hocr).lines[0];
    expect(line.words?.[0].confidence).toBeCloseTo(0.955);
    expect(line.words?.[1].confidence).toBeCloseTo(0.01);
    expect(line.confidence).toBeCloseTo((0.955 + 0.01) / 2);
  });

  it("joins word texts so markup whitespace cannot leak in", () => {
    expect(hocrToDocument(hocr).text).toBe("Hello w\u00F6rld");
  });

  it("normalizes each page against its own frame", () => {
    const multi = `<!DOCTYPE html><html><body>
<div class="ocr_page" title="bbox 0 0 1000 500">
  <div class="ocr_line" title="bbox 100 100 900 140">
    <span class="ocrx_word" title="bbox 100 100 900 140; x_wconf 90">one</span>
  </div>
</div>
<div class="ocr_page" title="bbox 0 0 500 250">
  <div class="ocr_line" title="bbox 50 50 450 90">
    <span class="ocrx_word" title="bbox 50 50 450 90; x_wconf 90">two</span>
  </div>
</div>
</body></html>`;
    const lines = hocrToDocument(multi).lines;
    expect(lines[0].box?.x).toBeCloseTo(0.1);
    expect(lines[0].box?.width).toBeCloseTo(0.8);
    expect(lines[1].box?.x).toBeCloseTo(0.1);
    expect(lines[1].box?.width).toBeCloseTo(0.8);
  });

  it("falls back to content bounds without an ocr_page div", () => {
    const doc = hocrToDocument(
      `<div class="ocr_line" title="bbox 100 100 300 140">
        <span class="ocrx_word" title="bbox 100 100 300 140; x_wconf 50">Hi</span>
      </div>`,
    );
    expect(doc.lines[0].box?.x).toBeCloseTo(100 / 300);
    expect(doc.lines[0].box?.width).toBeCloseTo(200 / 300);
  });
});

describe("pageToDocument", () => {
  it("normalizes confidence and preserves text", () => {
    const doc = pageToDocument({
      text: "Hi",
      confidence: 91,
      blocks: [
        {
          paragraphs: [
            {
              lines: [
                {
                  text: "Hi ",
                  confidence: 92,
                  bbox: { x0: 0, y0: 0, x1: 100, y1: 50 },
                  words: [
                    {
                      text: "Hi ",
                      confidence: 92,
                      bbox: { x0: 0, y0: 0, x1: 100, y1: 50 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as never);
    expect(doc.text).toBe("Hi");
    expect(doc.confidence).toBeCloseTo(0.91);
    expect(doc.lines[0].confidence).toBeCloseTo(0.92);
    expect(doc.lines[0].box?.width).toBeCloseTo(1);
  });
});

describe("formatDocument", () => {
  const document = { text: "plain", lines: [] };

  it("html falls back to the raw text without lines", () => {
    expect(formatDocument(document, "html")).toBe("<p>plain</p>");
  });

  it("hast exposes text and confidence on the root data", () => {
    const root = documentToHast({ text: "a\nb", confidence: 0.5, lines: [] });
    expect(root.data?.ocr).toEqual({ text: "a\nb", confidence: 0.5 });
  });

  it("html escapes text content", () => {
    expect(documentToHtml({ text: "<b>", lines: [{ text: "<i>x</i>" }] })).toBe(
      "<p>&lt;i&gt;x&lt;/i&gt;</p>",
    );
  });
});
