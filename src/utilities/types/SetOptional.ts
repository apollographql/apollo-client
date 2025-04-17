import type { Prettify } from "./Prettify.js";

export type SetOptional<T, Keys extends keyof T> = Prettify<
  Pick<Partial<T>, Keys> & Omit<T, Keys>
>;
