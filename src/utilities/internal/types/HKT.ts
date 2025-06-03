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
 * ```ts
 *   interface Concat extends HKT {
 *     arg1: string;
 *     arg2: string;
 *     return: `${this["arg1"]}${this["arg2"]}`;
 *   }
 *
 *   type Result = ApplyHKT<Concat, "Hello, ", "world!">;
 *   // Result is "Hello, world!"
 *   ```
 */
// this type is not internal, but still kept in the same file as the internal types
// it is re-exported from `@apollo/client/utilities`.
export interface HKT {
  arg1: unknown;
  arg2: unknown;
  arg3: unknown;
  arg4: unknown;
  return: unknown;
}

/**
 * @internal
 */
export type ApplyHKT<
  fn extends HKT,
  arg1,
  arg2 = never,
  arg3 = never,
  arg4 = never,
> = (fn & {
  arg1: arg1;
  arg2: arg2;
  arg3: arg3;
  arg4: arg4;
})["return"];

/**
 * @internal
 */
export type ApplyHKTImplementationWithDefault<
  UserlandImplementation,
  Name extends string,
  DefaultImplementation extends Record<Name, HKT>,
  arg1,
  arg2 = never,
  arg3 = never,
  arg4 = never,
> = ApplyHKT<
  UserlandImplementation extends {
    [name in Name]: infer Implementation extends HKT;
  } ?
    Implementation
  : DefaultImplementation[Name],
  arg1,
  arg2,
  arg3,
  arg4
>;
