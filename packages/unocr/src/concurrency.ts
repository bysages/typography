/** Default bounded concurrency for batch OCR and driver fallbacks. */
export const DEFAULT_PARALLEL = 4;

/**
 * Run a fixed-width worker pool while preserving input/result order. Unlike
 * Promise.all, this never launches one concurrent operation per input.
 * Without onError the first failure rejects the whole run; with onError the
 * failure is reported and the pool drains every remaining input.
 */
export async function runWithConcurrency<TInput, TResult>(
  inputs: TInput[],
  parallel: number,
  operation: (input: TInput) => Promise<TResult>,
  onError?: (reason: unknown, index: number) => void,
): Promise<TResult[]> {
  const results = Array.from({ length: inputs.length }) as TResult[];
  let cursor = 0;
  const worker = async () => {
    while (cursor < inputs.length) {
      const index = cursor++;
      try {
        results[index] = await operation(inputs[index]);
      } catch (reason) {
        if (!onError) throw reason;
        onError(reason, index);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, inputs.length) }, worker));
  return results;
}
