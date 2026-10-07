export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function until(fn: () => boolean, timeout = 5000, step = 25): Promise<void> {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > timeout) throw new Error('until(): timeout');
    await sleep(step);
  }
}
