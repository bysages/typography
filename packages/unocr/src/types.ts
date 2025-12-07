import type { DataType } from "undio";
import type { Root } from "hast";

export type { DataType } from "undio";
export type { Root } from "hast";

export type OutputType = "html" | "hast";

export type OCRResult<T extends OutputType = OutputType> = T extends "hast"
  ? Root
  : string;

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
export type DriverOnlyOutput<TOutputType extends OutputType> =
  Driver<TOutputType>;

export interface OCRManagerOptions<TOutputType extends OutputType> {
  driver: Driver<TOutputType>;
}

export type MaybePromise<T> = T | Promise<T>;
