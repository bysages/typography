import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toUint8Array } from "undio";

import type {
  Driver,
  DriverOptions,
  OCRBox,
  OCRDocument,
  OCRInput,
  OCRLine,
  OCRResult,
  OutputType,
} from "..";
import { formatDocument } from "../document";

export type CliDriverOptions<T extends OutputType = OutputType> = DriverOptions<T> & {
  /** Path to the tesseract executable. Defaults to "tesseract" on PATH. */
  command?: string;
  /** Language passed to tesseract -l. */
  langs?: string;
  /** Extra CLI arguments, e.g. ["--psm", "6"]. */
  args?: string[];
};

export async function isTesseractCliAvailable(command = "tesseract"): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], { stdio: "ignore", windowsHide: true });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

function hasClassName(node: Element, marker: string): boolean {
  const classNames = node.properties?.className;
  return Array.isArray(classNames) && classNames.some((name) => String(name) === marker);
}

function isElement(node: Root["children"][number]): node is Element {
  return node.type === "element";
}

function textContent(node: Root | Element): string {
  let out = "";
  for (const child of node.children) {
    if (child.type === "text") out += child.value;
    else if (child.type === "element") out += textContent(child);
  }
  return out;
}

function parseBbox(title: string | undefined): PixelBox | null {
  const match = title?.match(/bbox (\d+) (\d+) (\d+) (\d+)/);
  if (!match) return null;
  return {
    x0: Number(match[1]),
    y0: Number(match[2]),
    x1: Number(match[3]),
    y1: Number(match[4]),
  };
}

interface PixelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PixelEntry {
  text: string;
  confidence: number | undefined;
  box: PixelBox;
  frame: PixelBox | null;
  words: { text: string; confidence: number; box: PixelBox }[];
}

/** Parse tesseract hOCR markup into an OCRDocument with normalized boxes. */
export function hocrToDocument(hocr: string): OCRDocument {
  const root = fromHtml(hocr);
  const entries: PixelEntry[] = [];
  let maxX = 1;
  let maxY = 1;

  const collect = (node: Root | Element, page: PixelBox | null = null) => {
    for (const child of node.children) {
      if (!isElement(child)) continue;
      if (hasClassName(child, "ocr_page")) {
        const parsed = parseBbox(child.properties?.title as string | undefined);
        collect(child, parsed && parsed.x1 > parsed.x0 && parsed.y1 > parsed.y0 ? parsed : null);
      } else if (hasClassName(child, "ocr_line") || hasClassName(child, "ocr_header")) {
        const box = parseBbox(child.properties?.title as string | undefined);
        const words: PixelEntry["words"] = [];
        for (const wordNode of child.children) {
          if (!isElement(wordNode) || !hasClassName(wordNode, "ocrx_word")) continue;
          const wordText = textContent(wordNode).trim();
          if (wordText.length === 0) continue;
          const wordBox = parseBbox(wordNode.properties?.title as string | undefined);
          if (!wordBox) continue;
          maxX = Math.max(maxX, wordBox.x1);
          maxY = Math.max(maxY, wordBox.y1);
          const title = wordNode.properties?.title;
          const wordConfidence = Number(
            (typeof title === "string" ? /\bx_wconf (-?[\d.]+)/.exec(title)?.[1] : undefined) ??
              "0",
          );
          words.push({
            text: wordText,
            confidence: Math.min(1, Math.max(0, wordConfidence / 100)),
            box: wordBox,
          });
        }
        // Join word texts so pretty-printed hOCR does not leak inner whitespace.
        const lineText =
          words.length > 0 ? words.map((word) => word.text).join(" ") : textContent(child).trim();
        if (box && lineText.length > 0) {
          maxX = Math.max(maxX, box.x1);
          maxY = Math.max(maxY, box.y1);
          const confidence =
            words.length > 0
              ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length
              : undefined;
          entries.push({ text: lineText, confidence, box, frame: page, words });
        }
      } else {
        collect(child, page);
      }
    }
  };

  collect(root);

  // Normalize against each page frame when hOCR provides one so multi-page
  // documents do not share the last page's frame; otherwise divide by the
  // detected content bounds, matching the tesseract.js driver.
  const contentFrame: PixelBox = { x0: 0, y0: 0, x1: maxX, y1: maxY };

  const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
  const normalize = (box: PixelBox, frame: PixelBox): OCRBox => {
    const frameWidth = Math.max(1, frame.x1 - frame.x0);
    const frameHeight = Math.max(1, frame.y1 - frame.y0);
    return {
      x: clamp01((box.x0 - frame.x0) / frameWidth),
      y: clamp01((box.y0 - frame.y0) / frameHeight),
      width: clamp01((box.x1 - box.x0) / frameWidth),
      height: clamp01((box.y1 - box.y0) / frameHeight),
    };
  };

  const lines: OCRLine[] = entries.map((entry) => {
    const frame = entry.frame ?? contentFrame;
    return {
      text: entry.text,
      confidence: entry.confidence,
      box: normalize(entry.box, frame),
      words: entry.words.map((word) => ({
        text: word.text,
        confidence: word.confidence,
        box: normalize(word.box, frame),
      })),
    };
  });

  return { text: lines.map((line) => line.text).join("\n"), lines };
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout.push(chunk as Buffer);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString("utf8"));
      else reject(new Error(`tesseract exited with ${code}: ${stderr.trim()}`));
    });
  });
}

function detectImageExtension(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "input.png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "input.jpg";
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder("latin1").decode(bytes.subarray(0, 4)) === "RIFF" &&
    new TextDecoder("latin1").decode(bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "input.webp";
  }
  if (bytes.length >= 6 && new TextDecoder("latin1").decode(bytes.subarray(0, 3)) === "GIF") {
    return "input.gif";
  }
  return "input.bin";
}

export default function cliDriver<T extends OutputType = OutputType>(
  options: CliDriverOptions<T> = {} as CliDriverOptions<T>,
): Driver<T, CliDriverOptions<T>> {
  const { command = "tesseract", langs, args = [], outputType } = options;

  return {
    name: "cli",
    options,

    recognize: async (input: OCRInput): Promise<OCRResult<T>> => {
      const bytes = await toUint8Array(input);
      const dir = await mkdtemp(join(tmpdir(), "unocr-"));
      try {
        const imagePath = join(dir, detectImageExtension(bytes));
        await writeFile(imagePath, bytes);
        const cliArgs = [imagePath, "stdout", ...(langs ? ["-l", langs] : []), ...args, "hocr"];
        const hocr = await run(command, cliArgs);
        return formatDocument(hocrToDocument(hocr), outputType) as OCRResult<T>;
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },

    dispose: async () => {},
  };
}
