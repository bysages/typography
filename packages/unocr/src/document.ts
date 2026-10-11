import type { Element, Root } from "hast";

import type { OCRDocument, OutputType } from "./types";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Shared html rendering: one <p> per recognized line. */
export function documentToHtml(document: OCRDocument): string {
  if (document.lines.length === 0 && document.text.length > 0) {
    return `<p>${escapeHtml(document.text)}</p>`;
  }
  return document.lines.map((line) => `<p>${escapeHtml(line.text)}</p>`).join("\n");
}

/**
 * Shared hast rendering: one <p> element per line, with the full structured
 * line (text, confidence, box, words) attached as `data.ocr` for downstream use.
 */
export function documentToHast(document: OCRDocument): Root {
  const children = document.lines.map((line) => ({
    type: "element",
    tagName: "p",
    data: { ocr: { line } },
    children: [{ type: "text", value: line.text }],
  })) as Element[];
  // Keep html and hast equivalent when a driver provides only plain text.
  if (children.length === 0 && document.text.length > 0) {
    children.push({
      type: "element",
      tagName: "p",
      children: [{ type: "text", value: document.text }],
    } as Element);
  }
  const root: Root = {
    type: "root",
    data: {
      ocr: {
        text: document.text,
        ...(document.confidence === undefined ? {} : { confidence: document.confidence }),
      },
    },
    children,
  };
  return root;
}

/** Format an OCRDocument into the requested output type. */
export function formatDocument<T extends OutputType = "html">(
  document: OCRDocument,
  outputType?: T,
): T extends "hast" ? Root : string {
  return (
    outputType === "hast" ? documentToHast(document) : documentToHtml(document)
  ) as T extends "hast" ? Root : string;
}
