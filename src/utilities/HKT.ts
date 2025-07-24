/**
 * A helper interface to implement Higher-Kinded-Types (HKT) in TypeScript.
 *
 * @example
 * For example usage, see `src/masking/GraphQLCodegenDataMasking.ts`.
 *
 * @beta
 * The Higher-Kinded-Types implementation might change between minor versions,
 * as we discover ways of making it more performant and/or our requirements to
 * the HKT implementation change.
 *
 * We still want to encourage you to provide your own implementations of the types
 * we make overridable this way, but keep in mind that this might require some
 * extra work updating.
 *
 * @example
 *
 * ```ts
 * interface Concat extends HKT {
 *   arg1: string;
 *   arg2: string;
 *   return: `${this["arg1"]}${this["arg2"]}`;
 * }
 *
 * type Result = ApplyHKT<Concat, "Hello, ", "world!">;
 * // Result is "Hello, world!"
 * ```
 */
export interface HKT {
  arg1: unknown;
  arg2: unknown;
  arg3: unknown;
  arg4: unknown;
  return: unknown;
}
