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
      (async (
        inputs: OCRInput[],
        _recognizesOptions: RecognizesOptions = {},
      ) => {
        // Fallback: process inputs sequentially using recognize
        const results: OCRResult<TOutputType>[] = [];
        for (const input of inputs) {
          const result = await ocr.recognize(input);
          results.push(result);
        }
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
