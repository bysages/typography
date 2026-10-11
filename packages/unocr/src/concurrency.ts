/** Default bounded concurrency for batch OCR and driver fallbacks. */
export const DEFAULT_PARALLEL = 4;

/**
 * Run a fixed-width worker pool while preserving input/result order. Unlike
 * Promise.all, this never launches one concurrent operation per input.
 */
export async function runWithConcurrency<TInput, TResult>(
  inputs: TInput[],
  parallel: number,
  operation: (input: TInput) => Promise<TResult>,
): Promise<TResult[]> {
  const results = Array.from({ length: inputs.length }) as TResult[];
  let cursor = 0;
  const worker = async () => {
    while (cursor < inputs.length) {
      const index = cursor++;
      results[index] = await operation(inputs[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, inputs.length) }, worker));
  return results;
}
