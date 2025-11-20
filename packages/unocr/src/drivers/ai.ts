import { generateText } from "ai";
import { toBase64 } from "undio";
import { fromHtml } from "hast-util-from-html";
import type {
  Driver,
  DriverOptions,
  RecognizesOptions,
  OCRInput,
  OCRResult,
} from "..";

export type AIDriverOptions = DriverOptions & {
  model: any;
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

export default function aiDriver(options: AIDriverOptions): Driver {
  const {
    model,
    system = "Extract all text from this image and return it as HTML. Use appropriate tags like h1-h6 for headings, p for paragraphs, and ul/ol for lists.",
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
    ...restOptions
  } = options;

  const recognize = async (input: OCRInput): Promise<OCRResult> => {
    const imageData = await toBase64(input);

    const { text } = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: [{ type: "image", image: imageData }],
        },
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

    // Convert AI HTML output to hast
    return fromHtml(text.trim());
  };

  return {
    name: "ai",
    options,

    recognize,

    recognizes: async (
      inputs: OCRInput[],
      recognizesOptions: RecognizesOptions = {},
    ): Promise<OCRResult[]> => {
      const parallel = recognizesOptions.parallel || inputs.length;

      // Process inputs with controlled parallelism
      const results = await Promise.allSettled(
        inputs.map((input, index) => {
          // Process batch for controlled parallelism
          const batchIndex = Math.floor(
            index / Math.ceil(inputs.length / parallel),
          );

          // Add small delay to spread out requests
          const delay = batchIndex * 100; // 100ms delay between batches

          return delay > 0
            ? new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
                recognize(input),
              )
            : recognize(input);
        }),
      );

      return results.map((result) => {
        if (result.status === "fulfilled") {
          return result.value;
        } else {
          console.error("AI OCR processing failed:", result.reason);
          return {
            type: "root",
            children: [],
          };
        }
      });
    },

    dispose: async (): Promise<void> => {
      // AI SDK doesn't typically require explicit cleanup
    },
  };
}
