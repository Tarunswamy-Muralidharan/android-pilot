export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

export async function pollUntil<T>(
  check: () => Promise<T | null | false>,
  options: PollOptions = {}
): Promise<{ result: T; elapsed: number } | { result: null; elapsed: number }> {
  const interval = options.intervalMs ?? 500;
  const timeout = options.timeoutMs ?? 5000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const result = await check();
    if (result !== null && result !== false) {
      return { result, elapsed: Date.now() - start };
    }
    await sleep(interval);
  }

  return { result: null, elapsed: Date.now() - start };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
