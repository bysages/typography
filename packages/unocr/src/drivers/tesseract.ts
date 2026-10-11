import Tesseract, { createScheduler } from "tesseract.js";
import type { Page, Worker } from "tesseract.js";
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
  RecognizesOptions,
} from "..";
import { formatDocument } from "../document";
import { readImageSize } from "../image-size";

export type TesseractDriverOptions<TOutputType extends OutputType> =
  Partial<Tesseract.WorkerOptions> &
    DriverOptions<TOutputType> & {
      /** Recognition languages, e.g. "eng+chi_sim". Forwarded to createWorker. */
      langs?: string | string[];
      /** OCR engine mode. Defaults to LSTM_ONLY. */
      oem?: Tesseract.OEM;
    };

interface PixelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PixelEntry {
  text: string;
  confidence: number;
  box: PixelBox;
  words: { text: string; confidence: number; box: PixelBox }[];
}

/** Clamp a normalized coordinate into the declared 0..1 range. */
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Convert a tesseract.js recognition page into an OCRDocument with normalized boxes.
 * Boxes are normalized against the source image size when the input bytes can be
 * sniffed, falling back to the bounding box of the recognized content otherwise. */
export function pageToDocument(page: Page, source?: Uint8Array): OCRDocument {
  const entries: PixelEntry[] = [];
  let maxX = 1;
  let maxY = 1;

  const grow = (box: PixelBox) => {
    maxX = Math.max(maxX, box.x1);
    maxY = Math.max(maxY, box.y1);
  };

  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const words: PixelEntry["words"] = [];
        for (const word of line.words) {
          const text = word.text.trim();
          if (text.length === 0) continue;
          grow(word.bbox);
          words.push({ text, confidence: word.confidence / 100, box: { ...word.bbox } });
        }
        const text = line.text.trim();
        if (text.length === 0) continue;
        grow(line.bbox);
        entries.push({ text, confidence: line.confidence / 100, box: { ...line.bbox }, words });
      }
    }
  }

  const size = source ? readImageSize(source) : null;
  const width = size?.width ?? maxX;
  const height = size?.height ?? maxY;

  const normalize = (box: PixelBox): OCRBox => ({
    x: clamp01(box.x0 / width),
    y: clamp01(box.y0 / height),
    width: clamp01((box.x1 - box.x0) / width),
    height: clamp01((box.y1 - box.y0) / height),
  });

  const lines: OCRLine[] = entries.map((entry) => ({
    text: entry.text,
    confidence: entry.confidence,
    box: normalize(entry.box),
    words: entry.words.map((word) => ({
      text: word.text,
      confidence: word.confidence,
      box: normalize(word.box),
    })),
  }));

  return { text: page.text, confidence: page.confidence / 100, lines };
}
export default function tesseractDriver<TOutputType extends OutputType>(
  options: TesseractDriverOptions<TOutputType>,
): Driver<TOutputType, TesseractDriverOptions<TOutputType>> {
  const { outputType, ...tesseractOptions } = options;
  let workerPromise: Promise<Worker> | null = null;

  // Cache the creation promise so concurrent recognizes share one worker.
  const initializeWorker = (): Promise<Worker> => {
    workerPromise ??= Tesseract.createWorker(
      tesseractOptions.langs || "eng",
      tesseractOptions.oem || 1,
      tesseractOptions,
    );
    // Drop a failed creation so the next call can retry.
    return workerPromise.catch((error) => {
      workerPromise = null;
      throw error;
    });
  };

  const recognizeOnce = async (input: OCRInput): Promise<OCRDocument> => {
    const activeWorker = await initializeWorker();
    const imageLike = await toUint8Array(input);
    const result = await activeWorker.recognize(imageLike, {}, { blocks: true, text: true });
    return pageToDocument(result.data, imageLike);
  };

  return {
    name: "tesseract",
    options,

    recognize: async (input: OCRInput): Promise<OCRResult<TOutputType>> => {
      const document = await recognizeOnce(input);
      return formatDocument(document, outputType) as OCRResult<TOutputType>;
    },

    recognizes: async (
      inputs: OCRInput[],
      recognizesOptions: RecognizesOptions = {},
    ): Promise<OCRResult<TOutputType>[]> => {
      const scheduler = createScheduler();
      try {
        const parallel = recognizesOptions.parallel || 4;
        const workerCount = Math.min(inputs.length, parallel);
        for (let i = 0; i < workerCount; i++) {
          const schedulerWorker = await Tesseract.createWorker(
            tesseractOptions.langs || "eng",
            tesseractOptions.oem || 1,
            tesseractOptions,
          );
          scheduler.addWorker(schedulerWorker);
        }

        const results = await Promise.allSettled(
          inputs.map(async (input) => {
            const imageLike = await toUint8Array(input);
            const result = await scheduler.addJob(
              "recognize",
              imageLike,
              {},
              {
                blocks: true,
                text: true,
              },
            );
            return pageToDocument(result.data, imageLike);
          }),
        );

        // Surface failures to the caller instead of replacing them with empty
        // documents, which would be indistinguishable from blank pages.
        const failures = results.filter((result) => result.status === "rejected");
        if (failures.length > 0) {
          throw new AggregateError(
            failures.map((failure) => (failure as PromiseRejectedResult).reason),
            `OCR failed for ${failures.length} of ${inputs.length} inputs`,
          );
        }

        return results.map(
          (result) =>
            formatDocument(
              (result as PromiseFulfilledResult<OCRDocument>).value,
              outputType,
            ) as OCRResult<TOutputType>,
        );
      } finally {
        await scheduler.terminate();
      }
    },

    dispose: async (): Promise<void> => {
      const promise = workerPromise;
      workerPromise = null;
      if (promise) {
        const worker = await promise.catch(() => null);
        await worker?.terminate();
      }
    },
  };
}
