import Tesseract, { createScheduler } from "tesseract.js";
import type { Worker } from "tesseract.js";
import { toBlob } from "undio";
import { fromHtml } from "hast-util-from-html";
import type {
  Driver,
  DriverOptions,
  RecognizesOptions,
  OCRInput,
  OCRResult,
} from "..";

export type TesseractDriverOptions = Partial<Tesseract.WorkerOptions> &
  DriverOptions;

export default function tesseractDriver(
  options: TesseractDriverOptions,
): Driver {
  let worker: Worker | null = null;

  const initializeWorker = async (): Promise<Worker> => {
    if (worker) return worker;

    worker = await Tesseract.createWorker(
      options.langs || "eng",
      options.oem || 1,
      options,
    );
    return worker;
  };

  return {
    name: "tesseract",
    options,

    recognize: async (input: OCRInput): Promise<OCRResult> => {
      const worker = await initializeWorker();
      let imageLike: Tesseract.ImageLike;

      if (input instanceof Buffer) {
        // Buffer is directly supported by Tesseract
        imageLike = input;
      } else {
        // Convert other types to Blob
        imageLike = await toBlob(input);
      }

      const result = await worker.recognize(imageLike, {}, { hocr: true });
      return fromHtml(result.data.hocr || "");
    },

    recognizes: async (
      inputs: OCRInput[],
      recognizesOptions: RecognizesOptions = {},
    ): Promise<OCRResult[]> => {
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
            let imageLike: Tesseract.ImageLike;

            if (input instanceof Buffer) {
              // Buffer is directly supported by Tesseract
              imageLike = input;
            } else {
              // Convert other types to Blob
              imageLike = await toBlob(input);
            }

            const result = await scheduler.addJob(
              "recognize",
              imageLike,
              {},
              { hocr: true },
            );
            return fromHtml(result.data.hocr || "");
          }),
        );

        // Filter successful results and convert errors to empty documents
        return results.map((result) => {
          if (result.status === "fulfilled") {
            return result.value;
          } else {
            console.error("OCR processing failed:", result.reason);
            // Return empty hast document on failure
            return {
              type: "root",
              children: [],
            };
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
