import type { Root } from "hast";
import type { DataType } from "undio";

export type { DataType } from "undio";
export type { Root } from "hast";

export type OutputType = "html" | "hast";

/** Normalized bounding box, top-left origin, all values in 0..1 relative to the image. */
export interface OCRBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRWord {
  text: string;
  confidence?: number;
  box?: OCRBox;
}

export interface OCRLine {
  text: string;
  confidence?: number;
  box?: OCRBox;
  words?: OCRWord[];
}

/**
 * Driver-agnostic OCR intermediate representation. Every driver produces this
 * internally; html/hast outputs are derived from it so structured data is
 * available everywhere (attached as `data.ocr` on hast nodes).
 */
export interface OCRDocument {
  text: string;
  confidence?: number;
  lines: OCRLine[];
}

export type OCRResult<T extends OutputType = OutputType> = T extends "hast" ? Root : string;

export type OCRInput = DataType;

export interface RecognizesOptions {
  parallel?: number;
}

export interface DriverOptions<T extends OutputType = OutputType> {
  outputType?: T;
  [key: string]: any;
}

export interface Driver<
  TOutputType extends OutputType,
  OptionsT extends DriverOptions<TOutputType> = DriverOptions<TOutputType>,
> {
  name?: string;
  options?: OptionsT;

  recognize: (input: OCRInput) => MaybePromise<OCRResult<TOutputType>>;

  recognizes?: (
    inputs: OCRInput[],
    options?: RecognizesOptions,
  ) => MaybePromise<OCRResult<TOutputType>[]>;

  dispose?: () => MaybePromise<void>;
}

// Allow Driver to be used with just one generic parameter
export type DriverOnlyOutput<TOutputType extends OutputType> = Driver<TOutputType>;

export interface OCRManagerOptions<TOutputType extends OutputType> {
  driver: Driver<TOutputType>;
}

export type MaybePromise<T> = T | Promise<T>;

declare module "hast" {
  interface Data {
    ocr?: {
      text?: string;
      line?: OCRLine;
      confidence?: number;
    };
  }
}
