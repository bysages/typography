/**
 * Browser-safe auto driver: always uses Tesseract.js. Native and CLI engines
 * are Node-only and are deliberately not imported here.
 */

import type { Driver, OCRInput, OCRResult, OutputType, RecognizesOptions } from "..";
import { DEFAULT_PARALLEL, runWithConcurrency } from "../concurrency";
import type { AutoDriverOptions } from "./auto";

export type { AutoBackend, AutoDriverOptions } from "./auto";

export default function autoDriver<T extends OutputType = OutputType>(
  options: AutoDriverOptions<T> = {} as AutoDriverOptions<T>,
): Driver<T, AutoDriverOptions<T>> {
  let driverPromise: Promise<Driver<OutputType>> | null = null;

  const loadTesseract = async (): Promise<Driver<OutputType>> => {
    const factory = (await import("./tesseract")).default as (
      factoryOptions: Record<string, unknown>,
    ) => Driver<OutputType>;
    return factory({ ...options } as Record<string, unknown>);
  };

  const getDriver = async (): Promise<Driver<OutputType>> => (driverPromise ??= loadTesseract());

  return {
    name: "auto-browser",
    options,

    recognize: async (input: OCRInput): Promise<OCRResult<T>> => {
      const driver = await getDriver();
      return driver.recognize(input) as Promise<OCRResult<T>>;
    },

    recognizes: async (
      inputs: OCRInput[],
      recognizesOptions: RecognizesOptions = {},
    ): Promise<OCRResult<T>[]> => {
      const driver = await getDriver();
      if (driver.recognizes) {
        return driver.recognizes(inputs, recognizesOptions) as Promise<OCRResult<T>[]>;
      }
      return runWithConcurrency(
        inputs,
        Math.max(1, recognizesOptions.parallel ?? DEFAULT_PARALLEL),
        async (input) => (await driver.recognize(input)) as OCRResult<T>,
      );
    },

    dispose: async () => {
      const driver = await driverPromise?.catch(() => null);
      await driver?.dispose?.();
      driverPromise = null;
    },
  };
}
