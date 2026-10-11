import type {
  OCRInput,
  OCRResult,
  OCRManagerOptions,
  RecognizesOptions,
  OutputType,
} from "./types";

export function createOCRManager<TOutputType extends OutputType>(
  options: OCRManagerOptions<TOutputType>,
) {
  const driver = options.driver;

  // Core OCR operations
  const ocr = {
    recognize:
      driver.recognize ||
      (async () => {
        throw new Error("recognize not implemented");
      }),

    recognizes:
      driver.recognizes ||
      (async (inputs: OCRInput[], recognizesOptions: RecognizesOptions = {}) => {
        // Fallback: bounded-concurrency loop over recognize. Failures reject
        // the whole batch, matching how a single recognize rejects.
        const parallel = Math.max(1, recognizesOptions.parallel ?? inputs.length);
        const results: OCRResult<TOutputType>[] = Array.from({ length: inputs.length });
        let cursor = 0;
        const runWorker = async () => {
          while (cursor < inputs.length) {
            const index = cursor++;
            results[index] = await ocr.recognize(inputs[index]);
          }
        };
        await Promise.all(Array.from({ length: Math.min(parallel, inputs.length) }, runWorker));
        return results;
      }),

    dispose:
      driver.dispose ||
      (async () => {
        // No-op if not implemented
      }),
  };

  return ocr;
}
