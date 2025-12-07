import Tesseract, { createScheduler } from "tesseract.js";
import type { Worker } from "tesseract.js";
import { toUint8Array } from "undio";
import { fromHtml } from "hast-util-from-html";
import type {
  Driver,
  DriverOptions,
  RecognizesOptions,
  OCRInput,
  OCRResult,
  OutputType,
  Root,
} from "..";

export type TesseractDriverOptions<TOutputType extends OutputType> =
  Partial<Tesseract.WorkerOptions> & DriverOptions<TOutputType>;

export default function tesseractDriver<TOutputType extends OutputType>(
  options: TesseractDriverOptions<TOutputType>,
): Driver<TOutputType, TesseractDriverOptions<TOutputType>> {
  const { outputType, ...tesseractOptions } = options;
  let worker: Worker | null = null;

  const initializeWorker = async (): Promise<Worker> => {
    if (worker) return worker;

    worker = await Tesseract.createWorker(
      tesseractOptions.langs || "eng",
      tesseractOptions.oem || 1,
      tesseractOptions,
    );
    return worker;
  };

  return {
    name: "tesseract",
    options,

    recognize: async (input: OCRInput): Promise<OCRResult<TOutputType>> => {
      const worker = await initializeWorker();
      const imageLike = await toUint8Array(input);

      const result = await worker.recognize(imageLike, {}, { hocr: true });
      const hocr = result.data.hocr || "";

      // Return based on outputType
      if (outputType === "hast") {
        // Convert hOCR to hast
        return fromHtml(hocr) as OCRResult<TOutputType>;
      } else {
        // Return raw hOCR string
        return hocr as OCRResult<TOutputType>;
      }
    },

    recognizes: async (
      inputs: OCRInput[],
      recognizesOptions: RecognizesOptions = {},
    ): Promise<OCRResult<TOutputType>[]> => {
      const scheduler = createScheduler();
      const workers: Worker[] = [];

      try {
        // Create workers based on parallel option (default 4)
        const parallel = recognizesOptions.parallel || 4;
        const workerCount = Math.min(inputs.length, parallel);

        for (let i = 0; i < workerCount; i++) {
          const worker = await Tesseract.createWorker(
            options.langs || "eng",
            options.oem || 1,
            options,
          );
          workers.push(worker);
          scheduler.addWorker(worker);
        }

        // Process all inputs in parallel with Promise.allSettled
        const results = await Promise.allSettled(
          inputs.map(async (input) => {
            const imageLike = await toUint8Array(input);

            const result = await scheduler.addJob(
              "recognize",
              imageLike,
              {},
              { hocr: true },
            );
            const hocr = result.data.hocr || "";

            // Return based on outputType
            if (outputType === "hast") {
              return fromHtml(hocr) as OCRResult<TOutputType>;
            } else {
              return hocr as OCRResult<TOutputType>;
            }
          }),
        );

        // Filter successful results and convert errors to empty documents
        return results.map((result) => {
          if (result.status === "fulfilled") {
            return result.value;
          } else {
            console.error("OCR processing failed:", result.reason);
            // Return empty result based on outputType
            if (outputType === "hast") {
              return {
                type: "root",
                children: [],
              } as Root as OCRResult<TOutputType>;
            } else {
              return "" as OCRResult<TOutputType>;
            }
          }
        });
      } finally {
        // Clean up scheduler and workers
        await scheduler.terminate();
      }
    },

    dispose: async (): Promise<void> => {
      if (worker) {
        await worker.terminate();
        worker = null;
      }
    },
  };
}
