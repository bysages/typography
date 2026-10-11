/**
 * Auto driver: probes available backends in order of preference and
 * delegates to the first one that works.
 *
 * native (@napi-rs/system-ocr, macOS/Windows) -> cli (tesseract executable)
 * -> tesseract (tesseract.js, pure WASM). AI stays opt-in because it needs
 * a model instance. Backends are loaded through dynamic imports so optional
 * peers are only required when actually selected.
 */

import type { Driver, OCRInput, OCRResult, OutputType, RecognizesOptions } from "..";

export type AutoBackend = "native" | "cli" | "tesseract";

export type AutoDriverOptions<T extends OutputType = OutputType> = Record<string, unknown> & {
  outputType?: T;
  /** Force a specific backend instead of probing. */
  backend?: AutoBackend;
};

type AnyDriver = Driver<OutputType>;

async function isNativeOcrAvailable(): Promise<boolean> {
  try {
    await import("@napi-rs/system-ocr");
    return true;
  } catch {
    return false;
  }
}

async function isTesseractCliAvailable(command = "tesseract"): Promise<boolean> {
  // Probing is meaningless outside Node; the import itself would throw there.
  if (typeof process === "undefined" || process.versions?.node === undefined) return false;
  try {
    const { spawn } = await import("node:child_process");
    return new Promise((resolve) => {
      const child = spawn(command, ["--version"], { stdio: "ignore" });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
  } catch {
    return false;
  }
}

async function loadBackend(name: AutoBackend): Promise<(options: never) => AnyDriver> {
  if (name === "native") return (await import("./native")).default as (options: never) => AnyDriver;
  if (name === "cli") return (await import("./cli")).default as (options: never) => AnyDriver;
  return (await import("./tesseract")).default as (options: never) => AnyDriver;
}

async function resolveBackend(options: AutoDriverOptions<OutputType>): Promise<AnyDriver> {
  const { outputType, backend, ...rest } = options;

  const make = async (name: AutoBackend): Promise<AnyDriver> => {
    // Language types differ per backend: cli takes a tesseract string,
    // native takes an array, tesseract.js accepts both.
    let langs = rest.langs;
    if (typeof langs === "string" && name === "native") {
      langs = langs
        .split(/[,+]/)
        .map((lang) => lang.trim())
        .filter(Boolean);
    } else if (Array.isArray(langs) && name === "cli") {
      langs = langs.join("+");
    }
    const shared = { ...rest, langs, outputType } as never;
    // The factory signature is validated per backend module; the shared option
    // bag only ever carries DriverOptions fields.
    const factory = await loadBackend(name);
    return factory(shared);
  };

  if (backend) return make(backend);
  if (await isNativeOcrAvailable()) return make("native");
  // Honor a custom executable path when probing the CLI backend.
  const command = typeof rest.command === "string" ? rest.command : "tesseract";
  if (await isTesseractCliAvailable(command)) return make("cli");
  return make("tesseract");
}

export default function autoDriver<T extends OutputType = OutputType>(
  options: AutoDriverOptions<T> = {} as AutoDriverOptions<T>,
): Driver<T, AutoDriverOptions<T>> {
  // Per-instance, promise-based so concurrent recognize calls share one probe
  // and separate autoDriver() instances never leak configuration into each other.
  let backendPromise: Promise<AnyDriver> | null = null;

  const getBackend = (): Promise<AnyDriver> => {
    backendPromise = backendPromise ?? resolveBackend(options as AutoDriverOptions<OutputType>);
    return backendPromise;
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
      const results: OCRResult<T>[] = [];
      for (const input of inputs) results.push((await driver.recognize(input)) as OCRResult<T>);
      return results;
    },

    dispose: async () => {
      const driver = await backendPromise?.catch(() => null);
      await driver?.dispose?.();
      backendPromise = null;
    },
  };
}
