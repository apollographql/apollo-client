import { waitFor } from "@testing-library/react";

// eslint-disable-next-line local-rules/no-relative-imports
import { FinalizationRegistry } from "../FinalizationRegistry.js";

test("register", async () => {
  const cleanedUp: number[] = [];
  const registry = new FinalizationRegistry<number>((value) => {
    cleanedUp.push(value);
  });
  // @ts-ignore we want to speed this up a bit
  registry["intervalLength"] = 1;

  let obj1: {} | null = {};
  let obj2: {} | null = {};
  let obj3: {} | null = {};

  registry.register(obj1, 1);
  registry.register(obj2, 2);
  registry.register(obj3, 3);

  expect(cleanedUp).toStrictEqual([]);

  obj1 = null;
  await waitFor(() => {
    global.gc!();
    expect(cleanedUp).toStrictEqual([1]);
  });

  obj3 = null;
  await waitFor(() => {
    global.gc!();
    expect(cleanedUp).toStrictEqual([1, 3]);
  });

  obj2 = null;
  await waitFor(() => {
    global.gc!();
    expect(cleanedUp).toStrictEqual([1, 3, 2]);
  });
});

test("unregister", async () => {
  const cleanedUp: number[] = [];
  const registry = new FinalizationRegistry<number>((value) => {
    cleanedUp.push(value);
  });
  // @ts-ignore we want to speed this up a bit
  registry["intervalLength"] = 1;

  let obj1: {} | null = {};
  const token1 = {};
  let obj2: {} | null = {};
  const token2 = {};
  let obj3: {} | null = {};
  const token3 = {};

  registry.register(obj1, 1, token1);
  registry.register(obj2, 2, token2);
  registry.register(obj3, 3, token3);

  expect(cleanedUp).toStrictEqual([]);

  obj1 = null;
  await waitFor(() => {
    global.gc!();
    expect(cleanedUp).toStrictEqual([1]);
  });

  registry.unregister(token3);
  obj3 = null;
  await expect(
    waitFor(() => {
      global.gc!();
      expect(cleanedUp).toStrictEqual([1, 3]);
    })
  ).rejects.toThrow();

  obj2 = null;
  await waitFor(() => {
    global.gc!();
    expect(cleanedUp).toStrictEqual([1, 2]);
  });
});
