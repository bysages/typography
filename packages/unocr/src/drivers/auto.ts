/**
 * Node auto driver: probes native OCR, the Tesseract CLI, then Tesseract.js.
 * Browser bundles should use the package's browser condition, which resolves
 * this entry to the browser-safe auto driver.
 */

import type { Driver, OCRInput, OCRResult, OutputType, RecognizesOptions } from "..";
import { DEFAULT_PARALLEL, runWithConcurrency } from "../concurrency";

export type AutoBackend = "native" | "cli" | "tesseract";

export type AutoDriverOptions<T extends OutputType = OutputType> = Record<string, unknown> & {
  outputType?: T;
  /** Force a specific backend instead of probing. */
  backend?: AutoBackend;
};

type AnyDriver = Driver<OutputType>;
type BackendFactory = (options: Record<string, unknown>) => AnyDriver;

async function isNativeOcrAvailable(): Promise<boolean> {
  if (process.platform !== "darwin" && process.platform !== "win32") return false;
  try {
    await import("@napi-rs/system-ocr");
    return true;
  } catch {
    return false;
  }
}

async function isTesseractCliAvailable(command = "tesseract"): Promise<boolean> {
  try {
    const { spawn } = await import("node:child_process");
    return await new Promise((resolve) => {
      const child = spawn(command, ["--version"], { stdio: "ignore", windowsHide: true });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
  } catch {
    return false;
  }
}

async function loadBackend(name: AutoBackend): Promise<BackendFactory> {
  if (name === "native") return (await import("./native")).default as BackendFactory;
  if (name === "cli") return (await import("./cli")).default as BackendFactory;
  return (await import("./tesseract")).default as BackendFactory;
}

async function makeBackend(
  name: AutoBackend,
  options: AutoDriverOptions<OutputType>,
): Promise<AnyDriver> {
  const { outputType, backend: _backend, ...rest } = options;
  let langs = rest.langs;
  // Normalize the language format for the selected backend.
  if (typeof langs === "string" && name === "native") {
    langs = langs
      .split(/[,+]/)
      .map((lang) => lang.trim())
      .filter(Boolean);
  } else if (Array.isArray(langs) && name === "cli") {
    langs = langs.join("+");
  }
  const factory = await loadBackend(name);
  return factory({ ...rest, langs, outputType });
}

async function resolveBackend(options: AutoDriverOptions<OutputType>): Promise<AnyDriver> {
  if (options.backend) return makeBackend(options.backend, options);
  if (await isNativeOcrAvailable()) return makeBackend("native", options);

  const command = typeof options.command === "string" ? options.command : "tesseract";
  if (await isTesseractCliAvailable(command)) return makeBackend("cli", options);
  return makeBackend("tesseract", options);
}

export default function autoDriver<T extends OutputType = OutputType>(
  options: AutoDriverOptions<T> = {} as AutoDriverOptions<T>,
): Driver<T, AutoDriverOptions<T>> {
  // Share one probe per driver instance; concurrent recognizes do not re-probe.
  let backendPromise: Promise<AnyDriver> | null = null;

  const getBackend = (): Promise<AnyDriver> => {
    backendPromise ??= resolveBackend(options as AutoDriverOptions<OutputType>);
    // A failed probe must not poison every later call on this instance.
    return backendPromise.catch((error) => {
      backendPromise = null;
      throw error;
    });
  };

  return {
    name: "auto",
    options,

    recognize: async (input: OCRInput): Promise<OCRResult<T>> => {
      const driver = await getBackend();
      return driver.recognize(input) as Promise<OCRResult<T>>;
    },

    recognizes: async (
      inputs: OCRInput[],
      recognizesOptions: RecognizesOptions = {},
    ): Promise<OCRResult<T>[]> => {
      const driver = await getBackend();
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
      const driver = await backendPromise?.catch(() => null);
      await driver?.dispose?.();
      backendPromise = null;
    },
  };
}
