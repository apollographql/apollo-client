import type { HKT } from "@apollo/client/utilities";

import type { ApplyHKT } from "./ApplyHKT.js";

/**
 * @internal
 */

export type ApplyHKTImplementationWithDefault<
  Implementation,
  Name extends string,
  DefaultImplementation extends Record<Name, HKT>,
  arg1,
  arg2 = never,
  arg3 = never,
  arg4 = never,
> = ApplyHKT<
  Implementation extends {
    [name in Name]: infer Implementation extends HKT;
  } ?
    Implementation
  : DefaultImplementation[Name],
  arg1,
  arg2,
  arg3,
  arg4
>;
