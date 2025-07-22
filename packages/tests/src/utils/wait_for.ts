export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeout = 10000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error("waitFor timeout");
}
