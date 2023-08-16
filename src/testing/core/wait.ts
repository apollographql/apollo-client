export async function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export async function tick() {
  return wait(0);
}
