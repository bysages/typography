import { DEFAULT_PARALLEL, runWithConcurrency } from "./concurrency";
import type {
  OCRInput,
  OCRManagerOptions,
  OCRResult,
  OutputType,
  RecognizesOptions,
} from "./types";

export function createOCRManager<TOutputType extends OutputType>(
  options: OCRManagerOptions<TOutputType>,
) {
  const driver = options.driver;
  const driverRecognize =
    driver.recognize ||
    (() => {
      throw new Error("recognize not implemented");
    });
  const recognize = async (input: OCRInput): Promise<OCRResult<TOutputType>> =>
    (await driverRecognize(input)) as OCRResult<TOutputType>;

  return {
    recognize,

    recognizes:
      driver.recognizes ||
      (async (inputs: OCRInput[], recognizesOptions: RecognizesOptions = {}) => {
        // Failures reject the whole batch, matching how a single recognize rejects.
        return runWithConcurrency(
          inputs,
          Math.max(1, recognizesOptions.parallel ?? DEFAULT_PARALLEL),
          recognize,
        );
      }),

    dispose:
      driver.dispose ||
      (async () => {
        // Drivers without a lifecycle implementation are disposable by default.
      }),
  };
}
