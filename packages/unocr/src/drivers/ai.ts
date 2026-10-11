import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toBase64 } from "undio";

import type {
  Driver,
  DriverOptions,
  OCRDocument,
  OCRInput,
  OCRLine,
  OCRResult,
  OutputType,
  RecognizesOptions,
} from "..";
import { formatDocument } from "../document";

export type AIDriverOptions<T extends OutputType = OutputType> = DriverOptions<T> & {
  model: LanguageModel;
  system?: string;
  temperature?: number;
  maxRetries?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string | undefined>;
};

const DEFAULT_SYSTEM =
  "Extract all text from this image and return it as HTML. Use appropriate tags like h1-h6 for headings, p for paragraphs, and ul/ol for lists.";

function isElement(node: Root["children"][number]): node is Element {
  return node.type === "element";
}

/** Derive per-block lines from the AI HTML output (no positional data). */
export function htmlToDocument(html: string): OCRDocument {
  const root = fromHtml(html);
  const lines: OCRLine[] = [];

  const visit = (node: Root | Element) => {
    for (const child of node.children) {
      if (!isElement(child)) continue;
      const text = textContent(child).trim();
      if (child.tagName === "li" || child.tagName === "p" || /^h[1-6]$/.test(child.tagName)) {
        if (text.length > 0) lines.push({ text });
      } else {
        visit(child);
      }
    }
  };

  visit(root);
  if (lines.length === 0) {
    const text = textContent(root).trim();
    if (text.length > 0) lines.push({ text });
  }
  return { text: lines.map((line) => line.text).join("\n\n"), lines };
}

function textContent(node: Root | Element): string {
  let out = "";
  for (const child of node.children) {
    if (child.type === "text") out += child.value;
    else if (child.type === "element") out += textContent(child);
  }
  return out;
}

export default function aiDriver<TOutputType extends OutputType>(
  options: AIDriverOptions<TOutputType>,
): Driver<TOutputType, AIDriverOptions<TOutputType>> {
  const {
    model,
    system = DEFAULT_SYSTEM,
    temperature,
    maxRetries,
    maxOutputTokens,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    stopSequences,
    seed,
    abortSignal,
    headers,
    outputType,
    ...restOptions
  } = options;

  const recognize = async (input: OCRInput): Promise<OCRResult<TOutputType>> => {
    const imageData = await toBase64(input);
    const { text } = await generateText({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: [{ type: "image", image: imageData }] },
      ],
      temperature,
      maxRetries,
      maxOutputTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      stopSequences,
      seed,
      abortSignal,
      headers,
      ...restOptions,
    });
    return formatDocument(htmlToDocument(text.trim()), outputType) as OCRResult<TOutputType>;
  };

  return {
    name: "ai",
    options,
    recognize,

    recognizes: async (
      inputs: OCRInput[],
      recognizesOptions: RecognizesOptions = {},
    ): Promise<OCRResult<TOutputType>[]> => {
      const parallel = Math.max(1, recognizesOptions.parallel || inputs.length);
      const results: OCRResult<TOutputType>[] = Array.from({ length: inputs.length });
      const failures: { index: number; reason: unknown }[] = [];

      // Fixed-width worker pool so at most `parallel` requests are in flight.
      let cursor = 0;
      const runWorker = async () => {
        while (cursor < inputs.length) {
          const index = cursor++;
          try {
            results[index] = await recognize(inputs[index]);
          } catch (reason) {
            failures.push({ index, reason });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(parallel, inputs.length) }, runWorker));

      if (failures.length > 0) {
        throw new AggregateError(
          failures.map((failure) => failure.reason),
          "AI OCR failed for " + failures.length + " of " + inputs.length + " inputs",
        );
      }
      return results;
    },

    dispose: async () => {},
  };
}
