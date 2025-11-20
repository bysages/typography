import type { DataType } from "undio";
import type { Root } from "hast";

export type { DataType } from "undio";
export type { Root } from "hast";

export type OCRResult = Root;

export type OCRInput = DataType;

export interface RecognizesOptions {
  parallel?: number;
}

export interface Driver<OptionsT = DriverOptions> {
  name?: string;
  options?: OptionsT;

  recognize: (input: OCRInput) => MaybePromise<OCRResult>;

  recognizes?: (
    inputs: OCRInput[],
    options?: RecognizesOptions,
  ) => MaybePromise<OCRResult[]>;

  dispose?: () => MaybePromise<void>;
}

export interface DriverOptions {
  [key: string]: any;
}

export interface OCRManagerOptions {
  driver: Driver;
}

export type MaybePromise<T> = T | Promise<T>;
