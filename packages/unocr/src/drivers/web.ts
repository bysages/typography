/**
 * Browser OCR via the Shape Detection API TextDetector (Chrome/Edge).
 * The API returns detected text blocks without word-level data; boxes are
 * normalized against the rendered image dimensions.
 */

import type { Driver, DriverOptions, OCRDocument, OCRLine, OCRResult, OutputType } from "..";
import { formatDocument } from "../document";

interface DetectedText {
  rawValue: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface TextDetectorLike {
  detect: (image: ImageBitmapSource) => Promise<DetectedText[]>;
}

async function createTextDetector(): Promise<TextDetectorLike> {
  const detector = (globalThis as { TextDetector?: new () => TextDetectorLike }).TextDetector;
  if (!detector) {
    throw new Error(
      "TextDetector is unavailable: the Shape Detection API requires Chromium-based browsers.",
    );
  }
  return new detector();
}

async function toImageBitmapSource(
  input: Parameters<typeof createImageBitmap>[0],
): Promise<ImageBitmap> {
  return createImageBitmap(input);
}

export type WebDriverOptions<T extends OutputType = OutputType> = DriverOptions<T>;

export default function webDriver<T extends OutputType = OutputType>(
  options: WebDriverOptions<T> = {} as WebDriverOptions<T>,
): Driver<T, WebDriverOptions<T>> {
  const { outputType } = options;
  let detector: TextDetectorLike | null = null;

  return {
    name: "web",
    options,

    recognize: async (input): Promise<OCRResult<T>> => {
      detector = detector ?? (await createTextDetector());
      const bitmap = await toImageBitmapSource(input as Parameters<typeof createImageBitmap>[0]);
      try {
        const detections = await detector.detect(bitmap);
        const lines: OCRLine[] = detections
          .map((detection) => ({
            text: detection.rawValue,
            box: {
              x: detection.boundingBox.x / bitmap.width,
              y: detection.boundingBox.y / bitmap.height,
              width: detection.boundingBox.width / bitmap.width,
              height: detection.boundingBox.height / bitmap.height,
            },
          }))
          .filter((line) => line.text.length > 0);
        const document: OCRDocument = { text: lines.map((line) => line.text).join("\n"), lines };
        return formatDocument(document, outputType) as OCRResult<T>;
      } finally {
        bitmap.close();
      }
    },

    dispose: async () => {},
  };
}
