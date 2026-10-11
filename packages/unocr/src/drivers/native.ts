import { toUint8Array } from "undio";

import type { Driver, DriverOptions, OCRInput, OCRResult, OutputType } from "..";
import { formatDocument } from "../document";

type NativeOcr = typeof import("@napi-rs/system-ocr");

export type NativeDriverOptions<T extends OutputType = OutputType> = DriverOptions<T> & {
  /** Recognition quality. Defaults to "accurate". Ignored on Windows. */
  accuracy?: "fast" | "accurate";
  /** Preferred languages, e.g. ["en-US", "zh-CN"]. Windows uses only the first. */
  langs?: string[];
  abortSignal?: AbortSignal;
};

let nativeModule: NativeOcr | null | undefined;
let nativeLoadFailure: unknown;

async function loadNative(): Promise<NativeOcr> {
  if (nativeModule === undefined) {
    try {
      nativeModule = (await import("@napi-rs/system-ocr")) as NativeOcr;
    } catch (reason) {
      nativeModule = null;
      nativeLoadFailure = reason;
    }
  }
  if (!nativeModule) {
    throw new Error(
      "System OCR is unavailable: install the optional peer dependency @napi-rs/system-ocr on macOS or Windows.",
      { cause: nativeLoadFailure },
    );
  }
  return nativeModule;
}

export function isNativeOcrAvailable(): Promise<boolean> {
  return loadNative().then(
    () => true,
    () => false,
  );
}

export default function nativeDriver<T extends OutputType = OutputType>(
  options: NativeDriverOptions<T> = {} as NativeDriverOptions<T>,
): Driver<T, NativeDriverOptions<T>> {
  const { accuracy = "accurate", langs, abortSignal, outputType } = options;

  return {
    name: "native",
    options,

    recognize: async (input: OCRInput): Promise<OCRResult<T>> => {
      const { recognize, OcrAccuracy } = await loadNative();
      const image = await toUint8Array(input);
      const result = await recognize(
        image,
        accuracy === "fast" ? OcrAccuracy.Fast : OcrAccuracy.Accurate,
        langs,
        abortSignal,
      );
      return formatDocument(
        {
          text: result.text,
          confidence: result.confidence,
          lines: result.lines.map((line) => ({
            text: line.text,
            confidence: line.confidence,
            box: line.boundingBox,
          })),
        },
        outputType,
      ) as OCRResult<T>;
    },

    dispose: async () => {},
  };
}
